// =============================================================================
// server/auth/session
// 署名付きセッション Cookie の発行・検証（HMAC-SHA256）。
// =============================================================================

import { base64urlToBytes, bytesToBase64url } from "./base64url";

export interface UserSession {
  email: string;
  name: string;
  picture: string;
  domain: string;
  /** ディレクトリ参照用 refresh_token（People API トークン更新に使用）。 */
  refreshToken: string;
  exp: number;
}

const COOKIE_NAME = "chosei_session";
const SESSION_TTL = 7 * 24 * 60 * 60;

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionCookie(
  user: Omit<UserSession, "exp">,
  secret: string
): Promise<string> {
  const payload: UserSession = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL
  };
  const payloadB64 = bytesToBase64url(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64)
  );
  const token = `${payloadB64}.${bytesToBase64url(new Uint8Array(sig))}`;
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}`;
}

export async function verifySession(
  cookieHeader: string | null,
  secret: string
): Promise<UserSession | null> {
  if (!cookieHeader) {
    return null;
  }
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) {
    return null;
  }
  const parts = match[1].split(".");
  if (parts.length !== 2) {
    return null;
  }
  const [payloadB64, sigB64] = parts;
  const key = await hmacKey(secret);
  const sigBytes = base64urlToBytes(sigB64);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes.buffer as ArrayBuffer,
    new TextEncoder().encode(payloadB64)
  );
  if (!valid) {
    return null;
  }
  const payload: UserSession = JSON.parse(
    new TextDecoder().decode(base64urlToBytes(payloadB64))
  );
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
