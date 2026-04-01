import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for scam review API routes
 * Validates: Requirements 21.3, 21.4
 */

// --- Mocks ---

vi.mock("@/lib/db/connection", () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

const mockFindByIdAndUpdate = vi.fn();
const mockNotificationCreate = vi.fn();

vi.mock("@/lib/db/models/Listing", () => ({
  default: {
    findByIdAndUpdate: (...args: unknown[]) => mockFindByIdAndUpdate(...args),
  },
}));

vi.mock("@/lib/db/models/Notification", () => ({
  default: {
    create: (...args: unknown[]) => mockNotificationCreate(...args),
  },
}));

vi.mock("@/lib/api/session", () => ({
  requireAdmin: vi.fn().mockResolvedValue({
    supabaseId: "admin-supa-id",
    mongoId: "admin-mongo-id",
    email: "admin@test.com",
    role: "admin",
    isSuspended: false,
  }),
}));

vi.mock("@/lib/api/admin-middleware", () => ({
  logModerationAction: vi.fn().mockResolvedValue(undefined),
}));

// --- Tests ---

describe("Scam Review API — Unit Tests", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    // Re-apply default mock for requireAdmin after reset
    const { requireAdmin } = vi.mocked(
      await import("@/lib/api/session")
    );
    requireAdmin.mockResolvedValue({
      supabaseId: "admin-supa-id",
      mongoId: "admin-mongo-id",
      email: "admin@test.com",
      role: "admin" as const,
      isSuspended: false,
    });

    const { logModerationAction } = vi.mocked(
      await import("@/lib/api/admin-middleware")
    );
    logModerationAction.mockResolvedValue(undefined);
  });

  /**
   * Validates: Requirement 21.3
   * Approve sets status to "active" and scamRiskLevel to "low".
   */
  it("approve sets status to active and scamRiskLevel to low", async () => {
    const updatedListing = {
      _id: "listing-1",
      title: "Test Listing",
      status: "active",
      scamRiskLevel: "low",
      posterId: "poster-1",
    };
    mockFindByIdAndUpdate.mockResolvedValue(updatedListing);

    const { POST } = await import(
      "@/app/api/admin/scam-review/[id]/approve/route"
    );

    const request = new Request("http://localhost/api/admin/scam-review/listing-1/approve", {
      method: "POST",
    });

    const response = await POST(request as never, {
      params: Promise.resolve({ id: "listing-1" }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.listing.status).toBe("active");
    expect(data.listing.scamRiskLevel).toBe("low");
    expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
      "listing-1",
      { status: "active", scamRiskLevel: "low" },
      { new: true }
    );
  });

  /**
   * Validates: Requirement 21.4
   * Reject archives the listing and creates a notification for the poster.
   */
  it("reject archives listing and creates notification", async () => {
    const archivedListing = {
      _id: "listing-2",
      title: "Suspicious Listing",
      status: "archived",
      posterId: "poster-2",
    };
    mockFindByIdAndUpdate.mockResolvedValue(archivedListing);
    mockNotificationCreate.mockResolvedValue({});

    const { POST } = await import(
      "@/app/api/admin/scam-review/[id]/reject/route"
    );

    const request = new Request("http://localhost/api/admin/scam-review/listing-2/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Duplicate photos from known scammer" }),
    });

    const response = await POST(request as never, {
      params: Promise.resolve({ id: "listing-2" }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.listing.status).toBe("archived");
    expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
      "listing-2",
      { status: "archived" },
      { new: true }
    );
    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "poster-2",
        type: "listing_status",
        title: "Listing Rejected",
        body: expect.stringContaining("Duplicate photos from known scammer"),
        metadata: expect.objectContaining({
          listingId: "listing-2",
          reason: "Duplicate photos from known scammer",
        }),
      })
    );
  });

  /**
   * Validates: Requirement 21.4
   * Reject uses default reason when none is provided.
   */
  it("reject uses default reason when none provided", async () => {
    const archivedListing = {
      _id: "listing-3",
      title: "Another Listing",
      status: "archived",
      posterId: "poster-3",
    };
    mockFindByIdAndUpdate.mockResolvedValue(archivedListing);
    mockNotificationCreate.mockResolvedValue({});

    const { POST } = await import(
      "@/app/api/admin/scam-review/[id]/reject/route"
    );

    const request = new Request("http://localhost/api/admin/scam-review/listing-3/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request as never, {
      params: Promise.resolve({ id: "listing-3" }),
    });

    expect(response.status).toBe(200);
    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("Listing rejected after scam review"),
      })
    );
  });

  /**
   * Validates: Requirement 21.3
   * Approve returns 404 when listing is not found.
   */
  it("approve returns 404 when listing not found", async () => {
    mockFindByIdAndUpdate.mockResolvedValue(null);

    const { POST } = await import(
      "@/app/api/admin/scam-review/[id]/approve/route"
    );

    const request = new Request("http://localhost/api/admin/scam-review/nonexistent/approve", {
      method: "POST",
    });

    const response = await POST(request as never, {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(response.status).toBe(404);
  });

  /**
   * Validates: Requirement 21.4
   * Reject returns 404 when listing is not found.
   */
  it("reject returns 404 when listing not found", async () => {
    mockFindByIdAndUpdate.mockResolvedValue(null);

    const { POST } = await import(
      "@/app/api/admin/scam-review/[id]/reject/route"
    );

    const request = new Request("http://localhost/api/admin/scam-review/nonexistent/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "test" }),
    });

    const response = await POST(request as never, {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(response.status).toBe(404);
  });
});
