// =============================================================================
// env.secrets.d.ts
// Secrets（`wrangler secret put` で設定）は wrangler.jsonc に現れないため、
// `wrangler types` が生成する env.d.ts には含まれない。再生成で型が消えないよう、
// ここで Env に補う。値そのものは Cloudflare の Secrets にのみ存在し、
// コードや .env には置かない。
//
// import / export を書かないこと（グローバルな interface マージのため）。
// =============================================================================

interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  ALLOWED_DOMAIN: string;
  COOKIE_SECRET: string;
}
