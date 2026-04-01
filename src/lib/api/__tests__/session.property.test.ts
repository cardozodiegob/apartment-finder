import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";

/**
 * Property 1: Token refresh always updates both cookies or deletes both — never leaves partial state
 * Validates: Requirements 1.2, 1.3
 *
 * After getSessionUser() completes, the cookie store either has BOTH
 * sb-access-token and sb-refresh-token set, or NEITHER — never a partial
 * state where only one exists.
 */

// --- Mock cookie store that tracks set/delete operations ---

interface CookieEntry {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

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
    /** Snapshot for assertions */
    snapshot() {
      return {
        hasAccess: store.has("sb-access-token"),
        hasRefresh: store.has("sb-refresh-token"),
      };
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

// --- Arbitraries ---

/** Represents the possible states of the token pair presented in cookies */
type TokenScenario =
  | { kind: "no_tokens" }
  | { kind: "access_only"; accessToken: string }
  | { kind: "both_valid"; accessToken: string; refreshToken: string }
  | { kind: "access_expired_refresh_valid"; accessToken: string; refreshToken: string }
  | { kind: "access_expired_refresh_invalid"; accessToken: string; refreshToken: string };

const arbTokenScenario: fc.Arbitrary<TokenScenario> = fc.oneof(
  fc.constant<TokenScenario>({ kind: "no_tokens" }),
  fc.string({ minLength: 1 }).map((t) => ({
    kind: "access_only" as const,
    accessToken: `access-${t}`,
  })),
  fc.tuple(fc.string({ minLength: 1 }), fc.string({ minLength: 1 })).map(([a, r]) => ({
    kind: "both_valid" as const,
    accessToken: `access-${a}`,
    refreshToken: `refresh-${r}`,
  })),
  fc.tuple(fc.string({ minLength: 1 }), fc.string({ minLength: 1 })).map(([a, r]) => ({
    kind: "access_expired_refresh_valid" as const,
    accessToken: `expired-${a}`,
    refreshToken: `refresh-${r}`,
  })),
  fc.tuple(fc.string({ minLength: 1 }), fc.string({ minLength: 1 })).map(([a, r]) => ({
    kind: "access_expired_refresh_invalid" as const,
    accessToken: `expired-${a}`,
    refreshToken: `bad-${r}`,
  }))
);

/** Whether a matching MongoDB user exists */
const arbHasMongoUser = fc.boolean();

// --- Helpers to wire up mocks per scenario ---

function configureMocks(scenario: TokenScenario, hasMongoUser: boolean) {
  // Build initial cookie map
  const initialCookies: Record<string, string> = {};
  if (scenario.kind !== "no_tokens") {
    initialCookies["sb-access-token"] = scenario.accessToken;
  }
  if (
    scenario.kind === "both_valid" ||
    scenario.kind === "access_expired_refresh_valid" ||
    scenario.kind === "access_expired_refresh_invalid"
  ) {
    initialCookies["sb-refresh-token"] = scenario.refreshToken;
  }

  const cookieStore = createMockCookieStore(initialCookies);
  mockCookies.mockResolvedValue(cookieStore);

  // Configure supabase getUser
  if (scenario.kind === "no_tokens" || scenario.kind === "access_only") {
    // No access token → getUser won't be called (early return)
    // access_only with expired token → getUser fails
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid token" },
    });
  } else if (scenario.kind === "both_valid") {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "supabase-uid-123" } },
      error: null,
    });
  } else {
    // access_expired_refresh_valid or access_expired_refresh_invalid
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "token expired" },
    });
  }

  // Configure supabase refreshSession
  if (scenario.kind === "access_expired_refresh_valid") {
    mockRefreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
        },
        user: { id: "supabase-uid-123" },
      },
      error: null,
    });
  } else {
    mockRefreshSession.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "refresh failed" },
    });
  }

  // Configure MongoDB user lookup
  if (hasMongoUser) {
    mockFindOne.mockResolvedValue({
      _id: { toString: () => "mongo-id-456" },
      email: "user@example.com",
      role: "seeker",
      isSuspended: false,
    });
  } else {
    mockFindOne.mockResolvedValue(null);
  }

  return cookieStore;
}

// --- Property test ---

describe("Session Resolver — Property Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("Property 1: after getSessionUser(), cookies are either both present or both absent — never partial", async () => {
    await fc.assert(
      fc.asyncProperty(arbTokenScenario, arbHasMongoUser, async (scenario, hasMongoUser) => {
        vi.resetAllMocks();

        const cookieStore = configureMocks(scenario, hasMongoUser);

        // Dynamic import to pick up fresh mocks each run
        const { getSessionUser } = await import("@/lib/api/session");

        await getSessionUser();

        const { hasAccess, hasRefresh } = cookieStore.snapshot();

        // INVARIANT: both present or both absent
        const bothPresent = hasAccess && hasRefresh;
        const bothAbsent = !hasAccess && !hasRefresh;

        expect(
          bothPresent || bothAbsent,
          `Partial cookie state detected: access=${hasAccess}, refresh=${hasRefresh} for scenario=${scenario.kind}, hasMongoUser=${hasMongoUser}`
        ).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
