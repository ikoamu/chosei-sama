// =============================================================================
// client/lib/participants
// 参加者ピッカーの選択結果から、ChatAgent に送る自然文メッセージを組み立てる。
// 「自分」が参加者に含まれるか（=主催者として明示）で文面を分岐する純粋関数。
// =============================================================================

import type { DirectoryPerson } from "./directory.ts";

const label = (p: DirectoryPerson) => `${p.name} <${p.email}>`;

/** 調整の種別。単発か定期開催か。 */
export type ScheduleKind = "single" | "recurring";

export interface ScheduleOptions {
  /** 単発 / 定期。Agent のツール選択を確定させるシグナル。 */
  kind: ScheduleKind;
  /** 所要時間・期間などの希望条件（フリーテキスト）。 */
  details: string;
}

const kindNote = (kind: ScheduleKind) =>
  kind === "recurring"
    ? "これは定期開催の調整です。"
    : "これは単発の調整です。";

/**
 * 選択された参加者一覧から調整依頼メッセージを生成する。
 * self が selected に含まれていれば「主催はあなた」と明示する。
 * options を渡すと種別（単発/定期）と希望条件を文面に含める。
 */
export function buildScheduleMessage(
  selected: DirectoryPerson[],
  self: { name: string; email: string },
  options?: ScheduleOptions
): string {
  const list = selected.map(label).join("、");
  const selfIncluded = selected.some((p) => p.email === self.email);
  const note = selfIncluded
    ? `主催はあなた（${self.name} <${self.email}>）です。`
    : "私自身は参加しません。";
  const kind = options ? kindNote(options.kind) : "";
  const detail = options?.details.trim()
    ? `希望条件: ${options.details.trim()}。`
    : "";
  return `参加者は ${list} です。${note}${kind}${detail}全員の空き時間を調整したいので、空いている時間を提案してください。`;
}
