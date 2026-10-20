// =============================================================================
// server/api/suggest.test
// 候補提案 API（POST /api/suggest）の振る舞いテスト。
// Request を組み立てて handleApiRoute を直接呼び、外部（Google の token /
// FreeBusy エンドポイント）だけを fetch のモックで差し替える。
// =============================================================================

import { describe, it, expect, vi, afterEach } from "vitest";
import { handleApiRoute } from "./index.ts";
import { createSessionCookie } from "../auth/session.ts";
import {
  defaultCriteria,
  type SchedulingCriteria,
  type SuggestResult
} from "../../shared/criteria.ts";

const env = {
  GOOGLE_CLIENT_ID: "cid",
  GOOGLE_CLIENT_SECRET: "csecret",
  ALLOWED_DOMAIN: "example.com",
  COOKIE_SECRET: "test-cookie-secret"
} as Env;

function suggestRequest(body: unknown, cookie?: string): Request {
  return new Request("https://chosei.example.com/api/suggest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: JSON.stringify(body)
  });
}

/** ログイン済みのセッション Cookie（Cookie ヘッダに載せる name=value 部分）。 */
async function sessionCookie(): Promise<string> {
  const setCookie = await createSessionCookie(
    {
      email: "me@example.com",
      name: "Me",
      picture: "",
      domain: "example.com",
      refreshToken: "rt"
    },
    env.COOKIE_SECRET
  );
  return setCookie.split(";")[0];
}

type BusyMap = Record<string, { start: string; end: string }[] | "error">;

/**
 * Google を模した fetch。token エンドポイントは access_token を返し、
 * FreeBusy は busy（"error" を指定した ID は errors 付き＝読めない）を返す。
 */
function stubGoogle(busy: BusyMap) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "https://oauth2.googleapis.com/token") {
      return Response.json({ access_token: "at", expires_in: 3600 });
    }
    if (url === "https://www.googleapis.com/calendar/v3/freeBusy") {
      const calendars = Object.fromEntries(
        Object.entries(busy).map(([id, b]) => [
          id,
          b === "error" ? { errors: [{ reason: "notFound" }] } : { busy: b }
        ])
      );
      return Response.json({ calendars });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
}

/** 必須項目を埋めた単発の調整条件（月曜 2026-01-05 の 1 日）。 */
function oneOff(overrides: Partial<SchedulingCriteria> = {}) {
  return {
    ...defaultCriteria("2026-01-05"),
    endDate: "2026-01-05",
    durationMinutes: 30,
    ...overrides
  };
}

/** 候補が返ったときの応答。 */
type Candidates = Extract<SuggestResult, { status: "candidates" }>;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/suggest", () => {
  it("未ログインなら 401", async () => {
    const res = await handleApiRoute(
      suggestRequest({ members: [], criteria: {} }),
      env
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/suggest の候補", () => {
  it("単発: 検索期間（終了日を含む）の勤務時間内で、全員が空いている枠を返す", async () => {
    // 9:00〜17:30 が埋まっているので、空きは 17:30〜18:00 だけ。
    stubGoogle({
      "me@example.com": [
        { start: "2026-01-05T09:00:00+09:00", end: "2026-01-05T17:30:00+09:00" }
      ],
      "a@example.com": []
    });
    const res = await handleApiRoute(
      suggestRequest(
        { members: ["me@example.com", "a@example.com"], criteria: oneOff() },
        await sessionCookie()
      ),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Candidates;
    expect(body.status).toBe("candidates");
    expect(
      (body.candidates as { startISO: string }[]).map((c) => c.startISO)
    ).toEqual(["2026-01-05T08:30:00.000Z"]);
  });

  it("定期: 開始日から頻度×回数の全回で空いている曜日・時刻を返す", async () => {
    // 月曜のみ・60分・隔週3回。2回目（1/19）の 9:00〜17:00 が埋まっているので、
    // 全回空いているのは 17:00 開始だけ。
    stubGoogle({
      "me@example.com": [
        { start: "2026-01-19T09:00:00+09:00", end: "2026-01-19T17:00:00+09:00" }
      ]
    });
    const criteria = oneOff({
      kind: "recurring",
      durationMinutes: 60,
      everyNWeeks: 2,
      occurrences: 3,
      weekdays: [1]
    });
    const res = await handleApiRoute(
      suggestRequest(
        { members: ["me@example.com"], criteria },
        await sessionCookie()
      ),
      env
    );
    const body = (await res.json()) as Candidates;
    expect(body.status).toBe("candidates");
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0]).toMatchObject({
      weekday: 1,
      localTime: "17:00",
      occurrenceStartsISO: [
        "2026-01-05T08:00:00.000Z",
        "2026-01-19T08:00:00.000Z",
        "2026-02-02T08:00:00.000Z"
      ]
    });
  });

  it("読めない参加者がいれば、その人を名指しして候補は出さない", async () => {
    stubGoogle({ "me@example.com": [], "secret@example.com": "error" });
    const res = await handleApiRoute(
      suggestRequest(
        {
          members: ["me@example.com", "secret@example.com"],
          criteria: oneOff()
        },
        await sessionCookie()
      ),
      env
    );
    expect(await res.json()).toEqual({
      status: "unreadable",
      ids: ["secret@example.com"]
    });
  });
});

describe("POST /api/suggest の入力検証", () => {
  it("必須項目が欠けていれば 400 で欠けた項目を返し、Google は呼ばない", async () => {
    stubGoogle({});
    const res = await handleApiRoute(
      suggestRequest(
        {
          members: ["me@example.com"],
          criteria: oneOff({ kind: "recurring", durationMinutes: null })
        },
        await sessionCookie()
      ),
      env
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      missing: ["durationMinutes", "occurrences"]
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
