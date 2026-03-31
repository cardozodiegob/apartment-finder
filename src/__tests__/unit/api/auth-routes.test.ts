import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

// Set env vars before any module imports
beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

// --- Mocks for auth service ---

const mockRegister = vi.fn();
const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockRequestPasswordReset = vi.fn();
const mockVerifyEmail = vi.fn();
const mockGetSession = vi.fn();

vi.mock("@/lib/services/auth", () => ({
  register: (...args: unknown[]) => mockRegister(...args),
  login: (...args: unknown[]) => mockLogin(...args),
  logout: () => mockLogout(),
  requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
  verifyEmail: (...args: unknown[]) => mockVerifyEmail(...args),
  getSession: () => mockGetSession(),
}));

// Mock supabase modules to prevent import errors
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { auth: { admin: { createUser: vi.fn() } } },
}));
vi.mock("@/lib/supabase/client", () => ({
  supabase: { auth: {} },
}));
vi.mock("@/lib/db/models/User", () => ({ default: { create: vi.fn() } }));


// --- Import route handlers ---

import { POST as registerRoute } from "@/app/api/auth/register/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { POST as resetPasswordRoute } from "@/app/api/auth/reset-password/route";
import { POST as verifyEmailRoute } from "@/app/api/auth/verify-email/route";
import { GET as sessionRoute } from "@/app/api/auth/session/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 201 with user on successful registration", async () => {
    mockRegister.mockResolvedValue({
      user: { id: "u1", email: "test@example.com" },
      error: null,
    });

    const res = await registerRoute(makeRequest({
      email: "test@example.com",
      password: "password123",
      fullName: "Test User",
      preferredLanguage: "en",
    }) as never);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.id).toBe("u1");
    expect(body.user.email).toBe("test@example.com");
  });

  it("returns 400 for invalid input", async () => {
    const res = await registerRoute(makeRequest({
      email: "not-an-email",
      password: "short",
      fullName: "",
    }) as never);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 for duplicate email", async () => {
    mockRegister.mockResolvedValue({
      user: null,
      error: "This email is already registered",
    });

    const res = await registerRoute(makeRequest({
      email: "dup@example.com",
      password: "password123",
      fullName: "Dup User",
      preferredLanguage: "en",
    }) as never);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("REGISTRATION_FAILED");
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with user on successful login", async () => {
    mockLogin.mockResolvedValue({
      user: { id: "u2", email: "user@example.com" },
      error: null,
    });

    const res = await loginRoute(makeRequest({
      email: "user@example.com",
      password: "password123",
    }) as never);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe("u2");
  });

  it("returns 401 for invalid credentials", async () => {
    mockLogin.mockResolvedValue({
      user: null,
      error: "Invalid email or password",
    });

    const res = await loginRoute(makeRequest({
      email: "user@example.com",
      password: "wrong",
    }) as never);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("LOGIN_FAILED");
  });

  it("returns 423 when account is locked", async () => {
    mockLogin.mockResolvedValue({
      user: null,
      error: "Account temporarily locked. Try again later.",
    });

    const res = await loginRoute(makeRequest({
      email: "locked@example.com",
      password: "any",
    }) as never);

    expect(res.status).toBe(423);
    const body = await res.json();
    expect(body.code).toBe("ACCOUNT_LOCKED");
  });

  it("returns 400 for validation errors", async () => {
    const res = await loginRoute(makeRequest({
      email: "bad-email",
      password: "",
    }) as never);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/auth/logout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 on successful logout", async () => {
    mockLogout.mockResolvedValue({ error: null });
    const res = await logoutRoute();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Logged out successfully");
  });

  it("returns 500 on logout failure", async () => {
    mockLogout.mockResolvedValue({ error: "Session not found" });
    const res = await logoutRoute();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("LOGOUT_FAILED");
  });
});

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns success message on valid email", async () => {
    mockRequestPasswordReset.mockResolvedValue({ error: null });

    const res = await resetPasswordRoute(makeRequest({
      email: "user@example.com",
    }) as never);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("reset link has been sent");
  });

  it("returns 400 for invalid email format", async () => {
    const res = await resetPasswordRoute(makeRequest({
      email: "not-email",
    }) as never);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/auth/verify-email", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns success on valid token", async () => {
    mockVerifyEmail.mockResolvedValue({ error: null });

    const res = await verifyEmailRoute(makeRequest({
      token: "valid-token-hash",
    }) as never);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Email verified successfully");
  });

  it("returns 400 on invalid token", async () => {
    mockVerifyEmail.mockResolvedValue({ error: "Token expired" });

    const res = await verifyEmailRoute(makeRequest({
      token: "expired-token",
    }) as never);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VERIFICATION_FAILED");
  });

  it("returns 400 when token is missing", async () => {
    const res = await verifyEmailRoute(makeRequest({}) as never);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/auth/session", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns session data when authenticated", async () => {
    mockGetSession.mockResolvedValue({
      session: {
        user: { id: "u3", email: "session@example.com" },
        expires_at: 1700000000,
      },
      error: null,
    });

    const res = await sessionRoute();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session.user.id).toBe("u3");
    expect(body.session.expiresAt).toBe(1700000000);
  });

  it("returns 401 when no session exists", async () => {
    mockGetSession.mockResolvedValue({ session: null, error: null });

    const res = await sessionRoute();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.session).toBeNull();
  });

  it("returns 500 on session error", async () => {
    mockGetSession.mockResolvedValue({
      session: null,
      error: "Not authenticated",
    });

    const res = await sessionRoute();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("SESSION_ERROR");
  });
});
