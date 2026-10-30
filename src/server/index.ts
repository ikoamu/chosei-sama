// =============================================================================
// server
// Worker のエントリポイント（wrangler の main）。
// /oauth/* は認証ハンドラへ、/api/* は状態を持たない API へルーティングする。
// それ以外は静的アセット（SPA）が返すので、ここに来たら 404。
// =============================================================================

import { handleOAuthRoute } from "./auth";
import { handleApiRoute } from "./api";

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/oauth/")) {
      return handleOAuthRoute(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return handleApiRoute(request, env);
    }

    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
