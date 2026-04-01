import { describe, it, expect } from "vitest";
import {
  passwordSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

// --- Helpers ---

/** Build a valid password of exact length, satisfying all character classes. */
function buildPassword(length: number): string {
  // Prefix guarantees all four character classes
  const prefix = "Aa1!";
  if (length < prefix.length) return "a".repeat(length); // intentionally invalid
  return prefix + "a".repeat(length - prefix.length);
}

// --- Tests ---

describe("Password Validation — Unit Tests", () => {
  /**
   * Validates: Requirements 3.1, 3.2
   * A password meeting all criteria should pass validation.
   */
  it("accepts a valid password", () => {
    const result = passwordSchema.safeParse("Test1234!");
    expect(result.success).toBe(true);
  });

  /**
   * Validates: Requirement 3.1
   * A password missing an uppercase letter is rejected.
   */
  it("rejects password missing uppercase letter", () => {
    const result = passwordSchema.safeParse("test1234!");
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message.includes("uppercase"))).toBe(true);
  });

  /**
   * Validates: Requirement 3.1
   * A password missing a lowercase letter is rejected.
   */
  it("rejects password missing lowercase letter", () => {
    const result = passwordSchema.safeParse("TEST1234!");
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message.includes("lowercase"))).toBe(true);
  });

  /**
   * Validates: Requirement 3.1
   * A password missing a digit is rejected.
   */
  it("rejects password missing digit", () => {
    const result = passwordSchema.safeParse("Testtest!");
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message.includes("digit"))).toBe(true);
  });

  /**
   * Validates: Requirement 3.1
   * A password missing a special character is rejected.
   */
  it("rejects password missing special character", () => {
    const result = passwordSchema.safeParse("Test12345");
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message.includes("special"))).toBe(true);
  });

  /**
   * Validates: Requirement 3.2
   * A 7-character password is below the minimum and is rejected.
   */
  it("rejects password with 7 characters (below minimum)", () => {
    const result = passwordSchema.safeParse(buildPassword(7));
    expect(result.success).toBe(false);
  });

  /**
   * Validates: Requirement 3.2
   * An 8-character password at the minimum boundary passes.
   */
  it("accepts password with exactly 8 characters (minimum boundary)", () => {
    const result = passwordSchema.safeParse(buildPassword(8));
    expect(result.success).toBe(true);
  });

  /**
   * Validates: Requirement 3.2
   * A 128-character password at the maximum boundary passes.
   */
  it("accepts password with exactly 128 characters (maximum boundary)", () => {
    const result = passwordSchema.safeParse(buildPassword(128));
    expect(result.success).toBe(true);
  });

  /**
   * Validates: Requirement 3.2
   * A 129-character password exceeds the maximum and is rejected.
   */
  it("rejects password with 129 characters (above maximum)", () => {
    const result = passwordSchema.safeParse(buildPassword(129));
    expect(result.success).toBe(false);
  });
});

describe("registerSchema — password rules", () => {
  const validBase = {
    email: "user@example.com",
    fullName: "Test User",
    preferredLanguage: "en" as const,
  };

  /**
   * Validates: Requirement 3.1
   * registerSchema enforces the same password complexity rules.
   */
  it("rejects registration with a weak password", () => {
    const result = registerSchema.safeParse({ ...validBase, password: "weak" });
    expect(result.success).toBe(false);
  });

  it("accepts registration with a strong password", () => {
    const result = registerSchema.safeParse({ ...validBase, password: "Test1234!" });
    expect(result.success).toBe(true);
  });
});

describe("resetPasswordSchema — password rules", () => {
  const validBase = {
    email: "user@example.com",
    token: "reset-token-abc",
  };

  /**
   * Validates: Requirement 3.4
   * resetPasswordSchema enforces the same password complexity rules.
   */
  it("rejects reset with a weak password", () => {
    const result = resetPasswordSchema.safeParse({ ...validBase, newPassword: "weak" });
    expect(result.success).toBe(false);
  });

  it("accepts reset with a strong password", () => {
    const result = resetPasswordSchema.safeParse({ ...validBase, newPassword: "Test1234!" });
    expect(result.success).toBe(true);
  });
});
