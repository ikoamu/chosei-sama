// =============================================================================
// server/auth/google-oauth
// Google OAuth（ログイン）— 認可 URL の生成と、認可コード → ユーザー情報の交換。
// 許可ドメイン（hd クレーム）以外のアカウントは拒否する。
// =============================================================================

import { base64urlToBytes } from "./base64url";

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  allowedDomain: string;
  cookieSecret: string;
}

export function googleAuthUrl(
  clientId: string,
  redirectUri: string,
  allowedDomain: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    // 身元確認 + ディレクトリ参照（People API の同僚検索）+ FreeBusy 照会 +
    // 予約確定（events.insert で予定作成・招待）を一度に同意させる。
    scope:
      "openid email profile https://www.googleapis.com/auth/directory.readonly https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.events",
    // offline で refresh_token を取得し、セッション中は再ログイン不要にする。
    access_type: "offline",
    hd: allowedDomain,
    // consent を指定すると毎回 refresh_token が返る（select_account だと初回のみ）。
    prompt: "consent"
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

interface IdTokenClaims {
  email: string;
  name: string;
  picture: string;
  hd?: string;
  email_verified: boolean;
}

function decodeIdToken(jwt: string): IdTokenClaims {
  return JSON.parse(
    new TextDecoder().decode(base64urlToBytes(jwt.split(".")[1]))
  );
}

export interface ExchangeSuccess {
  email: string;
  name: string;
  picture: string;
  domain: string;
  refreshToken: string;
}

export async function exchangeCodeForUser(
  code: string,
  redirectUri: string,
  config: OAuthConfig
): Promise<ExchangeSuccess | { error: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });
  if (!res.ok) {
    return { error: `Token exchange failed: ${res.status}` };
  }
  const tokens = (await res.json()) as {
    id_token: string;
    refresh_token?: string;
  };
  const claims = decodeIdToken(tokens.id_token);

  if (!claims.email_verified) {
    return { error: "Email not verified" };
  }
  if (claims.hd !== config.allowedDomain) {
    return { error: `${claims.hd || "unknown"} is not allowed` };
  }
  if (!tokens.refresh_token) {
    return { error: "No refresh token received" };
  }
  return {
    email: claims.email,
    name: claims.name,
    picture: claims.picture,
    domain: claims.hd,
    refreshToken: tokens.refresh_token
  };
}

/** refresh_token → 短命 access_token を発行する。 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    })
  });
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}
