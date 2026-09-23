import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const fallbackSupabaseUrl = "https://local-placeholder.supabase.co";
const fallbackSupabaseAnonKey = "local-placeholder-anon-key";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env");
}

// A placeholder client keeps the public site usable before Supabase is configured.
// Authenticated features will show their normal configuration/error states instead.
export const supabase = createClient(supabaseUrl || fallbackSupabaseUrl, supabaseAnonKey || fallbackSupabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
