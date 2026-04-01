import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock next/server ---

const mockNextResponseJson = vi.fn();
const mockNextResponseNext = vi.fn();

vi.mock("next/server", () => {
  class MockNextRequest {
    method: string;
    headers: Map<string, string>;
    nextUrl: { pathname: string };
    cookies: { get: () => undefined };

    constructor(url: string, init?: { method?: string; headers?: Record<string, string> }) {
      this.method = init?.method ?? "GET";
      this.headers = new Map(Object.entries(init?.headers ?? {}));
      this.nextUrl = { pathname: new URL(url).pathname };
      this.cookies = { get: () => undefined };
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: {
      json: (...args: unknown[]) => {
        mockNextResponseJson(...args);
        return { __type: "json", args };
      },
      next: (...args: unknown[]) => {
        mockNextResponseNext(...args);
        return {
          __type: "next",
          cookies: {
            set: vi.fn(),
          },
        };
      },
    },
  };
});

// --- Mock i18n/request (imported by middleware) ---

vi.mock("@/i18n/request", () => ({
  locales: ["en"],
  defaultLocale: "en",
  parseAcceptLanguage: () => "en",
}));

// --- Import after mocks ---

import { NextRequest } from "next/server";

// --- Helpers ---

const APP_URL = "https://myapp.example.com";

function createRequest(
  path: string,
  method: string,
  headers: Record<string, string> = {}
): InstanceType<typeof NextRequest> {
  return new NextRequest(`${APP_URL}${path}`, { method, headers });
}

// --- Tests ---

describe("CSRF Middleware — Unit Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    process.env.NEXT_PUBLIC_APP_URL = APP_URL;
  });

  /**
   * Validates: Requirement 5.1
   * GET requests to API routes pass through without CSRF checks.
   */
  it("allows GET requests to /api/ without CSRF check", async () => {
    const req = createRequest("/api/listings", "GET");

    const { middleware } = await import("@/middleware");
    middleware(req);

    expect(mockNextResponseNext).toHaveBeenCalled();
    expect(mockNextResponseJson).not.toHaveBeenCalled();
  });

  /**
   * Validates: Requirements 5.1, 5.2
   * POST request with matching Origin header passes through.
   */
  it("allows POST request with matching Origin header", async () => {
    const req = createRequest("/api/listings", "POST", {
      origin: "https://myapp.example.com",
    });

    const { middleware } = await import("@/middleware");
    middleware(req);

    expect(mockNextResponseNext).toHaveBeenCalled();
    expect(mockNextResponseJson).not.toHaveBeenCalled();
  });

  /**
   * Validates: Requirements 5.1, 5.2
   * POST request with mismatched Origin header returns 403.
   */
  it("blocks POST request with mismatched Origin header (403)", async () => {
    const req = createRequest("/api/listings", "POST", {
      origin: "https://evil.example.com",
    });

    const { middleware } = await import("@/middleware");
    middleware(req);

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { code: "CSRF_ERROR", message: "Cross-site request blocked" },
      { status: 403 }
    );
    expect(mockNextResponseNext).not.toHaveBeenCalled();
  });

  /**
   * Validates: Requirement 5.3
   * POST request with no Origin but matching Referer passes through.
   */
  it("allows POST request with no Origin but matching Referer", async () => {
    const req = createRequest("/api/payments", "POST", {
      referer: "https://myapp.example.com/checkout",
    });

    const { middleware } = await import("@/middleware");
    middleware(req);

    expect(mockNextResponseNext).toHaveBeenCalled();
    expect(mockNextResponseJson).not.toHaveBeenCalled();
  });

  /**
   * Validates: Requirement 5.3
   * POST request with no Origin and mismatched Referer returns 403.
   */
  it("blocks POST request with no Origin and mismatched Referer (403)", async () => {
    const req = createRequest("/api/payments", "POST", {
      referer: "https://evil.example.com/phish",
    });

    const { middleware } = await import("@/middleware");
    middleware(req);

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { code: "CSRF_ERROR", message: "Cross-site request blocked" },
      { status: 403 }
    );
    expect(mockNextResponseNext).not.toHaveBeenCalled();
  });

  /**
   * Validates: Requirement 5.3
   * POST request with no Origin and no Referer passes through
   * (same-origin non-browser client).
   */
  it("allows POST request with no Origin and no Referer (non-browser client)", async () => {
    const req = createRequest("/api/listings", "POST");

    const { middleware } = await import("@/middleware");
    middleware(req);

    expect(mockNextResponseNext).toHaveBeenCalled();
    expect(mockNextResponseJson).not.toHaveBeenCalled();
  });

  /**
   * Validates: Requirements 5.1, 5.2
   * PUT request with mismatched Origin returns 403.
   */
  it("blocks PUT request with mismatched Origin (403)", async () => {
    const req = createRequest("/api/listings/123", "PUT", {
      origin: "https://evil.example.com",
    });

    const { middleware } = await import("@/middleware");
    middleware(req);

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { code: "CSRF_ERROR", message: "Cross-site request blocked" },
      { status: 403 }
    );
    expect(mockNextResponseNext).not.toHaveBeenCalled();
  });

  /**
   * Validates: Requirements 5.1, 5.2
   * DELETE request with mismatched Origin returns 403.
   */
  it("blocks DELETE request with mismatched Origin (403)", async () => {
    const req = createRequest("/api/listings/123", "DELETE", {
      origin: "https://evil.example.com",
    });

    const { middleware } = await import("@/middleware");
    middleware(req);

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { code: "CSRF_ERROR", message: "Cross-site request blocked" },
      { status: 403 }
    );
    expect(mockNextResponseNext).not.toHaveBeenCalled();
  });
});
