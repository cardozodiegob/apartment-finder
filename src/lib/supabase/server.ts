import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Supabase admin client — uses the service role key.
 * Only use in server-side code (API routes, server components, server actions).
 * Bypasses Row Level Security — handle authorization in application code.
 * NOT suitable for signInWithPassword — use supabaseServerAuth instead.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Supabase server auth client — uses the anon key for password-based sign-in.
 * signInWithPassword does NOT work with the service role key because the
 * service role client has persistSession: false and bypasses normal auth flow.
 * This client uses the anon key which properly returns session tokens.
 */
export const supabaseServerAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default supabaseAdmin;
