import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import * as fc from "fast-check";

// Set env vars before any module imports
beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

// --- Mocks ---

const mockCreateUser = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockUserCreate = vi.fn();

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
      signInWithOAuth: vi.fn(),
      verifyOtp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/models/User", () => ({
  default: {
    create: (...args: unknown[]) => mockUserCreate(...args),
  },
}));

import { register, login, _getLockoutMap } from "@/lib/services/auth";
import type { RegisterInput } from "@/lib/validations/auth";


// --- Arbitraries for Property 1 ---

const validEmailArb = fc
  .tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{1,10}$/),
    fc.stringMatching(/^[a-z][a-z0-9]{1,8}$/),
    fc.constantFrom("com", "org", "net", "io", "dev")
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

const validPasswordArb = fc.stringMatching(/^[A-Za-z0-9!@#$%]{8,32}$/);

const validFullNameArb = fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,49}$/);

const validLanguageArb = fc.constantFrom(
  "en" as const,
  "es" as const,
  "fr" as const,
  "de" as const,
  "pt" as const,
  "it" as const
);

const validRegistrationArb: fc.Arbitrary<RegisterInput> = fc
  .tuple(validEmailArb, validPasswordArb, validFullNameArb, validLanguageArb)
  .map(([email, password, fullName, preferredLanguage]) => ({
    email,
    password,
    fullName,
    preferredLanguage,
  }));

/**
 * Feature: apartment-finder, Property 1: Registration creates verified-pending account
 *
 * Validates: Requirements 1.2, 1.3
 *
 * For any valid registration input (email, password, full name, preferred language),
 * calling register() should produce a new user record with verified = false (email_confirm: false),
 * and a duplicate call with the same email should return an error indicating the email is already in use.
 */
describe("Feature: apartment-finder, Property 1: Registration creates verified-pending account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("register() creates a Supabase user with email_confirm: false and a MongoDB User record for any valid input", async () => {
    await fc.assert(
      fc.asyncProperty(validRegistrationArb, async (input) => {
        // Reset mocks for each property run
        mockCreateUser.mockReset();
        mockUserCreate.mockReset();

        // Arrange: Supabase returns a new user successfully
        const fakeSupabaseUser = { id: `supa-${input.email}`, email: input.email };
        mockCreateUser.mockResolvedValue({
          data: { user: fakeSupabaseUser },
          error: null,
        });
        mockUserCreate.mockResolvedValue({
          supabaseId: fakeSupabaseUser.id,
          email: input.email,
        });

        // Act
        const result = await register(input);

        // Assert: registration succeeded
        expect(result.error).toBeNull();
        expect(result.user).toEqual(fakeSupabaseUser);

        // Assert: Supabase was called with email_confirm: false (verified = false)
        expect(mockCreateUser).toHaveBeenCalledWith({
          email: input.email,
          password: input.password,
          email_confirm: false,
        });

        // Assert: MongoDB User was created with correct fields
        expect(mockUserCreate).toHaveBeenCalledWith({
          supabaseId: fakeSupabaseUser.id,
          email: input.email,
          fullName: input.fullName,
          preferredLanguage: input.preferredLanguage,
          role: "seeker",
        });
      }),
      { numRuns: 100 }
    );
  });

  it("register() rejects duplicate email with an appropriate error message", async () => {
    await fc.assert(
      fc.asyncProperty(validRegistrationArb, async (input) => {
        // Reset mocks for each property run
        mockCreateUser.mockReset();
        mockUserCreate.mockReset();

        // Arrange: Supabase returns "already registered" error
        mockCreateUser.mockResolvedValue({
          data: { user: null },
          error: { message: "User already registered" },
        });

        // Act
        const result = await register(input);

        // Assert: duplicate email is rejected
        expect(result.user).toBeNull();
        expect(result.error).toBe("This email is already registered");

        // Assert: MongoDB User.create was NOT called
        expect(mockUserCreate).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });
});


// --- Arbitraries for Property 2 ---

// Generate emails that pass Zod validation (valid format)
const validLoginEmailArb = fc
  .tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{1,8}$/),
    fc.stringMatching(/^[a-z][a-z0-9]{1,6}$/),
    fc.constantFrom("com", "org", "net")
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

// Generate passwords that pass Zod login validation (min 1 char)
const validLoginPasswordArb = fc.stringMatching(/^[A-Za-z0-9]{1,32}$/);

const failedAttemptCountArb = fc.integer({ min: 3, max: 10 });

/**
 * Feature: apartment-finder, Property 2: Account lockout after consecutive failures
 *
 * Validates: Requirements 1.6
 *
 * For any user account and any sequence of 3 consecutive invalid login attempts,
 * the account should be locked for 15 minutes. During lockout, even valid
 * credentials should be rejected.
 */
describe("Feature: apartment-finder, Property 2: Account lockout after consecutive failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _getLockoutMap().clear();
  });

  it("locks account after 3+ consecutive failed login attempts and rejects valid credentials during lockout", async () => {
    await fc.assert(
      fc.asyncProperty(
        validLoginEmailArb,
        validLoginPasswordArb,
        failedAttemptCountArb,
        async (email, validPassword, failCount) => {
          // Reset state for each property run
          _getLockoutMap().clear();
          mockSignInWithPassword.mockReset();

          // Arrange: all login attempts fail
          mockSignInWithPassword.mockResolvedValue({
            data: { user: null, session: null },
            error: { message: "Invalid login credentials" },
          });

          // Act: perform failCount failed login attempts
          for (let i = 0; i < failCount; i++) {
            await login(email, `wrong-password-${i}`);
          }

          // Assert: account is locked
          const lockoutEntry = _getLockoutMap().get(email);
          expect(lockoutEntry).toBeDefined();
          expect(lockoutEntry!.failedAttempts).toBeGreaterThanOrEqual(3);
          expect(lockoutEntry!.lockedUntil).not.toBeNull();
          expect(lockoutEntry!.lockedUntil!).toBeGreaterThan(Date.now());

          // Arrange: now provide valid credentials
          mockSignInWithPassword.mockResolvedValue({
            data: {
              user: { id: "user-123", email },
              session: { access_token: "token" },
            },
            error: null,
          });

          // Act: attempt login with valid credentials during lockout
          const lockedResult = await login(email, validPassword);

          // Assert: valid credentials rejected during lockout
          expect(lockedResult.user).toBeNull();
          expect(lockedResult.error).toContain("Account temporarily locked");
        }
      ),
      { numRuns: 100 }
    );
  });
});
