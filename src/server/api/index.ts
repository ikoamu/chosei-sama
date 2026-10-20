// =============================================================================
// server/api
// 状態を持たない HTTP API（/api/*）のハンドラ（docs/adr/0003）。
// リクエストごとにセッション Cookie を検証し、その refresh_token から
// 依頼者本人の access_token を発行して Google を呼ぶ。
// =============================================================================

import { refreshAccessToken, verifySession } from "../auth";
import {
  missingRequired,
  type SchedulingCriteria
} from "../../shared/criteria";
import { suggestFromCriteria } from "./suggest";

interface SuggestBody {
  members: string[];
  criteria: SchedulingCriteria;
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
  const url = new URL(request.url);
  if (url.pathname === "/api/suggest" && request.method === "POST") {
    const { members, criteria } = (await request.json()) as SuggestBody;
    const missing = missingRequired(criteria);
    if (missing.length > 0) {
      return Response.json({ missing }, { status: 400 });
    }
    const token = await refreshAccessToken(
      session.refreshToken,
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET
    );
    if (!token) {
      return Response.json({ error: "token refresh failed" }, { status: 401 });
    }
    return Response.json(
      await suggestFromCriteria(token.accessToken, members, criteria)
    );
  }
  return new Response("Not found", { status: 404 });
}
