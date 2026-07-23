import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const VERSION = "v1";

function encryptionKey(value: string) {
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }
  return decoded;
}

export function encryptSecret(value: string, keyValue: string, aad: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(keyValue), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecret(value: string, keyValue: string, aad: string) {
  const [version, iv, tag, ciphertext, extra] = value.split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext || extra) {
    throw new Error("Encrypted value has an unsupported format.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(keyValue),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
