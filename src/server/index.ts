// =============================================================================
// server
// Worker のエントリポイント（wrangler の main）。
// /oauth/* は認証ハンドラへ、/agents/* はセッション検証を通してから Agent へ
// ルーティングする。ChatAgent は Durable Object として re-export する。
// =============================================================================

import { routeAgentRequest } from "agents";
import { handleOAuthRoute, verifySession } from "./auth";
import { isOwnAgentPath } from "./auth/agent-access";

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
      // 自分のメールで名付けられた自分の Agent 以外には接続させない
      // （他人の DO 名に接続してチャット履歴等を覗くのを防ぐ）。
      if (!isOwnAgentPath(url.pathname, session.email)) {
        return new Response("Forbidden", { status: 403 });
      }
    }

    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
