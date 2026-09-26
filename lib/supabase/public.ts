import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cookie-less client that always queries as the `anon` role. Use it for public
 * lookup data (e.g. courses, year levels) so results don't depend on whether
 * the visitor happens to have a session.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
