import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminServiceConfigured } from "@/lib/supabase/admin-access";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function createPublicDataClient() {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
  return isAdminServiceConfigured() ? createAdminClient() : createClient();
}