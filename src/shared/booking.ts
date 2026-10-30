// =============================================================================
// shared/booking
// 予約確定の入力と、既定タイトルの組み立て（docs/adr/0003: タイトルは固定の形）。
// =============================================================================

export interface Participant {
  email: string;
  name: string;
}

/** 予約確定（POST /api/events）の入力。主催者はセッションの本人。 */
export interface BookingRequest {
  /** 参加者（自分を含んでよい。招待からは自分を除く）。 */
  participants: Participant[];
  /** 開始時刻（定期なら初回）。ISO 8601。 */
  startISO: string;
  durationMinutes: number;
  recurrence?: { everyNWeeks: number; occurrences: number };
}

/** 「打ち合わせ（主催者・A・B）」。主催者を先頭に、残りは並び順のまま。 */
export function defaultTitle(
  organizer: Participant,
  participants: Participant[]
): string {
  const others = participants
    .filter((p) => p.email !== organizer.email)
    .map((p) => p.name);
  return `打ち合わせ（${[organizer.name, ...others].join("・")}）`;
}
