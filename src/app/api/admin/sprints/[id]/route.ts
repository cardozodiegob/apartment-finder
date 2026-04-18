/**
 * Admin API: GET/PATCH /api/admin/sprints/[id]
 *
 * - `GET` returns the `SprintStatusView` produced by the runner.
 * - `PATCH` accepts `{ action: "start" | "abort", reason? }` and routes
 *   to `SprintRunner.start` or `SprintRunner.abort` respectively.
 *
 * Requirements: 1.3, 1.4, 1.7, 9.3, 9.8
 */

import { z } from "zod";

import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/session";
import { getSharedSprintRunner } from "@/lib/sprint/runner";

import { assertObjectId, mapSprintRunnerError } from "../_helpers";

const patchBodySchema = z.object({
  action: z.enum(["start", "abort"]),
  reason: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// GET — status view
// ---------------------------------------------------------------------------

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAdmin();
    const { id } = await params;
    assertObjectId(id, "sprintId");

    try {
      const view = await getSharedSprintRunner().getStatus(id);
      return Response.json(view);
    } catch (err) {
      mapSprintRunnerError(err);
    }
  } catch (err) {
    return errorResponse(err);
  }
  return errorResponse(
    new ApiErrorResponse("INTERNAL_ERROR", "Unreachable", 500),
  );
}

// ---------------------------------------------------------------------------
// PATCH — start / abort
// ---------------------------------------------------------------------------

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAdmin();
    const { id } = await params;
    assertObjectId(id, "sprintId");

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ApiErrorResponse(
        "VALIDATION",
        "Request body must be valid JSON",
        400,
      );
    }

    const parsed = patchBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new ApiErrorResponse(
        "VALIDATION",
        "Invalid PATCH payload",
        400,
        parsed.error.flatten(),
      );
    }

    const runner = getSharedSprintRunner();
    try {
      if (parsed.data.action === "start") {
        await runner.start(id);
      } else {
        await runner.abort(id, parsed.data.reason);
      }
      return Response.json({ ok: true });
    } catch (err) {
      mapSprintRunnerError(err);
    }
  } catch (err) {
    return errorResponse(err);
  }
  return errorResponse(
    new ApiErrorResponse("INTERNAL_ERROR", "Unreachable", 500),
  );
}
