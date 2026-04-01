import { supabaseAdmin, supabaseServerAuth } from "@/lib/supabase/server";
import User from "@/lib/db/models/User";
import dbConnect from "@/lib/db/connection";
import { registerSchema, loginSchema } from "@/lib/validations/auth";
import type { RegisterInput } from "@/lib/validations/auth";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";

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

  await dbConnect();

  // Create user in Supabase Auth (email_confirm: false — user must verify)
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

export async function login(email: string, password: string): Promise<AuthServiceResult & { session?: Session | null }> {
  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    return { user: null, error: parsed.error.errors[0].message };
  }

  // Check lockout
  if (isAccountLocked(email)) {
    return { user: null, error: "Account temporarily locked. Try again later." };
  }

  // Use the anon-key server client for signInWithPassword.
  // The service role (admin) client does NOT work for signInWithPassword because
  // it has persistSession: false and bypasses normal auth — it won't return tokens.
  const { data: authData, error: authError } = await supabaseServerAuth.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    const locked = recordFailedAttempt(email);
    if (locked) {
      return { user: null, error: "Account temporarily locked. Check your email." };
    }
    // Provide a more helpful message for unconfirmed emails
    if (authError.message?.toLowerCase().includes("email not confirmed")) {
      return { user: null, error: "Please verify your email before logging in. Check your inbox for the verification link." };
    }
    return { user: null, error: "Invalid email or password" };
  }

  // Successful login — clear failed attempts
  clearFailedAttempts(email);
  return { user: authData.user, session: authData.session, error: null };
}

export async function loginWithOAuth(
  provider: "google" | "github"
): Promise<{ url: string | null; error: string | null }> {
  // OAuth sign-in must happen client-side via the browser Supabase client.
  // This function is only called from the client-side login page via dynamic import,
  // so we import the browser client here.
  const { supabase } = await import("@/lib/supabase/client");
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
  // Try OTP verification via the anon server client
  const { error } = await supabaseServerAuth.auth.verifyOtp({
    token_hash: token,
    type: "email",
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function requestPasswordReset(email: string): Promise<{ error: string | null }> {
  // Use admin client to send password reset — works server-side without browser context
  const { error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  if (error) {
    // Don't expose whether the email exists
    return { error: null };
  }

  return { error: null };
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ error: string | null }> {
  // Verify the recovery token server-side
  const { error: verifyError } = await supabaseServerAuth.auth.verifyOtp({
    token_hash: token,
    type: "recovery",
  });

  if (verifyError) {
    return { error: verifyError.message };
  }

  // Use admin client to update the password
  // We need to find the user from the token verification
  const { data: sessionData } = await supabaseServerAuth.auth.getSession();
  if (sessionData?.session?.user) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      sessionData.session.user.id,
      { password: newPassword }
    );
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }

  return { error: "Invalid or expired reset token" };
}

export async function logout(): Promise<{ error: string | null }> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    cookieStore.delete("sb-access-token");
    cookieStore.delete("sb-refresh-token");
  } catch {
    // May fail in client context, that's ok
  }
  return { error: null };
}

export async function getSession(): Promise<{ session: { user: SupabaseUser; access_token: string } | null; error: string | null }> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("sb-access-token")?.value;

    if (!accessToken) {
      return { session: null, error: null };
    }

    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data.user) {
      return { session: null, error: error?.message || null };
    }

    return {
      session: {
        user: data.user,
        access_token: accessToken,
      },
      error: null,
    };
  } catch {
    return { session: null, error: null };
  }
}
