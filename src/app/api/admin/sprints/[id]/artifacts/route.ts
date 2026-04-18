/**
 * Admin API: GET /api/admin/sprints/[id]/artifacts
 *
 * Three response modes, picked by query string:
 *
 *   - `?doc=plan|log|findings|retrospective` — return the rendered
 *     markdown of one shared doc as `{ doc, content }`. An
 *     uninitialized workspace returns `content: ""` rather than 404 so
 *     early-`pending` sprints don't 404 in the UI.
 *   - `?download=actionLog` — stream every `SprintActionLog` entry for
 *     the sprint as a JSON attachment.
 *   - neither — return a summary listing the known shared docs with
 *     their byte length and cumulative hash prefix (when available).
 *
 * Requirements: 9.3, 13.5
 */

import { Types } from "mongoose";

import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/session";
import dbConnect from "@/lib/db/connection";
import SprintActionLog from "@/lib/db/models/SprintActionLog";
import { WorkspaceError, createWorkspaceWriter } from "@/lib/sprint/workspace";

import { assertObjectId } from "../../_helpers";

// ---------------------------------------------------------------------------
// Known shared docs surfaced by this endpoint.
// ---------------------------------------------------------------------------

const SHARED_DOCS = [
  "plan",
  "log",
  "findings",
  "retrospective",
] as const;
type SharedDoc = (typeof SHARED_DOCS)[number];

function isSharedDoc(value: string): value is SharedDoc {
  return (SHARED_DOCS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAdmin();
    const { id: sprintId } = await params;
    assertObjectId(sprintId, "sprintId");

    const url = new URL(req.url);
    const download = url.searchParams.get("download");
    const doc = url.searchParams.get("doc");

    // --- action log download ---------------------------------------------
    if (download === "actionLog") {
      await dbConnect();
      const entries = await SprintActionLog.find({
        sprintId: new Types.ObjectId(sprintId),
      })
        .sort({ timestamp: 1 })
        .lean();

      const body = JSON.stringify(entries, null, 2);
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="sprint-${sprintId}-action-log.json"`,
        },
      });
    }

    const writer = createWorkspaceWriter(sprintId);

    // --- single-doc read --------------------------------------------------
    if (doc !== null) {
      if (!isSharedDoc(doc)) {
        throw new ApiErrorResponse(
          "VALIDATION",
          `Unknown doc "${doc}"; expected one of ${SHARED_DOCS.join(", ")}`,
          400,
        );
      }
      try {
        const content = await writer.read(`${doc}.md`);
        return Response.json({ doc, content });
      } catch (err) {
        // Workspace not yet initialized: return an empty doc rather than
        // a hard 404 so the UI can render an "empty" state.
        if (
          err instanceof WorkspaceError &&
          err.code === "NOT_INITIALIZED"
        ) {
          return Response.json({ doc, content: "" });
        }
        throw err;
      }
    }

    // --- summary listing --------------------------------------------------
    const docs = await Promise.all(
      SHARED_DOCS.map(async (name) => {
        try {
          const content = await writer.read(`${name}.md`);
          return {
            name,
            byteLength: Buffer.byteLength(content, "utf8"),
          };
        } catch (err) {
          if (
            err instanceof WorkspaceError &&
            err.code === "NOT_INITIALIZED"
          ) {
            return { name, byteLength: 0 };
          }
          throw err;
        }
      }),
    );

    return Response.json({ docs });
  } catch (err) {
    return errorResponse(err);
  }
}
