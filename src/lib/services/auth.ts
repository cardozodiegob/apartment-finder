import { supabaseAdmin } from "@/lib/supabase/server";
import { supabase } from "@/lib/supabase/client";
import User from "@/lib/db/models/User";
import { registerSchema, loginSchema } from "@/lib/validations/auth";
import type { RegisterInput } from "@/lib/validations/auth";
import type { OAuthProvider } from "@/lib/supabase/types";
import type { Session, User as SupabaseUser, AuthError } from "@supabase/supabase-js";

// --- Account lockout tracking (in-memory) ---

interface LockoutEntry {
  failedAttempts: number;
  lockedUntil: number | null; // epoch ms
}

const lockoutMap = new Map<string, LockoutEntry>();

const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export function _getLockoutMap(): Map<string, LockoutEntry> {
  return lockoutMap;
}

function isAccountLocked(email: string): boolean {
  const entry = lockoutMap.get(email);
  if (!entry || entry.lockedUntil === null) return false;
  if (Date.now() < entry.lockedUntil) return true;
  // Lock expired — reset
  lockoutMap.delete(email);
  return false;
}

function recordFailedAttempt(email: string): boolean {
  const entry = lockoutMap.get(email) ?? { failedAttempts: 0, lockedUntil: null };
  entry.failedAttempts += 1;
  if (entry.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    lockoutMap.set(email, entry);
    return true; // now locked
  }
  lockoutMap.set(email, entry);
  return false;
}

function clearFailedAttempts(email: string): void {
  lockoutMap.delete(email);
}

// --- Auth result type ---

export interface AuthServiceResult {
  user: SupabaseUser | null;
  error: string | null;
}

// --- Auth Service ---

export async function register(data: RegisterInput): Promise<AuthServiceResult> {
  const parsed = registerSchema.safeParse(data);
  if (!parsed.success) {
    return { user: null, error: parsed.error.errors[0].message };
  }

  const { email, password, fullName, preferredLanguage } = parsed.data;

  // Create user in Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  });

  if (authError) {
    if (authError.message?.toLowerCase().includes("already")) {
      return { user: null, error: "This email is already registered" };
    }
    return { user: null, error: authError.message };
  }

  const supabaseUser = authData.user;

  // Create corresponding MongoDB User record
  try {
    await User.create({
      supabaseId: supabaseUser.id,
      email,
      fullName,
      preferredLanguage,
      role: "seeker",
    });
  } catch (dbError: unknown) {
    // If MongoDB creation fails with duplicate key, still return error
    const msg = dbError instanceof Error ? dbError.message : "Database error";
    if (msg.includes("duplicate") || msg.includes("E11000")) {
      return { user: null, error: "This email is already registered" };
    }
    return { user: null, error: msg };
  }

  return { user: supabaseUser, error: null };
}

export async function login(email: string, password: string): Promise<AuthServiceResult> {
  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    return { user: null, error: parsed.error.errors[0].message };
  }

  // Check lockout
  if (isAccountLocked(email)) {
    return { user: null, error: "Account temporarily locked. Try again later." };
  }

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    const locked = recordFailedAttempt(email);
    if (locked) {
      return { user: null, error: "Account temporarily locked. Check your email." };
    }
    return { user: null, error: "Invalid email or password" };
  }

  // Successful login — clear failed attempts
  clearFailedAttempts(email);
  return { user: authData.user, error: null };
}

export async function loginWithOAuth(
  provider: OAuthProvider
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback` },
  });

  if (error) {
    return { url: null, error: error.message };
  }

  return { url: data.url ?? null, error: null };
}

export async function verifyEmail(token: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.verifyOtp({
    token_hash: token,
    type: "email",
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function requestPasswordReset(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ error: string | null }> {
  // First verify the recovery token to establish a session
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: token,
    type: "recovery",
  });

  if (verifyError) {
    return { error: verifyError.message };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function logout(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function getSession(): Promise<{ session: Session | null; error: string | null }> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    return { session: null, error: error.message };
  }
  return { session: data.session, error: null };
}
