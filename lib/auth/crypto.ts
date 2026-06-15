import * as crypto from "node:crypto";

export function hashPassword(password: string, saltBase64?: string) {
  const salt = saltBase64
    ? Buffer.from(saltBase64, "base64")
    : crypto.randomBytes(32);

  const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512") as Buffer;

  return {
    saltBase64: salt.toString("base64"),
    hashBase64: derivedKey.toString("base64"),
  };
}

export function verifyPassword(input: {
  password: string;
  saltBase64: string;
  hashBase64: string;
}) {
  const salt = Buffer.from(input.saltBase64, "base64");
  const expected = Buffer.from(input.hashBase64, "base64");
  const actual = crypto.pbkdf2Sync(input.password, salt, 100000, 64, "sha512") as Buffer;
  return (
    expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
  );
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256Base64Url(value: string) {
  return crypto.createHash("sha256").update(value).digest("base64url");
}
