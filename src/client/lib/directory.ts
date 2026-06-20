// =============================================================================
// client/lib/directory (browser only)
// ディレクトリ参照用トークンの取得（ブラウザ専用）。
// 検索ロジックと型は shared/directory に集約し、ここから再エクスポートする。
// =============================================================================

export { searchDirectory, type DirectoryPerson } from "../../shared/directory";

// ---------- トークン管理 ----------

let cached: { token: string; expiresAt: number } | null = null;

/**
 * ディレクトリ参照用の短命アクセストークンを取得する。
 * サーバーがセッション中の refresh_token で Google に問い合わせるため、
 * ブラウザでポップアップやリダイレクトは一切発生しない。
 */
export async function fetchDirectoryToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }
  const res = await fetch("/oauth/directory-token");
  if (!res.ok) {
    throw new Error(`directory token fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    accessToken: string;
    expiresIn: number;
  };
  cached = {
    token: data.accessToken,
    expiresAt: Date.now() + data.expiresIn * 1000
  };
  return cached.token;
}
