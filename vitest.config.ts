import { defineConfig } from "vitest/config";

// 純粋関数（区間演算・パース・トークン整形など）の単体テスト。
// Worker ランタイムは不要なので node 環境で動かす（vite.config の Cloudflare
// プラグインは読み込まない）。DO/Worker 挙動を試すときは別途 workers-pool を検討。
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
