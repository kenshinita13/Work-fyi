const secretPatternSources = [
  "-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\\s\\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
  "\\b(?:sb_secret_|sk-(?:proj-)?|gh[pousr]_|xox[baprs]-)[A-Za-z0-9_-]{10,}\\b",
  "\\bBearer\\s+[A-Za-z0-9._~+/=-]{20,}",
  "\\b(?:api[_-]?key|secret|password|access[_-]?token|refresh[_-]?token)\\s*[:=]\\s*[^\\s,;]{12,}",
];

export function containsPotentialSecret(value: string) {
  return secretPatternSources.some((source) =>
    new RegExp(source, "i").test(value),
  );
}

export function redactPotentialSecrets(value: string | null) {
  if (!value) return value;

  return secretPatternSources.reduce(
    (redacted, source) =>
      redacted.replace(new RegExp(source, "gi"), "[redacted credential]"),
    value,
  );
}
