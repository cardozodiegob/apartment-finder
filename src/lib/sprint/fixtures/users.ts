/**
 * Test-database user fixtures for the sprint runner.
 *
 * Provides one `seeker` user per customer persona plus one `admin` user.
 * The password hash is NOT a real bcrypt hash — `bcrypt` is not a repo
 * dependency, and these fixtures only ever exist in the sprint-owned test
 * database. The hash is marked with a `TEST_HASH_` prefix so it cannot
 * accidentally be mistaken for a real credential in logs.
 *
 * Requirements: 12.2
 */

import { createHash } from "node:crypto";

import type { CustomerPersona } from "../types";
import { CUSTOMER_PERSONAS } from "../types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A plain-object user fixture. The shape mirrors `IUser` from
 * `src/lib/db/models/User.ts` — every required schema field is present so
 * `upsert: true` writes succeed on a fresh test database.
 */
export interface UserFixture {
  /** Stable identifier — used as the upsert key via the `email` field. */
  readonly email: string;
  readonly supabaseId: string;
  readonly fullName: string;
  readonly role: "seeker" | "poster" | "admin";
  readonly passwordHash: string;
  readonly preferredLanguage: "en" | "es" | "fr" | "de" | "pt" | "it";
  readonly preferredCurrency: "EUR" | "USD" | "GBP";
  readonly emailVerified: boolean;
  readonly idVerified: boolean;
  readonly profileCompleted: boolean;
  readonly bio: string;
  /** Persona label for traceability; not required by the User schema. */
  readonly fixturePersona: CustomerPersona | "admin";
}

// ---------------------------------------------------------------------------
// Password hash — fixture-only, NOT a real bcrypt hash
// ---------------------------------------------------------------------------

const FIXTURE_PASSWORD = "sprint-test-password";

/**
 * Deterministic SHA-256 of the fixture password, prefixed so it is
 * obviously not a real credential. Used as the `passwordHash` field on
 * every test user. We would use bcrypt here but it is not a repo
 * dependency and adding it for fixture data alone is not worth the
 * build-system churn.
 */
const FIXTURE_PASSWORD_HASH: string = (() => {
  const digest = createHash("sha256").update(FIXTURE_PASSWORD).digest("hex");
  return `TEST_HASH_sha256_${digest}`;
})();

// ---------------------------------------------------------------------------
// Per-persona language and currency defaults
// ---------------------------------------------------------------------------

const PERSONA_LANGUAGE: Record<CustomerPersona, UserFixture["preferredLanguage"]> =
  {
    student_sharer: "en",
    relocating_professional: "en",
    family_long_term: "de",
    remote_worker: "en",
    landlord_poster: "en",
    non_english_speaker: "es",
    mobile_slow_network: "pt",
    screen_reader_user: "en",
    adversarial_probe: "en",
    elderly_user: "it",
  };

const PERSONA_CURRENCY: Record<CustomerPersona, UserFixture["preferredCurrency"]> =
  {
    student_sharer: "EUR",
    relocating_professional: "EUR",
    family_long_term: "EUR",
    remote_worker: "USD",
    landlord_poster: "EUR",
    non_english_speaker: "EUR",
    mobile_slow_network: "EUR",
    screen_reader_user: "GBP",
    adversarial_probe: "EUR",
    elderly_user: "EUR",
  };

const PERSONA_ROLE: Record<CustomerPersona, "seeker" | "poster"> = {
  student_sharer: "seeker",
  relocating_professional: "seeker",
  family_long_term: "seeker",
  remote_worker: "seeker",
  landlord_poster: "poster",
  non_english_speaker: "seeker",
  mobile_slow_network: "seeker",
  screen_reader_user: "seeker",
  adversarial_probe: "seeker",
  elderly_user: "seeker",
};

function humanize(persona: CustomerPersona): string {
  return persona
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Fixture builder
// ---------------------------------------------------------------------------

/**
 * Build the full set of user fixtures (10 personas + 1 admin).
 *
 * Emails take the form `<persona>@sprint-test.local` so the upsert key is
 * stable across reseeds.
 */
export function buildUserFixtures(): UserFixture[] {
  const users: UserFixture[] = CUSTOMER_PERSONAS.map((persona) => ({
    email: `${persona}@sprint-test.local`,
    supabaseId: `sprint-test-${persona}`,
    fullName: humanize(persona),
    role: PERSONA_ROLE[persona],
    passwordHash: FIXTURE_PASSWORD_HASH,
    preferredLanguage: PERSONA_LANGUAGE[persona],
    preferredCurrency: PERSONA_CURRENCY[persona],
    emailVerified: true,
    idVerified: persona === "landlord_poster",
    profileCompleted: true,
    bio: `Fixture user for the "${humanize(persona)}" persona.`,
    fixturePersona: persona,
  }));

  users.push({
    email: "admin@sprint-test.local",
    supabaseId: "sprint-test-admin",
    fullName: "Sprint Admin",
    role: "admin",
    passwordHash: FIXTURE_PASSWORD_HASH,
    preferredLanguage: "en",
    preferredCurrency: "EUR",
    emailVerified: true,
    idVerified: true,
    profileCompleted: true,
    bio: "Fixture admin user for sprint test runs.",
    fixturePersona: "admin",
  });

  return users;
}

/** The plaintext password whose hash is stored on every fixture user. */
export const FIXTURE_USER_PASSWORD = FIXTURE_PASSWORD;
