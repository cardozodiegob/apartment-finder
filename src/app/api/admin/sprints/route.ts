/**
 * Admin API: POST/GET /api/admin/sprints
 *
 * - `POST` creates a new sprint via `SprintRunner.create`. Returns 201
 *   with `{ sprintId }`. Validation / env errors surface as 400,
 *   concurrent-running-sprint as 409.
 * - `GET` returns a paginated list of sprints (newest first) with
 *   per-sprint finding and fix-proposal counts, computed via two
 *   aggregations to avoid an N+1.
 *
 * Requirements: 1.1, 9.1, 9.2, 9.8, 9.9, 12.5, 12.6
 */

import { Types } from "mongoose";
import { z } from "zod";

import { ApiErrorResponse, errorResponse } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/session";
import dbConnect from "@/lib/db/connection";
import FixProposal from "@/lib/db/models/FixProposal";
import Finding from "@/lib/db/models/Finding";
import Sprint from "@/lib/db/models/Sprint";
import { getSharedSprintRunner } from "@/lib/sprint/runner";
import {
  AGENT_ROLES,
  CUSTOMER_PERSONAS,
  FINDING_SEVERITIES,
  FIX_STATUSES,
  SPRINT_STATUSES,
  type FindingSeverity,
  type FixStatus,
} from "@/lib/sprint/types";

import { mapSprintRunnerError } from "./_helpers";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createBodySchema = z.object({
  roles: z.array(z.enum(AGENT_ROLES)).min(1),
  personas: z.array(z.enum(CUSTOMER_PERSONAS)).min(0),
  durationMinutes: z.number().int().min(5).max(240),
  goals: z.array(z.string().min(1).max(500)).min(1).max(20),
  currentBranchAtStart: z.string().min(1).max(200),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(SPRINT_STATUSES).optional(),
});

// ---------------------------------------------------------------------------
// POST — create sprint
// ---------------------------------------------------------------------------

export async function POST(req: Request): Promise<Response> {
  try {
    const admin = await requireAdmin();

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

    const parsed = createBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new ApiErrorResponse(
        "VALIDATION",
        "Invalid sprint creation payload",
        400,
        parsed.error.flatten(),
      );
    }

    try {
      const sprintId = await getSharedSprintRunner().create({
        roles: parsed.data.roles,
        personas: parsed.data.personas,
        durationMinutes: parsed.data.durationMinutes,
        goals: parsed.data.goals,
        createdBy: admin.mongoId,
        currentBranchAtStart: parsed.data.currentBranchAtStart,
      });
      return Response.json({ sprintId }, { status: 201 });
    } catch (err) {
      mapSprintRunnerError(err);
    }
  } catch (err) {
    return errorResponse(err);
  }
  // Unreachable: mapSprintRunnerError always throws.
  return errorResponse(
    new ApiErrorResponse("INTERNAL_ERROR", "Unreachable", 500),
  );
}

// ---------------------------------------------------------------------------
// GET — paginated list with finding + fix counts
// ---------------------------------------------------------------------------

interface FindingCountRow {
  _id: { sprintId: Types.ObjectId; severity: FindingSeverity };
  count: number;
}

interface FixCountRow {
  _id: { sprintId: Types.ObjectId; status: FixStatus };
  count: number;
}

export async function GET(req: Request): Promise<Response> {
  try {
    await requireAdmin();
    await dbConnect();

    const url = new URL(req.url);
    const queryParsed = listQuerySchema.safeParse(
      Object.fromEntries(url.searchParams),
    );
    if (!queryParsed.success) {
      throw new ApiErrorResponse(
        "VALIDATION",
        "Invalid list query parameters",
        400,
        queryParsed.error.flatten(),
      );
    }
    const { page, pageSize, status } = queryParsed.data;

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    const [total, sprints] = await Promise.all([
      Sprint.countDocuments(filter),
      Sprint.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    const sprintIds = sprints.map((s) => s._id);

    // Two aggregations instead of 2*N per-sprint count queries.
    const [findingRows, fixRows]: [FindingCountRow[], FixCountRow[]] =
      sprintIds.length === 0
        ? [[], []]
        : await Promise.all([
            Finding.aggregate<FindingCountRow>([
              { $match: { sprintId: { $in: sprintIds } } },
              {
                $group: {
                  _id: { sprintId: "$sprintId", severity: "$severity" },
                  count: { $sum: 1 },
                },
              },
            ]),
            FixProposal.aggregate<FixCountRow>([
              { $match: { sprintId: { $in: sprintIds } } },
              {
                $group: {
                  _id: { sprintId: "$sprintId", status: "$status" },
                  count: { $sum: 1 },
                },
              },
            ]),
          ]);

    const zeroFindings = (): Record<FindingSeverity, number> =>
      FINDING_SEVERITIES.reduce(
        (acc, s) => ((acc[s] = 0), acc),
        {} as Record<FindingSeverity, number>,
      );
    const zeroFixes = (): Record<FixStatus, number> =>
      FIX_STATUSES.reduce(
        (acc, s) => ((acc[s] = 0), acc),
        {} as Record<FixStatus, number>,
      );

    const findingBySprint = new Map<
      string,
      { total: number; bySeverity: Record<FindingSeverity, number> }
    >();
    for (const row of findingRows) {
      const key = row._id.sprintId.toHexString();
      const entry =
        findingBySprint.get(key) ??
        { total: 0, bySeverity: zeroFindings() };
      entry.total += row.count;
      entry.bySeverity[row._id.severity] += row.count;
      findingBySprint.set(key, entry);
    }

    const fixBySprint = new Map<
      string,
      { total: number; byStatus: Record<FixStatus, number> }
    >();
    for (const row of fixRows) {
      const key = row._id.sprintId.toHexString();
      const entry =
        fixBySprint.get(key) ?? { total: 0, byStatus: zeroFixes() };
      entry.total += row.count;
      entry.byStatus[row._id.status] += row.count;
      fixBySprint.set(key, entry);
    }

    const items = sprints.map((s) => {
      const sid = s._id.toHexString();
      return {
        sprintId: sid,
        status: s.status,
        result: s.result,
        goals: s.goals,
        durationMinutes: s.durationMinutes,
        createdAt: s.createdAt,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        abortedAt: s.abortedAt,
        abortReason: s.abortReason,
        createdBy: s.createdBy?.toString(),
        findingCounts:
          findingBySprint.get(sid) ??
          { total: 0, bySeverity: zeroFindings() },
        fixCounts: fixBySprint.get(sid) ?? { total: 0, byStatus: zeroFixes() },
      };
    });

    return Response.json({ items, total, page, pageSize });
  } catch (err) {
    return errorResponse(err);
  }
}
