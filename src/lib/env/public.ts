import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

const googlePickerEnvSchema = z.object({
  NEXT_PUBLIC_GOOGLE_PICKER_API_KEY: z.string().min(20),
  NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER: z.string().regex(/^\d{6,20}$/),
});

export type PublicEnv = {
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export function getPublicEnv(
  source: Record<string, string | undefined> = process.env,
): PublicEnv {
  const env = publicEnvSchema.parse(source);
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
  };
}

export function getGooglePickerEnv(
  source: Record<string, string | undefined> = process.env,
) {
  const env = googlePickerEnvSchema.parse(source);
  return {
    apiKey: env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY,
    projectNumber: env.NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER,
  };
}

export function isGooglePickerConfigured(
  source: Record<string, string | undefined> = process.env,
) {
  return googlePickerEnvSchema.safeParse(source).success;
}
