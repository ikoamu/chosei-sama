// =============================================================================
// server/api/testing
// API テスト用の共有ヘルパー（テストからのみ使う）。
// Request の組み立て・ログイン済みセッション Cookie・Google / Jev を模した fetch。
// =============================================================================

import { vi } from "vitest";
import { createSessionCookie } from "../auth/session.ts";

export const env = {
  GOOGLE_CLIENT_ID: "cid",
  GOOGLE_CLIENT_SECRET: "csecret",
  ALLOWED_DOMAIN: "example.com",
  COOKIE_SECRET: "test-cookie-secret",
  TYPESAFE_API_KEY: "ts-key"
} as Env;

export function apiRequest(
  path: string,
  body: unknown,
  cookie?: string
): Request {
  return new Request(`https://chosei.example.com${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: JSON.stringify(body)
  });
}

/** ログイン済みのセッション Cookie（Cookie ヘッダに載せる name=value 部分）。 */
export async function sessionCookie(): Promise<string> {
  const setCookie = await createSessionCookie(
    {
      email: "me@example.com",
      name: "自分",
      picture: "",
      domain: "example.com",
      refreshToken: "rt"
    },
    env.COOKIE_SECRET
  );
  return setCookie.split(";")[0];
}

type BusyMap = Record<string, { start: string; end: string }[] | "error">;

const EVENTS_URL =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/**
 * Google を模した fetch。token エンドポイントは access_token を返し、
 * FreeBusy は busy（"error" を指定した ID は errors 付き＝読めない）を、
 * events.insert は htmlLink 付きの作成結果を返す。
 * 戻り値の insertedEvents() で events.insert に送られた body を取り出せる。
 */
export function stubGoogle(busy: BusyMap = {}) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
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
      if (url.startsWith(EVENTS_URL)) {
        const body = JSON.parse(String(init?.body));
        return Response.json({
          id: body.id,
          htmlLink: `https://calendar.google.com/event?eid=${body.id}`
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }
  );
  vi.stubGlobal("fetch", fetchMock);
  return {
    insertedEvents: () =>
      fetchMock.mock.calls
        .filter(([input]) => String(input).startsWith(EVENTS_URL))
        .map(([, init]) => JSON.parse(String(init?.body)))
  };
}

const JEV_URL = "https://api.typesafe.ai/v1/systemone";

/**
 * Jev を模した fetch。respond がリクエスト body から応答を作る（例外を投げれば
 * 通信エラー扱い）。戻り値の requests() で送られた body とヘッダを取り出せる。
 */
export function stubJev(
  respond: (body: { state: string }) => Promise<Response>
) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url !== JEV_URL) {
        throw new Error(`unexpected fetch: ${url}`);
      }
      return respond(JSON.parse(String(init?.body)));
    }
  );
  vi.stubGlobal("fetch", fetchMock);
  return {
    requests: () =>
      fetchMock.mock.calls.map(([, init]) => ({
        body: JSON.parse(String(init?.body)),
        headers: new Headers(init?.headers)
      }))
  };
}
