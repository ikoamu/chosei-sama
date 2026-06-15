export interface UserSession {
  email: string;
  name: string;
  picture: string;
  domain: string;
  exp: number;
}

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  allowedDomain: string;
  cookieSecret: string;
}

const COOKIE_NAME = "chosei_session";
const SESSION_TTL = 7 * 24 * 60 * 60;

// --- Base64url ---

function b64urlEncode(data: Uint8Array): string {
  let s = "";
  for (const b of data) {
    s += String.fromCharCode(b);
  }
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

// --- HMAC ---

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// --- Session cookie ---

export async function createSessionCookie(
  user: Omit<UserSession, "exp">,
  secret: string
): Promise<string> {
  const payload: UserSession = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL
  };
  const payloadB64 = b64urlEncode(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64)
  );
  const token = `${payloadB64}.${b64urlEncode(new Uint8Array(sig))}`;
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
  const sigBytes = b64urlDecode(sigB64);
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
    new TextDecoder().decode(b64urlDecode(payloadB64))
  );
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

// --- Google OAuth ---

function googleAuthUrl(
  clientId: string,
  redirectUri: string,
  allowedDomain: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope:
      "openid email profile https://www.googleapis.com/auth/directory.readonly",
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
  return JSON.parse(new TextDecoder().decode(b64urlDecode(jwt.split(".")[1])));
}

async function exchangeCodeForUser(
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

// --- Route handler ---

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
