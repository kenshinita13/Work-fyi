import "server-only";

import { z } from "zod";

import { getGoogleEnv } from "@/lib/env/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

import { decryptSecret, encryptSecret } from "./crypto";
import { hasGoogleScopes } from "./scopes";

type GoogleIntegration =
  Database["public"]["Tables"]["user_integrations"]["Row"];

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});

const userInfoSchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  name: z.string().optional(),
});

export class GoogleIntegrationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 502,
  ) {
    super(message);
  }
}

function tokenAad(workspaceId: string, userId: string) {
  return `work-fyi:google-token:${workspaceId}:${userId}`;
}

async function tokenRequest(parameters: URLSearchParams) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: parameters,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new GoogleIntegrationError(
      "Google authorization could not be completed.",
      "token_exchange_failed",
      502,
    );
  }

  return tokenResponseSchema.parse(await response.json());
}

export async function exchangeGoogleAuthorizationCode(code: string) {
  const env = getGoogleEnv();
  return tokenRequest(
    new URLSearchParams({
      code,
      client_id: env.clientId,
      client_secret: env.clientSecret,
      redirect_uri: env.redirectUri,
      grant_type: "authorization_code",
    }),
  );
}

async function refreshGoogleAccessToken(refreshToken: string) {
  const env = getGoogleEnv();
  return tokenRequest(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.clientId,
      client_secret: env.clientSecret,
      grant_type: "refresh_token",
    }),
  );
}

export async function revokeGoogleToken(token: string) {
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  return response.ok;
}

export async function getGoogleUserInfo(accessToken: string) {
  const response = await googleFetch(
    accessToken,
    "https://openidconnect.googleapis.com/v1/userinfo",
  );
  return userInfoSchema.parse(await response.json());
}

export async function googleFetch(
  accessToken: string,
  url: string | URL,
  init: RequestInit = {},
) {
  const target = new URL(url);
  if (
    target.protocol !== "https:" ||
    !target.hostname.endsWith("googleapis.com")
  ) {
    throw new Error("Google API requests must use an approved Google host.");
  }

  const response = await fetch(target, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const status = response.status === 429 ? 429 : 502;
    throw new GoogleIntegrationError(
      response.status === 403
        ? "Google has not granted the permission required for this action."
        : "Google Workspace did not complete the request.",
      `google_api_${response.status}`,
      status,
    );
  }
  return response;
}

async function markIntegrationError(
  integration: GoogleIntegration,
  errorCode: string,
) {
  const admin = getSupabaseAdminClient();
  await Promise.all([
    admin
      .from("user_integrations")
      .update({ status: "error", last_error_code: errorCode })
      .eq("id", integration.id),
    admin.from("security_audit_logs").insert({
      workspace_id: integration.workspace_id,
      actor_id: integration.user_id,
      event_type: "integration.token_refresh_failed",
      provider: "google",
      resource_type: "integration",
      resource_id: integration.id,
      metadata: { error_code: errorCode },
    }),
  ]);
}

export async function getGoogleAccess(
  workspaceId: string,
  userId: string,
  requiredScopes: readonly string[],
) {
  const admin = getSupabaseAdminClient();
  const { data: integration } = await admin
    .from("user_integrations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  if (!integration || integration.status === "revoked") {
    throw new GoogleIntegrationError(
      "Connect Google Workspace to continue.",
      "not_connected",
      409,
    );
  }
  if (!hasGoogleScopes(integration.scopes, requiredScopes)) {
    throw new GoogleIntegrationError(
      "Grant the required Google Workspace permission to continue.",
      "missing_scope",
      403,
    );
  }

  const env = getGoogleEnv();
  const aad = tokenAad(workspaceId, userId);
  const expiresAt = new Date(integration.token_expires_at).getTime();
  if (expiresAt > Date.now() + 60_000) {
    return {
      accessToken: decryptSecret(
        integration.access_token_ciphertext,
        env.encryptionKey,
        aad,
      ),
      integration,
    };
  }

  if (!integration.refresh_token_ciphertext) {
    await markIntegrationError(integration, "refresh_token_missing");
    throw new GoogleIntegrationError(
      "Reconnect Google Workspace to restore access.",
      "refresh_token_missing",
      401,
    );
  }

  try {
    const refreshToken = decryptSecret(
      integration.refresh_token_ciphertext,
      env.encryptionKey,
      aad,
    );
    const refreshed = await refreshGoogleAccessToken(refreshToken);
    const tokenExpiresAt = new Date(
      Date.now() + refreshed.expires_in * 1000,
    ).toISOString();
    const scopes = refreshed.scope
      ? Array.from(
          new Set([...integration.scopes, ...refreshed.scope.split(" ")]),
        )
      : integration.scopes;

    await admin
      .from("user_integrations")
      .update({
        access_token_ciphertext: encryptSecret(
          refreshed.access_token,
          env.encryptionKey,
          aad,
        ),
        token_expires_at: tokenExpiresAt,
        scopes,
        status: "active",
        last_error_code: null,
        last_refreshed_at: new Date().toISOString(),
      })
      .eq("id", integration.id);

    return {
      accessToken: refreshed.access_token,
      integration: {
        ...integration,
        token_expires_at: tokenExpiresAt,
        scopes,
        status: "active" as const,
        last_error_code: null,
      },
    };
  } catch (error) {
    await markIntegrationError(integration, "refresh_failed");
    if (error instanceof GoogleIntegrationError) throw error;
    throw new GoogleIntegrationError(
      "Reconnect Google Workspace to restore access.",
      "refresh_failed",
      401,
    );
  }
}

export function encryptedGoogleTokens(input: {
  workspaceId: string;
  userId: string;
  accessToken: string;
  refreshToken?: string;
}) {
  const env = getGoogleEnv();
  const aad = tokenAad(input.workspaceId, input.userId);
  return {
    accessTokenCiphertext: encryptSecret(
      input.accessToken,
      env.encryptionKey,
      aad,
    ),
    refreshTokenCiphertext: input.refreshToken
      ? encryptSecret(input.refreshToken, env.encryptionKey, aad)
      : undefined,
  };
}

export function decryptIntegrationRefreshToken(integration: GoogleIntegration) {
  if (!integration.refresh_token_ciphertext) return null;
  const env = getGoogleEnv();
  return decryptSecret(
    integration.refresh_token_ciphertext,
    env.encryptionKey,
    tokenAad(integration.workspace_id, integration.user_id),
  );
}
