// =============================================================================
// server/auth/google-oauth
// Google OAuth（ログイン）— 認可 URL の生成と、認可コード → ユーザー情報の交換。
// 許可ドメイン（hd クレーム）以外のアカウントは拒否する。
// =============================================================================

import { base64urlToBytes } from "../../shared/base64url";

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
    // ログインは身元確認のみ。ディレクトリ参照は client 側 GIS が
    // directory.readonly を別途取得するため、ここでは要求しない。
    scope: "openid email profile",
    access_type: "online",
    hd: allowedDomain,
    prompt: "select_account"
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

export async function exchangeCodeForUser(
  code: string,
  redirectUri: string,
  config: OAuthConfig
): Promise<
  | { email: string; name: string; picture: string; domain: string }
  | { error: string }
> {
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
  const tokens = (await res.json()) as { id_token: string };
  const claims = decodeIdToken(tokens.id_token);

  if (!claims.email_verified) {
    return { error: "Email not verified" };
  }
  if (claims.hd !== config.allowedDomain) {
    return { error: `${claims.hd || "unknown"} is not allowed` };
  }
  return {
    email: claims.email,
    name: claims.name,
    picture: claims.picture,
    domain: claims.hd
  };
}
