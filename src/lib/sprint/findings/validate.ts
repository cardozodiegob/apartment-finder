/**
 * Zod validation for Finding emission inputs.
 *
 * The rule layer rejects any Finding missing `category`, `severity`,
 * `title`, `description`, or `reproductionSteps` (Requirement 5.6). A
 * rejected Finding is logged to `log.md` and does NOT count toward the
 * sprint's finding totals; the tool executor is responsible for that
 * side-effect — this module only provides the schema.
 *
 * Requirements: 5.1, 5.6
 */

import { z } from "zod";

import {
  AGENT_ROLES,
  CUSTOMER_PERSONAS,
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
} from "../types";

/**
 * Shape accepted by the `findings.emit` tool. The reporter must be
 * identified as either an agent role OR a customer persona; both may
 * not be set simultaneously, and at least one must be present.
 */
export const findingInputSchema = z
  .object({
    category: z.enum(FINDING_CATEGORIES),
    severity: z.enum(FINDING_SEVERITIES),
    title: z.string().trim().min(1, "title must be a non-empty string"),
    description: z
      .string()
      .trim()
      .min(1, "description must be a non-empty string"),
    reproductionSteps: z
      .array(z.string().trim().min(1, "reproduction step must be non-empty"))
      .min(1, "reproductionSteps must contain at least one step"),
    evidenceUrls: z.array(z.string().url("evidence must be a URL")).default([]),
    reporterAgentRole: z.enum(AGENT_ROLES).optional(),
    reporterPersona: z.enum(CUSTOMER_PERSONAS).optional(),
  })
  .superRefine((val, ctx) => {
    const hasAgent = val.reporterAgentRole !== undefined;
    const hasPersona = val.reporterPersona !== undefined;
    if (!hasAgent && !hasPersona) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "finding must identify either reporterAgentRole or reporterPersona",
        path: ["reporterAgentRole"],
      });
    }
    if (hasAgent && hasPersona) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "finding must not set both reporterAgentRole and reporterPersona",
        path: ["reporterPersona"],
      });
    }
  });

/** Validated input shape. */
export type FindingInput = z.infer<typeof findingInputSchema>;
