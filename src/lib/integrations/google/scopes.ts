export const GOOGLE_IDENTITY_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
] as const;

export const GOOGLE_CORE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/drive.file",
] as const;

export const GOOGLE_GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
] as const;

export const googleCapabilitySchema = {
  core: [...GOOGLE_IDENTITY_SCOPES, ...GOOGLE_CORE_SCOPES],
  gmail: [...GOOGLE_IDENTITY_SCOPES, ...GOOGLE_GMAIL_SCOPES],
} as const;

export type GoogleCapability = keyof typeof googleCapabilitySchema;

export function scopesForCapability(capability: GoogleCapability) {
  return [...googleCapabilitySchema[capability]];
}

export function hasGoogleScopes(
  granted: string[],
  required: readonly string[],
) {
  const scopeSet = new Set(granted);
  return required.every((scope) => scopeSet.has(scope));
}
