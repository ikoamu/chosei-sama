// =============================================================================
// server/auth/base64url
// base64url 変換。サーバ側の認証で使う純粋関数：
// セッション Cookie の HMAC 署名・検証（session.ts）と OAuth ID トークンの
// デコード（google-oauth.ts）。Web 標準 API（btoa / atob / TextEncoder）のみに依存。
// =============================================================================

/** バイト列を base64url 文字列へ。 */
export function bytesToBase64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) {
    s += String.fromCharCode(b);
  }
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url 文字列をバイト列へ。 */
export function base64urlToBytes(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}
