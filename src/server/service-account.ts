// =============================================================================
// server/service-account
// Secrets に格納した GOOGLE_SA_KEY（サービスアカウント鍵 JSON）を読み出す。
// 鍵はコードや .env に直書きせず、`wrangler secret put GOOGLE_SA_KEY` で設定する。
// =============================================================================

import type { ServiceAccount } from "../scheduler";

export function loadServiceAccount(env: Env): ServiceAccount {
  try {
    return JSON.parse(env.GOOGLE_SA_KEY);
  } catch {
    throw new Error(
      "GOOGLE_SA_KEY が未設定か、JSON として不正です。`wrangler secret put GOOGLE_SA_KEY` でサービスアカウント鍵を設定してください。"
    );
  }
}
