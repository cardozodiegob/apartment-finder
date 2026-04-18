/**
 * Persona fixture loader for the Virtual Team Sprint Runner.
 *
 * Loads each of the 10 Customer_Persona JSON fixtures from this directory,
 * validates them against a Zod schema at module init, and exposes typed
 * accessors. Any fixture that fails validation throws immediately so the
 * sprint runner cannot start with a malformed persona definition.
 *
 * Requirements: 4.1, 4.2, 4.8, 4.9, 4.10, 4.11
 */

import { z } from "zod";

import type { CustomerPersona } from "../types";
import { CUSTOMER_PERSONAS } from "../types";

import adversarialProbe from "./adversarial_probe.json";
import elderlyUser from "./elderly_user.json";
import familyLongTerm from "./family_long_term.json";
import landlordPoster from "./landlord_poster.json";
import mobileSlowNetwork from "./mobile_slow_network.json";
import nonEnglishSpeaker from "./non_english_speaker.json";
import relocatingProfessional from "./relocating_professional.json";
import remoteWorker from "./remote_worker.json";
import screenReaderUser from "./screen_reader_user.json";
import studentSharer from "./student_sharer.json";

// ---------------------------------------------------------------------------
// Supported locales — must match the files present in `messages/`.
// `non_english_speaker` must pick one of the non-`en` values.
// ---------------------------------------------------------------------------

export const SUPPORTED_LOCALES = [
  "en",
  "de",
  "es",
  "fr",
  "it",
  "pt",
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// ---------------------------------------------------------------------------
// Zod schema — single source of truth for the persona fixture shape.
// ---------------------------------------------------------------------------

const viewportSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const networkSchema = z.object({
  downKbps: z.number().positive(),
  rttMs: z.number().nonnegative(),
});

const deviceProfileSchema = z.object({
  viewport: viewportSchema,
  userAgent: z.string().min(1),
  network: networkSchema.optional(),
});

export const personaSchema = z.object({
  name: z.enum(CUSTOMER_PERSONAS),
  goals: z.array(z.string().min(1)).min(1),
  constraints: z.array(z.string().min(1)),
  preferredLocale: z.enum(SUPPORTED_LOCALES),
  deviceProfile: deviceProfileSchema,
  journeyIds: z.array(z.string().min(1)).min(1),
});

/** The validated persona fixture shape. */
export type Persona = z.infer<typeof personaSchema>;

// ---------------------------------------------------------------------------
// Load and validate — evaluated once at module init.
// ---------------------------------------------------------------------------

const RAW_FIXTURES: Readonly<Record<CustomerPersona, unknown>> = Object.freeze({
  student_sharer: studentSharer,
  relocating_professional: relocatingProfessional,
  family_long_term: familyLongTerm,
  remote_worker: remoteWorker,
  landlord_poster: landlordPoster,
  non_english_speaker: nonEnglishSpeaker,
  mobile_slow_network: mobileSlowNetwork,
  screen_reader_user: screenReaderUser,
  adversarial_probe: adversarialProbe,
  elderly_user: elderlyUser,
});

function validateAll(): Readonly<Record<CustomerPersona, Persona>> {
  const out = {} as Record<CustomerPersona, Persona>;
  for (const name of CUSTOMER_PERSONAS) {
    const raw = RAW_FIXTURES[name];
    const parsed = personaSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const path = first?.path.join(".") || "(root)";
      throw new Error(
        `Invalid persona fixture "${name}" at ${path}: ${first?.message ?? "validation failed"}`,
      );
    }
    if (parsed.data.name !== name) {
      throw new Error(
        `Persona fixture "${name}" has mismatched name field "${parsed.data.name}"`,
      );
    }
    // Requirement 4.9: non_english_speaker must not use "en".
    if (name === "non_english_speaker" && parsed.data.preferredLocale === "en") {
      throw new Error(
        `Persona fixture "non_english_speaker" must use a non-"en" preferredLocale`,
      );
    }
    out[name] = Object.freeze(parsed.data) as Persona;
  }
  return Object.freeze(out);
}

/**
 * Frozen map of every validated persona fixture, keyed by
 * {@link CustomerPersona} name. Populated at module init.
 */
export const PERSONA_INDEX: Readonly<Record<CustomerPersona, Persona>> =
  validateAll();

// ---------------------------------------------------------------------------
// Public accessors
// ---------------------------------------------------------------------------

/**
 * Return the validated persona fixture for the given persona name.
 *
 * Throws if the name is not a recognized {@link CustomerPersona}; callers
 * are expected to use the narrow type, but the runtime check guards
 * against bad cross-package data.
 */
export function getPersona(name: CustomerPersona): Persona {
  const persona = PERSONA_INDEX[name];
  if (!persona) {
    throw new Error(`Unknown persona "${name as string}"`);
  }
  return persona;
}

/** Return all 10 validated persona fixtures in {@link CUSTOMER_PERSONAS} order. */
export function getAllPersonas(): readonly Persona[] {
  return CUSTOMER_PERSONAS.map((name) => PERSONA_INDEX[name]);
}
