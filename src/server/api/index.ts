// =============================================================================
// server/api
// 状態を持たない HTTP API（/api/*）のハンドラ（docs/adr/0003）。
// リクエストごとにセッション Cookie を検証し、その refresh_token から
// 依頼者本人の access_token を発行して Google を呼ぶ。
//   - POST /api/suggest … 候補提案
//   - POST /api/events  … 予約確定
// =============================================================================

import { refreshAccessToken, verifySession } from "../auth";
import type { UserSession } from "../auth/session";
import {
  missingRequired,
  type SchedulingCriteria
} from "../../shared/criteria";
import type { BookingRequest } from "../../shared/booking";
import { suggestFromCriteria } from "./suggest";
import { bookEvent } from "./events";

interface SuggestBody {
  members: string[];
  criteria: SchedulingCriteria;
}

/** refresh_token から本人の access_token を発行する。失敗なら null。 */
async function accessTokenFor(
  session: UserSession,
  env: Env
): Promise<string | null> {
  const token = await refreshAccessToken(
    session.refreshToken,
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET
  );
  return token?.accessToken ?? null;
}

const TOKEN_FAILED = () =>
  Response.json({ error: "token refresh failed" }, { status: 401 });

async function handleSuggest(
  request: Request,
  session: UserSession,
  env: Env
): Promise<Response> {
  const { members, criteria } = (await request.json()) as SuggestBody;
  const missing = missingRequired(criteria);
  if (missing.length > 0) {
    return Response.json({ missing }, { status: 400 });
  }
  const accessToken = await accessTokenFor(session, env);
  if (!accessToken) {
    return TOKEN_FAILED();
  }
  return Response.json(
    await suggestFromCriteria(accessToken, members, criteria)
  );
}

async function handleEvents(
  request: Request,
  session: UserSession,
  env: Env
): Promise<Response> {
  const booking = (await request.json()) as BookingRequest;
  const accessToken = await accessTokenFor(session, env);
  if (!accessToken) {
    return TOKEN_FAILED();
  }
  return Response.json(
    await bookEvent(
      accessToken,
      { email: session.email, name: session.name },
      booking
    )
  );
}

export async function handleApiRoute(
  request: Request,
  env: Env
): Promise<Response> {
  const session = await verifySession(
    request.headers.get("Cookie"),
    env.COOKIE_SECRET
  );
  if (!session) {
    return Response.json({ error: "not authenticated" }, { status: 401 });
  }
  if (request.method === "POST") {
    switch (new URL(request.url).pathname) {
      case "/api/suggest":
        return handleSuggest(request, session, env);
      case "/api/events":
        return handleEvents(request, session, env);
    }
  }
  return new Response("Not found", { status: 404 });
}
