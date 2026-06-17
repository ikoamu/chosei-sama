// =============================================================================
// client/lib/participants
// 参加者ピッカーの選択結果から、ChatAgent に送る自然文メッセージを組み立てる。
// 「自分」が参加者に含まれるか（=主催者として明示）で文面を分岐する純粋関数。
// =============================================================================

import type { DirectoryPerson } from "./directory.ts";

const label = (p: DirectoryPerson) => `${p.name} <${p.email}>`;

/**
 * 選択された参加者一覧から調整依頼メッセージを生成する。
 * self が selected に含まれていれば「主催はあなた」と明示する。
 */
export function buildScheduleMessage(
  selected: DirectoryPerson[],
  self: { name: string; email: string }
): string {
  const list = selected.map(label).join("、");
  const selfIncluded = selected.some((p) => p.email === self.email);
  const note = selfIncluded
    ? `主催はあなた（${self.name} <${self.email}>）です。`
    : "私自身は参加しません。";
  return `参加者は ${list} です。${note}全員の空き時間を調整したいので、空いている時間を提案してください。`;
}
