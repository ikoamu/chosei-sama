// =============================================================================
// scheduler/google-auth
// サービスアカウント鍵 → アクセストークン（Web Crypto / RS256）。
// Workspace 全体のカレンダーを読むには、ドメイン全体の委任 + subject 偽装を使う。
// subject に「成り代わるユーザー（依頼者など）」のメールを渡す。
// =============================================================================

import type { ServiceAccount } from "./types";
import { bytesToBase64url, stringToBase64url } from "../shared/base64url";

async function importServiceAccountKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

export async function getAccessToken(
  sa: ServiceAccount,
  subject: string,
  scopes: string[] = ["https://www.googleapis.com/auth/calendar.readonly"]
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    sub: subject // ドメイン委任で成り代わる相手
  };

  const unsigned = `${stringToBase64url(JSON.stringify(header))}.${stringToBase64url(
    JSON.stringify(claim)
  )}`;
  const key = await importServiceAccountKey(sa.private_key);
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${bytesToBase64url(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });
  if (!res.ok) {
    throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}
