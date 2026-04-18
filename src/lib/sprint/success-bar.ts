/**
 * Success-bar classifier for the sprint retrospective.
 *
 * Requirement 10.5 defines seven thresholds that a sprint must satisfy
 * simultaneously to earn the `met_success_bar` verdict. This module is a
 * pure conjunction over those thresholds; it reports back either
 * `"met_success_bar"` with an empty `missedThresholds` array, or
 * `"below_success_bar"` with an array naming each threshold that failed.
 *
 * Requirements: 10.2, 10.5, 10.6, 10.7
 */

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * Per-persona critical-journey completion tracker. `completed` must equal
 * `total` for every selected persona to satisfy threshold 3.
 */
export interface CriticalJourneyProgress {
  readonly total: number;
  readonly completed: number;
}

/**
 * Lighthouse scores for a single page. All four scores must be >= 90 on
 * every page in {@link SprintMetrics.lighthouseScores} to satisfy
 * threshold 4.
 */
export interface LighthousePageScores {
  readonly page: string;
  readonly performance: number;
  readonly accessibility: number;
  readonly bestPractices: number;
  readonly seo: number;
}

/** Bundle passed to {@link classifyResult}. */
export interface SprintMetrics {
  /** Test suite pass rate as a fraction in [0, 1]. Must equal 1.0 exactly. */
  readonly testPassRate: number;

  /** Findings with category=`security` AND severity in {high, critical}. Must be 0. */
  readonly highOrCriticalSecurityFindings: number;

  /**
   * Per-persona critical-journey completion. Every selected persona must
   * have completed === total (Requirement 10.5 threshold 3). Keys are
   * persona identifiers; values are progress counters.
   */
  readonly criticalJourneysCompletedByPersona: Readonly<
    Record<string, CriticalJourneyProgress>
  >;

  /** Lighthouse scores per audited page. Each page must score >= 90 on all four axes. */
  readonly lighthouseScores: readonly LighthousePageScores[];

  /** Regressions compared to the previous completed sprint. Must be 0. */
  readonly regressionCount: number;

  /** WCAG 2.1 AA violations from axe-core. Must be 0. */
  readonly wcagViolationCount: number;

  /** Retrospective.md exists and is non-empty at sprint close. */
  readonly retrospectiveWritten: boolean;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

/** Tag for each threshold that may fail, enumerated in Requirement 10.5 order. */
export type MissedThreshold =
  | "test_pass_rate"
  | "security_high_critical"
  | "critical_journeys_incomplete"
  | "lighthouse_below_90"
  | "regressions_present"
  | "wcag_violations_present"
  | "retrospective_missing";

/** Matches the `SprintResult` union from types.ts (non-undefined variants). */
export type ClassifiedSprintResult =
  | "met_success_bar"
  | "below_success_bar";

export interface ClassifyResult {
  readonly result: ClassifiedSprintResult;
  readonly missedThresholds: readonly MissedThreshold[];
}

// ---------------------------------------------------------------------------
// Threshold evaluators
//
// Each helper is pure and exported so that the retrospective writer can
// include threshold-specific diagnostics in the generated markdown.
// ---------------------------------------------------------------------------

const LIGHTHOUSE_MIN_SCORE = 90;

function failsTestPassRate(m: SprintMetrics): boolean {
  // testPassRate must equal exactly 1.0 (100%). Use === to reject 0.999...
  return !(m.testPassRate === 1);
}

function failsSecurityThreshold(m: SprintMetrics): boolean {
  return m.highOrCriticalSecurityFindings > 0;
}

function failsCriticalJourneys(m: SprintMetrics): boolean {
  for (const progress of Object.values(m.criticalJourneysCompletedByPersona)) {
    if (progress.completed !== progress.total) return true;
  }
  return false;
}

function failsLighthouse(m: SprintMetrics): boolean {
  for (const page of m.lighthouseScores) {
    if (
      page.performance < LIGHTHOUSE_MIN_SCORE ||
      page.accessibility < LIGHTHOUSE_MIN_SCORE ||
      page.bestPractices < LIGHTHOUSE_MIN_SCORE ||
      page.seo < LIGHTHOUSE_MIN_SCORE
    ) {
      return true;
    }
  }
  return false;
}

function failsRegressions(m: SprintMetrics): boolean {
  return m.regressionCount > 0;
}

function failsWcag(m: SprintMetrics): boolean {
  return m.wcagViolationCount > 0;
}

function failsRetrospective(m: SprintMetrics): boolean {
  return m.retrospectiveWritten !== true;
}

// ---------------------------------------------------------------------------
// classifyResult
// ---------------------------------------------------------------------------

/**
 * Evaluate the seven success-bar thresholds. The order of the returned
 * `missedThresholds` array matches the threshold numbering in the
 * requirements document (1..7) so downstream template rendering is
 * predictable.
 */
export function classifyResult(m: SprintMetrics): ClassifyResult {
  const missed: MissedThreshold[] = [];

  if (failsTestPassRate(m)) missed.push("test_pass_rate");
  if (failsSecurityThreshold(m)) missed.push("security_high_critical");
  if (failsCriticalJourneys(m)) missed.push("critical_journeys_incomplete");
  if (failsLighthouse(m)) missed.push("lighthouse_below_90");
  if (failsRegressions(m)) missed.push("regressions_present");
  if (failsWcag(m)) missed.push("wcag_violations_present");
  if (failsRetrospective(m)) missed.push("retrospective_missing");

  return {
    result: missed.length === 0 ? "met_success_bar" : "below_success_bar",
    missedThresholds: missed,
  };
}
