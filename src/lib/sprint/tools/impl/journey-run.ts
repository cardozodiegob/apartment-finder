/**
 * `journey.run` tool — thin wrapper around the Journey_Runner.
 *
 * Resolves a `journeyId` against the in-file {@link JOURNEY_DEFINITIONS}
 * registry, merges it with the requested persona, and runs it against
 * the isolated test app instance. Findings emitted by the journey flow
 * through `findings.emit` (the same validated pipeline agents use) so
 * dedup, notification, and audit-log rules apply uniformly.
 *
 * Requirements: 4.3, 4.10, 10.3
 */

import { z } from "zod";

import { loadSprintEnv } from "@/lib/sprint/env";
import { getPersona } from "@/lib/sprint/personas";
import {
  CUSTOMER_PERSONAS,
  type CustomerPersona,
} from "@/lib/sprint/types";
import {
  createJourneyRunner,
  type Journey,
  type JourneyContext,
  type JourneyResult,
} from "@/lib/sprint/journey/runner";

import type { ToolDefinition, ToolRunContext } from "../executor";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const paramsSchema = z.object({
  persona: z.enum(CUSTOMER_PERSONAS),
  journeyId: z.string().trim().min(1),
});

export type JourneyRunParams = z.infer<typeof paramsSchema>;

export interface JourneyRunOutput {
  journeyId: string;
  persona: CustomerPersona;
  status: JourneyResult["status"];
  stepCount: number;
  findingsEmitted: number;
  browsersUnavailable?: boolean;
  fallbackNote?: string;
}

// ---------------------------------------------------------------------------
// Journey registry — small, deliberate v1 set. The design's integration
// test harness (task 9.1) will drive a richer set later.
// ---------------------------------------------------------------------------

type RegistryJourney = Omit<Journey, "persona">;

export const JOURNEY_DEFINITIONS: Readonly<Record<string, RegistryJourney>> =
  Object.freeze({
    "search-apartments": {
      id: "search-apartments",
      critical: false,
      bulk: false,
      steps: [
        {
          id: "homepage-reachable",
          mode: "api",
          description: "Homepage responds with 200",
          severity: "medium",
          request: { method: "GET", path: "/" },
          expect: { status: 200 },
        },
        {
          id: "listings-list",
          mode: "api",
          description: "Public listings endpoint returns 200",
          severity: "high",
          request: { method: "GET", path: "/api/listings" },
          expect: { status: 200 },
        },
      ],
    },
    "view-listing-detail": {
      id: "view-listing-detail",
      critical: false,
      bulk: false,
      steps: [
        {
          id: "listings-index",
          mode: "api",
          description: "Fetch listings index to locate a real id",
          severity: "medium",
          request: { method: "GET", path: "/api/listings" },
          expect: { status: 200 },
        },
        {
          id: "listing-detail-known-placeholder",
          mode: "api",
          description: "Detail endpoint returns 200/404 (not 500) for any id",
          severity: "high",
          request: {
            method: "GET",
            path: "/api/listings/000000000000000000000000",
          },
          expect: { statusIn: [200, 400, 404] },
        },
      ],
    },
    "unauth-admin-probe": {
      id: "unauth-admin-probe",
      critical: false,
      bulk: false,
      steps: [
        {
          id: "admin-dashboard-blocked",
          mode: "api",
          description: "Unauthenticated admin dashboard request must be rejected",
          severity: "critical",
          request: { method: "GET", path: "/api/admin/dashboard" },
          expect: { statusIn: [401, 403] },
        },
        {
          id: "admin-users-blocked",
          mode: "api",
          description: "Unauthenticated admin users list must be rejected",
          severity: "critical",
          request: { method: "GET", path: "/api/admin/users" },
          expect: { statusIn: [401, 403] },
        },
      ],
    },
    "axe-accessibility-sweep": {
      id: "axe-accessibility-sweep",
      critical: false,
      bulk: false,
      steps: [
        {
          id: "axe-home",
          mode: "browser",
          description: "Run axe-core on the homepage",
          severity: "medium",
          playwright: {
            actions: [{ kind: "goto", url: "/" }],
            axeCheck: true,
          },
        },
        {
          id: "axe-search",
          mode: "browser",
          description: "Run axe-core on the search page",
          severity: "medium",
          playwright: {
            actions: [{ kind: "goto", url: "/search" }],
            axeCheck: true,
          },
        },
      ],
    },
  });

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const journeyRunToolDef: ToolDefinition<
  JourneyRunParams,
  JourneyRunOutput
> = {
  name: "journey.run",
  schema: paramsSchema,
  async run(params, ctx: ToolRunContext): Promise<JourneyRunOutput> {
    // Validate persona exists (throws for cross-package bad data).
    getPersona(params.persona);

    const template = JOURNEY_DEFINITIONS[params.journeyId];
    if (!template) {
      throw new Error(
        `Unknown journeyId "${params.journeyId}" — known: ${Object.keys(JOURNEY_DEFINITIONS).join(", ")}`,
      );
    }

    const env = loadSprintEnv();

    const journey: Journey = {
      ...template,
      persona: params.persona,
    };

    const journeyCtx: JourneyContext = {
      baseUrl: env.SPRINT_TEST_BASE_URL,
      locale: "en",
      toolCtx: ctx,
    };

    const runner = createJourneyRunner();
    const result = await runner.run(journey, journeyCtx);

    return {
      journeyId: result.journeyId,
      persona: result.persona,
      status: result.status,
      stepCount: result.stepResults.length,
      findingsEmitted: result.findings.length,
      ...(result.browsersUnavailable ? { browsersUnavailable: true } : {}),
      ...(result.fallbackNote ? { fallbackNote: result.fallbackNote } : {}),
    };
  },
};
