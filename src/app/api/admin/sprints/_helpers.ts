/**
 * Shared helpers for the `/api/admin/sprints/*` admin routes.
 *
 * The sprint runner throws a `SprintRunnerError` tagged with one of a
 * small set of codes; the HTTP layer converts each code to the right
 * status/body using `ApiErrorResponse`. Putting the mapping in one place
 * keeps the route files short and consistent.
 */

import { Types } from "mongoose";

import { ApiErrorResponse } from "@/lib/api/errors";
import { GitSafetyError } from "@/lib/sprint/git";
import { SprintRunnerError } from "@/lib/sprint/runner";

/**
 * Re-throw `SprintRunnerError` (and a couple of related domain errors)
 * as `ApiErrorResponse` with the right status code. Anything else is
 * rethrown untouched so `errorResponse()` can fall back to a 500.
 */
export function mapSprintRunnerError(err: unknown): never {
  if (err instanceof SprintRunnerError) {
    switch (err.code) {
      case "VALIDATION":
        throw new ApiErrorResponse("VALIDATION", err.message, 400);
      case "ENV_MISSING":
        throw new ApiErrorResponse("ENV_MISSING", err.message, 400);
      case "CONCURRENT_SPRINT":
        throw new ApiErrorResponse("CONCURRENT_SPRINT", err.message, 409);
      case "NOT_FOUND":
        throw new ApiErrorResponse("NOT_FOUND", err.message, 404);
      case "ILLEGAL_TRANSITION":
        throw new ApiErrorResponse("ILLEGAL_TRANSITION", err.message, 409);
      case "START_GUARD":
        throw new ApiErrorResponse("START_GUARD", err.message, 409);
    }
  }

  if (err instanceof GitSafetyError) {
    throw new ApiErrorResponse(
      "GIT_SAFETY_VIOLATION",
      err.message,
      409,
      { attempted: err.sprintError.attempted },
    );
  }

  throw err;
}

/**
 * Validate that a string is a 24-char Mongo ObjectId; throw a 400
 * `ApiErrorResponse` otherwise. Use inside route handlers for the
 * `[id]` path segment.
 */
export function assertObjectId(id: string, field = "id"): void {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiErrorResponse(
      "VALIDATION",
      `Invalid ${field}: must be a 24-char hex ObjectId`,
      400,
    );
  }
}
