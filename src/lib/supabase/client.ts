import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Supabase browser client — uses the public anon key.
 * Safe to use in client components for auth and public data access.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
