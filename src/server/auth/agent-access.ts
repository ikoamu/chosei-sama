// =============================================================================
// server/auth/agent-access
// /agents/* へのアクセス可否判定（純粋関数）。
// このアプリの Agent インスタンスは依頼者のメールで名付けられる。ログイン済みでも
// 他人のメール名のインスタンスには接続させない（他人のチャット履歴等の覗き見防止）。
// =============================================================================

/**
 * /agents/{class}/{name} のインスタンス名を取り出す（URL デコード済み）。
 * partyserver と同じく pathname を「/」分割した3番目の要素がインスタンス名。
 * インスタンス名が無いパス（例: /agents/chat-agent）は undefined。
 */
function agentInstanceName(pathname: string): string | undefined {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "agents" || !parts[2]) {
    return undefined;
  }
  try {
    return decodeURIComponent(parts[2]);
  } catch {
    return parts[2];
  }
}

/**
 * その /agents/* パスが「自分（email）の Agent インスタンス」かどうか。
 * インスタンス名を持たないパスは routeAgentRequest 側の判断に委ねる（true）。
 * メールは大文字小文字を無視して比較する。
 */
export function isOwnAgentPath(pathname: string, email: string): boolean {
  const name = agentInstanceName(pathname);
  if (!name) {
    return true;
  }
  return name.toLowerCase() === email.toLowerCase();
}
