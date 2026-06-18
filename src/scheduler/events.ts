// =============================================================================
// scheduler/events
// Google Calendar への予約確定（events.insert）。
// 純粋部分（決定的な event id・リクエストボディ生成）と、API 呼び出しを分ける。
// =============================================================================

/** 予約確定の下書き。 */
export interface EventDraft {
  /**
   * 依頼者本人のメール。実際の主催者は作成先カレンダー（primary）の所有者で
   * 決まるため body には入らず、これは冪等キー生成にのみ使う。
   */
  organizer: string;
  title: string;
  startISO: string;
  endISO: string;
  attendees: string[];
  timeZone?: string;
  description?: string;
  addMeet?: boolean;
}

/**
 * 予約の決定的 id（Google event id, base32hex）。
 * 同じ予約（主催者＋開始＋終了＋参加者集合＋タイトル）からは常に同じ id を生成し、
 * リトライ時の二重作成を 409 で弾けるようにする。参加者の順序には依存しない。
 */
export async function buildEventId(draft: EventDraft): Promise<string> {
  const key = [
    draft.organizer,
    draft.startISO,
    draft.endISO,
    draft.title,
    [...draft.attendees].sort().join(",")
  ].join("|");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key)
  );
  // hex（0-9a-f）は Google の event id 文字集合（base32hex: 0-9a-v）の部分集合。
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** events.insert に渡すイベントリソース（body）。 */
export interface EventRequestBody {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: { email: string }[];
  conferenceData?: {
    createRequest: {
      requestId: string;
      conferenceSolutionKey: { type: "hangoutsMeet" };
    };
  };
}

/**
 * EventDraft と決定的 id から events.insert のリクエストボディを組み立てる純粋関数。
 * addMeet のときだけ Google Meet 発行用の conferenceData を付ける（requestId は id 流用）。
 */
export function buildEventRequest(
  draft: EventDraft,
  eventId: string
): EventRequestBody {
  const timeZone = draft.timeZone ?? "Asia/Tokyo";
  const body: EventRequestBody = {
    id: eventId,
    summary: draft.title,
    start: { dateTime: draft.startISO, timeZone },
    end: { dateTime: draft.endISO, timeZone },
    attendees: draft.attendees.map((email) => ({ email }))
  };
  if (draft.description) {
    body.description = draft.description;
  }
  if (draft.addMeet) {
    body.conferenceData = {
      createRequest: {
        requestId: eventId,
        conferenceSolutionKey: { type: "hangoutsMeet" }
      }
    };
  }
  return body;
}

export interface CreateEventResult {
  id: string;
  htmlLink?: string;
  hangoutLink?: string;
  /** 同じ予約が既に存在した（409）ため作成はスキップした。 */
  alreadyExists: boolean;
}

/**
 * 依頼者本人のトークンで予約を作成し、参加者へ招待を送る（events.insert）。
 * 決定的 id により、同じ予約の再実行は 409 となり「作成済み」として成功扱いにする。
 * 403/スコープ不足などは status 付きで throw し、呼び出し側で再ログイン案内に変換する。
 */
export async function createEvent(
  accessToken: string,
  draft: EventDraft
): Promise<CreateEventResult> {
  const eventId = await buildEventId(draft);
  const body = buildEventRequest(draft, eventId);

  const url = new URL(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events"
  );
  url.searchParams.set("sendUpdates", "all");
  if (draft.addMeet) {
    url.searchParams.set("conferenceDataVersion", "1");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  // 同じ id が既にある＝リトライ等の二重作成。成功として扱う。
  if (res.status === 409) {
    return { id: eventId, alreadyExists: true };
  }
  if (!res.ok) {
    throw new Error(`events.insert failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    id?: string;
    htmlLink?: string;
    hangoutLink?: string;
  };
  return {
    id: data.id ?? eventId,
    htmlLink: data.htmlLink,
    hangoutLink: data.hangoutLink,
    alreadyExists: false
  };
}
