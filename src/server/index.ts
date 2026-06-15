// =============================================================================
// server
// Worker のエントリポイント（wrangler の main）。
// /oauth/* は認証ハンドラへ、/agents/* はセッション検証を通してから Agent へ
// ルーティングする。ChatAgent は Durable Object として re-export する。
// =============================================================================

import { routeAgentRequest } from "agents";
import { handleOAuthRoute, verifySession } from "./auth";

export { ChatAgent } from "./chat-agent";

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/oauth/")) {
      return handleOAuthRoute(request, env);
    }

    if (url.pathname.startsWith("/agents/")) {
      const session = await verifySession(
        request.headers.get("Cookie"),
        env.COOKIE_SECRET
      );
      if (!session) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
