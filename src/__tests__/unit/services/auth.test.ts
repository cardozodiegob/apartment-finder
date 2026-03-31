import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

// Set env vars before any module imports
beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

// --- Mocks ---

const mockCreateUser = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockVerifyOtp = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockUpdateUser = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: (...args: unknown[]) => mockCreateUser(...args),
      },
    },
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      signOut: () => mockSignOut(),
      getSession: () => mockGetSession(),
    },
  },
}));

const mockUserCreate = vi.fn();
vi.mock("@/lib/db/models/User", () => ({
  default: {
    create: (...args: unknown[]) => mockUserCreate(...args),
  },
}));

import {
  register,
  login,
  loginWithOAuth,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  logout,
  getSession,
  _getLockoutMap,
} from "@/lib/services/auth";

describe("Auth Validations", () => {
  it("rejects registration with invalid email", async () => {
    const result = await register({
      email: "not-an-email",
      password: "password123",
      fullName: "Test User",
      preferredLanguage: "en",
    });
    expect(result.error).toBe("Invalid email address");
    expect(result.user).toBeNull();
  });

  it("rejects registration with short password", async () => {
    const result = await register({
      email: "test@example.com",
      password: "short",
      fullName: "Test User",
      preferredLanguage: "en",
    });
    expect(result.error).toBe("Password must be at least 8 characters");
    expect(result.user).toBeNull();
  });

  it("rejects registration with empty full name", async () => {
    const result = await register({
      email: "test@example.com",
      password: "password123",
      fullName: "",
      preferredLanguage: "en",
    });
    expect(result.error).toBe("Full name is required");
    expect(result.user).toBeNull();
  });

  it("rejects login with invalid email", async () => {
    const result = await login("bad-email", "password123");
    expect(result.error).toBe("Invalid email address");
    expect(result.user).toBeNull();
  });

  it("rejects login with empty password", async () => {
    const result = await login("test@example.com", "");
    expect(result.error).toBe("Password is required");
    expect(result.user).toBeNull();
  });
});

describe("register()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a Supabase user and MongoDB record on success", async () => {
    const fakeUser = { id: "supa-123", email: "test@example.com" };
    mockCreateUser.mockResolvedValue({ data: { user: fakeUser }, error: null });
    mockUserCreate.mockResolvedValue({ supabaseId: "supa-123" });

    const result = await register({
      email: "test@example.com",
      password: "password123",
      fullName: "Test User",
      preferredLanguage: "en",
    });

    expect(result.user).toEqual(fakeUser);
    expect(result.error).toBeNull();
    expect(mockCreateUser).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
      email_confirm: false,
    });
    expect(mockUserCreate).toHaveBeenCalledWith({
      supabaseId: "supa-123",
      email: "test@example.com",
      fullName: "Test User",
      preferredLanguage: "en",
      role: "seeker",
    });
  });

  it("returns error when Supabase reports duplicate email", async () => {
    mockCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: "User already registered" },
    });

    const result = await register({
      email: "dup@example.com",
      password: "password123",
      fullName: "Dup User",
      preferredLanguage: "en",
    });

    expect(result.error).toBe("This email is already registered");
    expect(result.user).toBeNull();
  });

  it("returns error when MongoDB duplicate key", async () => {
    const fakeUser = { id: "supa-456", email: "dup@example.com" };
    mockCreateUser.mockResolvedValue({ data: { user: fakeUser }, error: null });
    mockUserCreate.mockRejectedValue(new Error("E11000 duplicate key"));

    const result = await register({
      email: "dup@example.com",
      password: "password123",
      fullName: "Dup User",
      preferredLanguage: "en",
    });

    expect(result.error).toBe("This email is already registered");
  });
});


describe("login()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _getLockoutMap().clear();
  });

  it("returns user on successful login", async () => {
    const fakeUser = { id: "supa-789", email: "user@example.com" };
    mockSignInWithPassword.mockResolvedValue({
      data: { user: fakeUser, session: {} },
      error: null,
    });

    const result = await login("user@example.com", "password123");
    expect(result.user).toEqual(fakeUser);
    expect(result.error).toBeNull();
  });

  it("returns error on invalid credentials", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });

    const result = await login("user@example.com", "wrong");
    expect(result.error).toBe("Invalid email or password");
    expect(result.user).toBeNull();
  });

  it("locks account after 3 consecutive failed attempts", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });

    await login("lockme@example.com", "wrong1");
    await login("lockme@example.com", "wrong2");
    const third = await login("lockme@example.com", "wrong3");

    expect(third.error).toBe("Account temporarily locked. Check your email.");

    // Even valid credentials should be rejected during lockout
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: "x" }, session: {} },
      error: null,
    });

    const duringLockout = await login("lockme@example.com", "correct");
    expect(duringLockout.error).toBe("Account temporarily locked. Try again later.");
    expect(duringLockout.user).toBeNull();
  });

  it("clears failed attempts on successful login", async () => {
    mockSignInWithPassword
      .mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: "Invalid login credentials" },
      })
      .mockResolvedValueOnce({
        data: { user: { id: "supa-ok" }, session: {} },
        error: null,
      });

    await login("clear@example.com", "wrong");
    const success = await login("clear@example.com", "correct");

    expect(success.user).toEqual({ id: "supa-ok" });
    expect(_getLockoutMap().has("clear@example.com")).toBe(false);
  });

  it("unlocks account after lockout duration expires", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });

    await login("expire@example.com", "wrong1");
    await login("expire@example.com", "wrong2");
    await login("expire@example.com", "wrong3");

    // Manually expire the lock
    const entry = _getLockoutMap().get("expire@example.com");
    if (entry) {
      entry.lockedUntil = Date.now() - 1000; // expired
    }

    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: "unlocked" }, session: {} },
      error: null,
    });

    const result = await login("expire@example.com", "correct");
    expect(result.user).toEqual({ id: "unlocked" });
    expect(result.error).toBeNull();
  });
});

describe("loginWithOAuth()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns OAuth URL for google", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/auth?..." },
      error: null,
    });

    const result = await loginWithOAuth("google");
    expect(result.url).toContain("https://accounts.google.com");
    expect(result.error).toBeNull();
  });

  it("returns error on OAuth failure", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: { message: "OAuth provider error" },
    });

    const result = await loginWithOAuth("github");
    expect(result.error).toBe("OAuth provider error");
    expect(result.url).toBeNull();
  });
});

describe("verifyEmail()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no error on success", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    const result = await verifyEmail("valid-token");
    expect(result.error).toBeNull();
  });

  it("returns error on invalid token", async () => {
    mockVerifyOtp.mockResolvedValue({ error: { message: "Token expired" } });
    const result = await verifyEmail("expired-token");
    expect(result.error).toBe("Token expired");
  });
});

describe("requestPasswordReset()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no error on success", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    const result = await requestPasswordReset("user@example.com");
    expect(result.error).toBeNull();
  });

  it("returns error on failure", async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      error: { message: "Rate limit exceeded" },
    });
    const result = await requestPasswordReset("user@example.com");
    expect(result.error).toBe("Rate limit exceeded");
  });
});

describe("resetPassword()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no error on success", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
    const result = await resetPassword("recovery-token", "newpass123");
    expect(result.error).toBeNull();
  });

  it("returns error if token verification fails", async () => {
    mockVerifyOtp.mockResolvedValue({ error: { message: "Invalid token" } });
    const result = await resetPassword("bad-token", "newpass123");
    expect(result.error).toBe("Invalid token");
  });

  it("returns error if password update fails", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: { message: "Weak password" } });
    const result = await resetPassword("good-token", "weak");
    expect(result.error).toBe("Weak password");
  });
});

describe("logout()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no error on success", async () => {
    mockSignOut.mockResolvedValue({ error: null });
    const result = await logout();
    expect(result.error).toBeNull();
  });

  it("returns error on failure", async () => {
    mockSignOut.mockResolvedValue({ error: { message: "Session not found" } });
    const result = await logout();
    expect(result.error).toBe("Session not found");
  });
});

describe("getSession()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns session on success", async () => {
    const fakeSession = { access_token: "abc", user: { id: "u1" } };
    mockGetSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });

    const result = await getSession();
    expect(result.session).toEqual(fakeSession);
    expect(result.error).toBeNull();
  });

  it("returns null session with error on failure", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: { message: "Not authenticated" },
    });

    const result = await getSession();
    expect(result.session).toBeNull();
    expect(result.error).toBe("Not authenticated");
  });
});
