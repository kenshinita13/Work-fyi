import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { getPublicEnv } from "@/lib/env/public";

describe("getPublicEnv", () => {
  it("returns typed public configuration", () => {
    expect(
      getPublicEnv({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      }),
    ).toEqual({
      appUrl: "http://localhost:3000",
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "publishable-key",
    });
  });

  it("supports the legacy anon key variable from the implementation spec", () => {
    expect(
      getPublicEnv({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      }),
    ).toMatchObject({
      supabaseAnonKey: "anon-key",
    });
  });

  it("rejects malformed public configuration", () => {
    expect(() =>
      getPublicEnv({
        NEXT_PUBLIC_APP_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      }),
    ).toThrow(ZodError);
  });
});
