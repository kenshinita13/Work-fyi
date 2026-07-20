import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env/server";
import type { Database } from "@/types/database";

let adminClient: SupabaseClient<Database> | null = null;

export function getSupabaseAdminClient() {
  if (!adminClient) {
    const env = getServerEnv();

    adminClient = createClient<Database>(
      env.supabaseUrl,
      env.supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return adminClient;
}
