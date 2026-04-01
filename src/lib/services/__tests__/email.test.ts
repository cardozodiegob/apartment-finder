import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Unit tests for email service
 * Validates: Requirements 20.2, 20.3, 20.4
 */

// --- Mocks ---

const mockSend = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

const mockEmailLogCreate = vi.fn();
vi.mock("@/lib/db/models/EmailLog", () => ({
  default: { create: (...args: unknown[]) => mockEmailLogCreate(...args) },
}));

const mockNotificationCreate = vi.fn();
vi.mock("@/lib/db/models/Notification", () => ({
  default: { create: (...args: unknown[]) => mockNotificationCreate(...args) },
}));

const mockUserFindOne = vi.fn();
vi.mock("@/lib/db/models/User", () => ({
  default: { findOne: (...args: unknown[]) => mockUserFindOne(...args) },
}));

// --- Tests ---

describe("Email Service — Unit Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    // Default: EmailLog.create succeeds
    mockEmailLogCreate.mockResolvedValue({});
    // Default: User lookup for fallback
    mockUserFindOne.mockResolvedValue({ _id: "user123" });
    // Default: Notification.create succeeds
    mockNotificationCreate.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Helper: run sendEmail while advancing fake timers so retries don't block. */
  async function runWithTimers<T>(fn: () => Promise<T>): Promise<T> {
    const promise = fn();
    // Advance timers enough for all backoff delays (1s + 4s + 16s)
    for (let i = 0; i < 30; i++) {
      await vi.advanceTimersByTimeAsync(1000);
    }
    return promise;
  }

  /**
   * Validates: Requirement 20.2
   * Retry behavior on transient failures — retries up to 3 times then fails.
   */
  it("retries up to 3 times on transient failures", async () => {
    const transientError = new Error("Connection timeout");

    mockSend
      .mockRejectedValueOnce(transientError)
      .mockRejectedValueOnce(transientError)
      .mockRejectedValueOnce(transientError);

    const { sendEmail } = await import("@/lib/services/email");

    const result = await runWithTimers(() =>
      sendEmail({
        to: "user@example.com",
        template: "verification",
        locale: "en",
        data: { link: "https://example.com/verify" },
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Connection timeout");
    expect(mockSend).toHaveBeenCalledTimes(3);
    // Each attempt is logged
    expect(mockEmailLogCreate).toHaveBeenCalledTimes(3);
  });

  /**
   * Validates: Requirement 20.2
   * Succeeds on second attempt after a transient failure.
   */
  it("succeeds on retry after transient failure", async () => {
    const transientError = new Error("Connection timeout");

    mockSend
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce({ id: "email-id" });

    const { sendEmail } = await import("@/lib/services/email");

    const result = await runWithTimers(() =>
      sendEmail({
        to: "user@example.com",
        template: "payment_confirmation",
        locale: "en",
        data: { amount: "€500" },
      })
    );

    expect(result.success).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(2);
    // First attempt logged as failed, second as sent
    expect(mockEmailLogCreate).toHaveBeenCalledTimes(2);
    expect(mockEmailLogCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: "failed", attempts: 1 })
    );
    expect(mockEmailLogCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: "sent", attempts: 2 })
    );
  });

  /**
   * Validates: Requirement 20.4
   * Hard bounce (422 status) skips retry — only one attempt.
   */
  it("does not retry on hard bounce (422 status)", async () => {
    const hardBounceError = Object.assign(new Error("Invalid email address"), {
      statusCode: 422,
    });

    mockSend.mockRejectedValueOnce(hardBounceError);

    const { sendEmail } = await import("@/lib/services/email");

    const result = await sendEmail({
      to: "bad@invalid",
      template: "verification",
      locale: "en",
      data: { link: "https://example.com/verify" },
    });

    expect(result.success).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(1);
    // Logged as bounced
    expect(mockEmailLogCreate).toHaveBeenCalledTimes(1);
    expect(mockEmailLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "bounced", attempts: 1 })
    );
  });

  /**
   * Validates: Requirement 20.4
   * Hard bounce detected by "invalid" keyword in error message.
   */
  it("does not retry when error message contains 'invalid'", async () => {
    const invalidError = new Error("The recipient address is invalid");

    mockSend.mockRejectedValueOnce(invalidError);

    const { sendEmail } = await import("@/lib/services/email");

    const result = await sendEmail({
      to: "bad@invalid",
      template: "password_reset",
      locale: "en",
      data: { link: "https://example.com/reset" },
    });

    expect(result.success).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockEmailLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "bounced" })
    );
  });

  /**
   * Validates: Requirement 20.3
   * After all retries fail, creates an in-app notification as fallback.
   */
  it("creates fallback notification after all retries fail", async () => {
    const transientError = new Error("Service unavailable");

    mockSend
      .mockRejectedValueOnce(transientError)
      .mockRejectedValueOnce(transientError)
      .mockRejectedValueOnce(transientError);

    const { sendEmail } = await import("@/lib/services/email");

    await runWithTimers(() =>
      sendEmail({
        to: "user@example.com",
        template: "report_resolution",
        locale: "en",
        data: {},
      })
    );

    // Fallback notification created
    expect(mockUserFindOne).toHaveBeenCalledWith({ email: "user@example.com" });
    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user123",
        type: "security",
        title: expect.stringContaining("Email delivery failed"),
        body: expect.stringContaining("user@example.com"),
      })
    );
  });

  /**
   * Validates: Requirement 20.3
   * Hard bounce does NOT create a fallback notification (only exhausted retries do).
   */
  it("does not create fallback notification on hard bounce", async () => {
    const hardBounceError = Object.assign(new Error("Invalid email"), {
      statusCode: 422,
    });

    mockSend.mockRejectedValueOnce(hardBounceError);

    const { sendEmail } = await import("@/lib/services/email");

    await sendEmail({
      to: "bad@invalid",
      template: "verification",
      locale: "en",
      data: { link: "https://example.com/verify" },
    });

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });
});
