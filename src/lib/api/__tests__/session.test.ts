import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock cookie store ---

function createMockCookieStore(initial: Record<string, string>) {
  const store = new Map<string, string>(Object.entries(initial));

  return {
    get(name: string) {
      const value = store.get(name);
      return value !== undefined ? { name, value } : undefined;
    },
    set(name: string, value: string, _options?: Record<string, unknown>) {
      store.set(name, value);
    },
    delete(name: string) {
      store.delete(name);
    },
    has(name: string) {
      return store.has(name);
    },
  };
}

// --- Mocks ---

const mockCookies = vi.fn<() => Promise<ReturnType<typeof createMockCookieStore>>>();

vi.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

const mockGetUser = vi.fn();
const mockRefreshSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
    },
  },
}));

vi.mock("@/lib/db/connection", () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

const mockFindOne = vi.fn();

vi.mock("@/lib/db/models/User", () => ({
  default: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
  },
}));

// --- Helpers ---

const SUPABASE_UID = "supabase-uid-abc";
const MONGO_ID = "mongo-id-xyz";

function mockMongoUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => MONGO_ID },
    email: "user@example.com",
    role: "seeker",
    isSuspended: false,
    ...overrides,
  };
}

// --- Tests ---

describe("Session Resolver — Unit Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getSessionUser", () => {
    /**
     * Validates: Requirement 1.1
     * When no cookies are present, getSessionUser returns null immediately.
     */
    it("returns null when no cookies are present", async () => {
      const cookieStore = createMockCookieStore({});
      mockCookies.mockResolvedValue(cookieStore);

      const { getSessionUser } = await import("@/lib/api/session");
      const result = await getSessionUser();

      expect(result).toBeNull();
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    /**
     * Validates: Requirement 1.1, 1.4
     * When the access token is valid, getSessionUser returns the user
     * without attempting a refresh.
     */
    it("returns user when access token is valid", async () => {
      const cookieStore = createMockCookieStore({
        "sb-access-token": "valid-access-token",
        "sb-refresh-token": "valid-refresh-token",
      });
      mockCookies.mockResolvedValue(cookieStore);

      mockGetUser.mockResolvedValue({
        data: { user: { id: SUPABASE_UID } },
        error: null,
      });

      mockFindOne.mockResolvedValue(mockMongoUser());

      const { getSessionUser } = await import("@/lib/api/session");
      const result = await getSessionUser();

      expect(result).not.toBeNull();
      expect(result!.supabaseId).toBe(SUPABASE_UID);
      expect(result!.mongoId).toBe(MONGO_ID);
      expect(result!.email).toBe("user@example.com");
      expect(result!.role).toBe("seeker");
      expect(result!.isSuspended).toBe(false);
      expect(mockRefreshSession).not.toHaveBeenCalled();
    });

    /**
     * Validates: Requirement 1.2, 1.5
     * When the access token is expired but the refresh token is valid,
     * getSessionUser refreshes the session and returns the user.
     */
    it("refreshes token and returns user when access token is expired but refresh token is valid", async () => {
      const cookieStore = createMockCookieStore({
        "sb-access-token": "expired-access-token",
        "sb-refresh-token": "valid-refresh-token",
      });
      mockCookies.mockResolvedValue(cookieStore);

      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "token expired" },
      });

      mockRefreshSession.mockResolvedValue({
        data: {
          session: {
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
          },
          user: { id: SUPABASE_UID },
        },
        error: null,
      });

      mockFindOne.mockResolvedValue(mockMongoUser());

      const { getSessionUser } = await import("@/lib/api/session");
      const result = await getSessionUser();

      expect(result).not.toBeNull();
      expect(result!.supabaseId).toBe(SUPABASE_UID);
      expect(mockRefreshSession).toHaveBeenCalledWith({
        refresh_token: "valid-refresh-token",
      });
      // Verify new cookies were set
      expect(cookieStore.get("sb-access-token")?.value).toBe("new-access-token");
      expect(cookieStore.get("sb-refresh-token")?.value).toBe("new-refresh-token");
    });

    /**
     * Validates: Requirement 1.3
     * When both tokens are expired, getSessionUser returns null
     * and clears both cookies.
     */
    it("returns null and clears both cookies when both tokens are expired", async () => {
      const cookieStore = createMockCookieStore({
        "sb-access-token": "expired-access-token",
        "sb-refresh-token": "expired-refresh-token",
      });
      mockCookies.mockResolvedValue(cookieStore);

      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "token expired" },
      });

      mockRefreshSession.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: "refresh token expired" },
      });

      const { getSessionUser } = await import("@/lib/api/session");
      const result = await getSessionUser();

      expect(result).toBeNull();
      expect(cookieStore.has("sb-access-token")).toBe(false);
      expect(cookieStore.has("sb-refresh-token")).toBe(false);
    });

    /**
     * Validates: Requirement 1.3
     * When the access token is expired and no refresh token exists,
     * getSessionUser returns null and clears the access token cookie.
     */
    it("returns null when access token is expired and no refresh token exists", async () => {
      const cookieStore = createMockCookieStore({
        "sb-access-token": "expired-access-token",
      });
      mockCookies.mockResolvedValue(cookieStore);

      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "token expired" },
      });

      const { getSessionUser } = await import("@/lib/api/session");
      const result = await getSessionUser();

      expect(result).toBeNull();
      expect(cookieStore.has("sb-access-token")).toBe(false);
      expect(mockRefreshSession).not.toHaveBeenCalled();
    });
  });

  describe("requireSessionUser", () => {
    /**
     * Validates: Requirement 1.4
     * requireSessionUser throws a 401 error when not authenticated.
     */
    it("throws 401 when not authenticated", async () => {
      const cookieStore = createMockCookieStore({});
      mockCookies.mockResolvedValue(cookieStore);

      const { requireSessionUser } = await import("@/lib/api/session");

      await expect(requireSessionUser()).rejects.toThrow("Authentication required");
      await expect(requireSessionUser()).rejects.toMatchObject({
        statusCode: 401,
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("requireAdmin", () => {
    /**
     * Validates: Requirement 2.1, 2.2
     * requireAdmin throws 403 when the user is not an admin.
     */
    it("throws 403 when user is not admin", async () => {
      const cookieStore = createMockCookieStore({
        "sb-access-token": "valid-token",
        "sb-refresh-token": "valid-refresh",
      });
      mockCookies.mockResolvedValue(cookieStore);

      mockGetUser.mockResolvedValue({
        data: { user: { id: SUPABASE_UID } },
        error: null,
      });

      mockFindOne.mockResolvedValue(mockMongoUser({ role: "seeker" }));

      const { requireAdmin } = await import("@/lib/api/session");

      await expect(requireAdmin()).rejects.toThrow("Admin access required");
      await expect(requireAdmin()).rejects.toMatchObject({
        statusCode: 403,
        code: "FORBIDDEN",
      });
    });
  });

  describe("requireActiveUser", () => {
    /**
     * Validates: Requirement 28.1, 28.2
     * requireActiveUser throws 403 when the user is suspended.
     */
    it("throws 403 when user is suspended", async () => {
      const cookieStore = createMockCookieStore({
        "sb-access-token": "valid-token",
        "sb-refresh-token": "valid-refresh",
      });
      mockCookies.mockResolvedValue(cookieStore);

      mockGetUser.mockResolvedValue({
        data: { user: { id: SUPABASE_UID } },
        error: null,
      });

      mockFindOne.mockResolvedValue(
        mockMongoUser({ isSuspended: true, suspensionReason: "Scam activity" })
      );

      const { requireActiveUser } = await import("@/lib/api/session");

      await expect(requireActiveUser()).rejects.toThrow("Account suspended");
      await expect(requireActiveUser()).rejects.toMatchObject({
        statusCode: 403,
        code: "FORBIDDEN",
      });
    });
  });
});
