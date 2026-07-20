import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  AI_API_KEY: z.string().min(1),
  AI_MODEL: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.url(),
  ENCRYPTION_KEY: z.string().min(32),
});

export type ServerEnv = {
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  aiApiKey: string;
  aiModel: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  encryptionKey: string;
};

export function getServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  const env = serverEnvSchema.parse(source);
  const supabaseAnonKey =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseAnonKey) {
    throw new Error(
      "Missing Supabase publishable key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return {
    appUrl: env.NEXT_PUBLIC_APP_URL,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    aiApiKey: env.AI_API_KEY,
    aiModel: env.AI_MODEL,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri: env.GOOGLE_REDIRECT_URI,
    encryptionKey: env.ENCRYPTION_KEY,
  };
}
