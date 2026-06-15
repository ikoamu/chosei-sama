// =============================================================================
// server/auth
// OAuth ルート（/oauth/*）のハンドラ。ログイン・コールバック・現在ユーザー照会・
// ログアウトを束ねる。セッション検証 verifySession もここから再エクスポートする。
// =============================================================================

import {
  clearSessionCookie,
  createSessionCookie,
  verifySession
} from "./session";
import {
  exchangeCodeForUser,
  googleAuthUrl,
  type OAuthConfig
} from "./google-oauth";

export { verifySession } from "./session";
export type { UserSession } from "./session";

function configFromEnv(env: Env): OAuthConfig {
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    allowedDomain: env.ALLOWED_DOMAIN,
    cookieSecret: env.COOKIE_SECRET
  };
}

export async function handleOAuthRoute(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const config = configFromEnv(env);
  const redirectUri = `${url.origin}/oauth/callback`;

  switch (url.pathname) {
    case "/oauth/login":
      return Response.redirect(
        googleAuthUrl(config.clientId, redirectUri, config.allowedDomain),
        302
      );

    case "/oauth/callback":
      return handleCallback(url, redirectUri, config);

    case "/oauth/me":
      return handleMe(request, config.cookieSecret, config.clientId);

    case "/oauth/logout":
      return new Response(null, {
        status: 302,
        headers: { Location: "/", "Set-Cookie": clearSessionCookie() }
      });

    default:
      return new Response("Not found", { status: 404 });
  }
}

async function handleCallback(
  url: URL,
  redirectUri: string,
  config: OAuthConfig
): Promise<Response> {
  const code = url.searchParams.get("code");
  if (!code) {
    return new Response("Missing authorization code", { status: 400 });
  }
  const result = await exchangeCodeForUser(code, redirectUri, config);
  if ("error" in result) {
    const dest = new URL("/", url.origin);
    dest.searchParams.set("error", result.error);
    return Response.redirect(dest.toString(), 302);
  }
  const cookie = await createSessionCookie(result, config.cookieSecret);
  return new Response(null, {
    status: 302,
    headers: { Location: "/", "Set-Cookie": cookie }
  });
}

async function handleMe(
  request: Request,
  cookieSecret: string,
  clientId: string
): Promise<Response> {
  const session = await verifySession(
    request.headers.get("Cookie"),
    cookieSecret
  );
  if (!session) {
    return Response.json({ authenticated: false }, { status: 401 });
  }
  return Response.json({
    authenticated: true,
    email: session.email,
    name: session.name,
    picture: session.picture,
    clientId
  });
}
