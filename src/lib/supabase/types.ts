import type { Session, User, AuthError } from "@supabase/supabase-js";

/** Result returned by auth operations (login, register, etc.) */
export interface AuthResult {
  user: User | null;
  error: AuthError | null;
}

/** Result returned by session retrieval */
export interface SessionResult {
  session: Session | null;
  error: AuthError | null;
}

/** Supported OAuth providers */
export type OAuthProvider = "google" | "github";

/** Re-export core Supabase auth types for convenience */
export type { Session, User, AuthError };
