import { describe, it, expect } from "vitest";
import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";
import type { ApiError } from "@/lib/api/errors";

describe("ApiErrorResponse", () => {
  it("creates an error with code, message, and statusCode", () => {
    const err = new ApiErrorResponse("TEST_ERROR", "Something went wrong", 422);
    expect(err.code).toBe("TEST_ERROR");
    expect(err.message).toBe("Something went wrong");
    expect(err.statusCode).toBe(422);
    expect(err.details).toBeUndefined();
  });

  it("defaults statusCode to 400", () => {
    const err = new ApiErrorResponse("BAD_REQUEST", "Bad input");
    expect(err.statusCode).toBe(400);
  });

  it("includes details in toJSON when provided", () => {
    const details = [{ field: "email", message: "required" }];
    const err = new ApiErrorResponse("VALIDATION_ERROR", "Invalid", 400, details);
    const json = err.toJSON();
    expect(json).toEqual({
      code: "VALIDATION_ERROR",
      message: "Invalid",
      details,
    });
  });

  it("omits details from toJSON when not provided", () => {
    const err = new ApiErrorResponse("NOT_FOUND", "Not found", 404);
    const json = err.toJSON();
    expect(json).toEqual({ code: "NOT_FOUND", message: "Not found" });
    expect("details" in json).toBe(false);
  });
});

describe("errorResponse()", () => {
  it("returns proper Response for ApiErrorResponse", async () => {
    const err = new ApiErrorResponse("AUTH_FAILED", "Unauthorized", 401);
    const res = errorResponse(err);
    expect(res.status).toBe(401);
    const body: ApiError = await res.json();
    expect(body.code).toBe("AUTH_FAILED");
    expect(body.message).toBe("Unauthorized");
  });

  it("returns 500 INTERNAL_ERROR for unknown errors", async () => {
    const res = errorResponse(new Error("kaboom"));
    expect(res.status).toBe(500);
    const body: ApiError = await res.json();
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.message).toBe("An unexpected error occurred");
  });

  it("returns 500 INTERNAL_ERROR for non-Error values", async () => {
    const res = errorResponse("string error");
    expect(res.status).toBe(500);
    const body: ApiError = await res.json();
    expect(body.code).toBe("INTERNAL_ERROR");
  });
});
