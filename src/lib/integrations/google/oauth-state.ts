import "server-only";

import { randomBytes } from "node:crypto";
import { z } from "zod";

import { decryptSecret, encryptSecret, constantTimeEqual } from "./crypto";
import type { GoogleCapability } from "./scopes";

const oauthStateSchema = z.object({
  nonce: z.string().min(32).max(200),
  capability: z.enum(["core", "gmail"]),
  createdAt: z.number().int().positive(),
});

const STATE_AAD = "work-fyi:google-oauth-state";
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

export function createGoogleOAuthState(
  capability: GoogleCapability,
  encryptionKey: string,
) {
  const state = {
    nonce: randomBytes(32).toString("base64url"),
    capability,
    createdAt: Date.now(),
  };

  return {
    state: state.nonce,
    cookieValue: encryptSecret(JSON.stringify(state), encryptionKey, STATE_AAD),
  };
}

export function verifyGoogleOAuthState(
  cookieValue: string | undefined,
  returnedState: string | null,
  encryptionKey: string,
) {
  if (!cookieValue || !returnedState) return null;

  try {
    const state = oauthStateSchema.parse(
      JSON.parse(decryptSecret(cookieValue, encryptionKey, STATE_AAD)),
    );
    if (Date.now() - state.createdAt > STATE_MAX_AGE_MS) return null;
    if (!constantTimeEqual(state.nonce, returnedState)) return null;
    return state;
  } catch {
    return null;
  }
}
