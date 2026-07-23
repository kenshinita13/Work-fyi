import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { decryptSecret, encryptSecret } from "@/lib/integrations/google/crypto";
import {
  createGoogleOAuthState,
  verifyGoogleOAuthState,
} from "@/lib/integrations/google/oauth-state";
import {
  GOOGLE_CORE_SCOPES,
  GOOGLE_GMAIL_SCOPES,
  hasGoogleScopes,
} from "@/lib/integrations/google/scopes";
import {
  googleDriveImportSchema,
  googleGmailDraftSchema,
  googlePublishSchema,
} from "@/lib/validation/google";

const encryptionKey = randomBytes(32).toString("base64");

afterEach(() => {
  vi.useRealTimers();
});

describe("Google integration token encryption", () => {
  it("decrypts only with the matching context", () => {
    const encrypted = encryptSecret("refresh-token", encryptionKey, "user-a");

    expect(decryptSecret(encrypted, encryptionKey, "user-a")).toBe(
      "refresh-token",
    );
    expect(() => decryptSecret(encrypted, encryptionKey, "user-b")).toThrow();
  });

  it("rejects modified ciphertext", () => {
    const encrypted = encryptSecret("access-token", encryptionKey, "user-a");
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("a") ? "b" : "a"}`;

    expect(() => decryptSecret(tampered, encryptionKey, "user-a")).toThrow();
  });
});

describe("Google OAuth state", () => {
  it("accepts a fresh matching state and rejects a different nonce", () => {
    const state = createGoogleOAuthState("core", encryptionKey);

    expect(
      verifyGoogleOAuthState(state.cookieValue, state.state, encryptionKey)
        ?.capability,
    ).toBe("core");
    expect(
      verifyGoogleOAuthState(
        state.cookieValue,
        `${state.state}x`,
        encryptionKey,
      ),
    ).toBeNull();
  });

  it("rejects expired OAuth state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T10:00:00Z"));
    const state = createGoogleOAuthState("gmail", encryptionKey);
    vi.setSystemTime(new Date("2026-07-22T10:11:00Z"));

    expect(
      verifyGoogleOAuthState(state.cookieValue, state.state, encryptionKey),
    ).toBeNull();
  });
});

describe("Google capability isolation", () => {
  it("does not treat core file scopes as Gmail access", () => {
    expect(hasGoogleScopes([...GOOGLE_CORE_SCOPES], GOOGLE_CORE_SCOPES)).toBe(
      true,
    );
    expect(hasGoogleScopes([...GOOGLE_CORE_SCOPES], GOOGLE_GMAIL_SCOPES)).toBe(
      false,
    );
  });

  it("requires explicit confirmation for Google writes", () => {
    expect(
      googleGmailDraftSchema.safeParse({
        to: "teammate@example.com",
        subject: "Status",
        body: "Draft body",
        confirmed: false,
      }).success,
    ).toBe(false);
    expect(
      googlePublishSchema.safeParse({
        documentId: "754f62fc-d43c-4d95-b211-3380fe1de8c6",
        target: "docs",
        expectedRevision: 2,
        confirmed: false,
      }).success,
    ).toBe(false);
    expect(
      googleDriveImportSchema.safeParse({
        fileId: "google-file-id",
        confirmed: false,
      }).success,
    ).toBe(false);
  });
});
