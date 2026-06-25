// =============================================================================
// client/lib/participants
// 参加者ピッカーの選択結果から、ChatAgent に送る初回メッセージを組み立てる。
// このメッセージは「事実」だけを載せる: 解決済み参加者（メール確定）と、
// ユーザーが書いた調整条件のテキスト。解釈・振る舞いのルールはシステム
// プロンプト側に置く（docs/adr/0002）。
// =============================================================================

import type { DirectoryPerson } from "./directory.ts";

/**
 * 選択された参加者一覧から初回の調整依頼メッセージを生成する。
 * 参加者はピッカーで解決済み（メール確定）。self が含まれていれば主催を明示する。
 * details（ラベル付きの調整条件フリーテキスト）があればそのまま載せる。
 */
export function buildScheduleMessage(
  selected: DirectoryPerson[],
  self: { name: string; email: string },
  details?: string
): string {
  const roster = selected.map((p) => `- ${p.name} <${p.email}>`).join("\n");
  const selfIncluded = selected.some((p) => p.email === self.email);
  const organizer = selfIncluded
    ? `主催はあなた（${self.name} <${self.email}>）です。`
    : "私自身は参加しません。";
  const criteria = details?.trim() ? `\n\n調整条件:\n${details.trim()}` : "";
  return `参加者（解決済み・メール確定）:\n${roster}\n${organizer}${criteria}\n\n上記の参加者全員の空き時間を調整し、空いている時間を提案してください。`;
}
