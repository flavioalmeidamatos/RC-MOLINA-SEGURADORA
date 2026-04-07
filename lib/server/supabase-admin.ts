import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient<any> | null = null;

export function getSupabaseAdmin(): SupabaseClient<any> {
  if (cached) {
    return cached;
  }

  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.VITE_SUPABASE_URL?.trim() ||
    "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  if (!url || !serviceRole) {
    throw new Error(
      "SUPABASE_URL/VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configuradas."
    );
  }

  cached = createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        "x-application-name": "rc-molina-whatsapp-store",
      },
    },
  });

  return cached;
}
