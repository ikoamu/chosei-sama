// =============================================================================
// server/api/draft.test
// 下書き生成 API（POST /api/draft）の振る舞いテスト。
// Request を組み立てて handleApiRoute を直接呼び、外部（Jev の API）だけを
// fetch のモックで差し替える。
// =============================================================================

import { describe, it, expect, vi, afterEach } from "vitest";
import { handleApiRoute } from "./index.ts";
import { apiRequest, env, sessionCookie, stubJev } from "./testing.ts";
import { defaultCriteria, type CriteriaDraft } from "../../shared/criteria.ts";

const choice = (value: string, confidence = 1) => ({
  type: "choice",
  choice: value,
  confidence
});

/** 「隔週1h、来月開始、できれば午後」に対する Jev の応答（指定のない項目は該当なし）。 */
const JEV_RESPONSE = {
  model: "jev-1.14.0",
  answers: {
    kind: choice("recurring"),
    duration: choice("60"),
    frequency: choice("biweekly"),
    occurrences: choice("none"),
    anchor: choice("next_month"),
    within_days: choice("none"),
    month: choice("none"),
    day: choice("none"),
    window: choice("afternoon"),
    ...Object.fromEntries(
      [0, 1, 2, 3, 4, 5, 6].map((d) => [`wd${d}`, { type: "noul", noul: 0.02 }])
    )
  }
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("POST /api/draft", () => {
  it("未ログインなら 401 で、Jev は呼ばない", async () => {
    const jev = stubJev(async () => Response.json({}));
    const res = await handleApiRoute(
      apiRequest("/api/draft", { details: "30分" }),
      env
    );
    expect(res.status).toBe(401);
    expect(jev.requests()).toEqual([]);
  });

  it("伏せ字にした文章と API キーで Jev を呼び、下書きを返す", async () => {
    // 2026-10-21（水）12:00 JST。
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T03:00:00Z"));
    const jev = stubJev(async () => Response.json(JEV_RESPONSE));

    const res = await handleApiRoute(
      apiRequest(
        "/api/draft",
        { details: "隔週1h、来月開始、できれば午後。a@example.com も" },
        await sessionCookie()
      ),
      env
    );

    const [sent] = jev.requests();
    expect(sent.headers.get("Authorization")).toBe("Bearer ts-key");
    expect(sent.body.state).toBe("隔週1h、来月開始、できれば午後。[メール] も");
    const draft = (await res.json()) as CriteriaDraft;
    expect(draft.failed).toBe(false);
    expect(draft.criteria).toMatchObject({
      kind: "recurring",
      durationMinutes: 60,
      everyNWeeks: 2,
      startDate: "2026-11-01"
    });
    expect(draft.review).toEqual(["occurrences"]);
  });

  it.each([
    ["HTTP エラー", async () => new Response("unavailable", { status: 503 })],
    [
      "タイムアウト・通信エラー",
      async (): Promise<Response> => {
        throw new DOMException("timed out", "TimeoutError");
      }
    ],
    ["answers のない応答", async () => Response.json({ model: "jev-1.14.0" })]
  ])(
    "Jev が失敗（%s）したら、既定値の下書きで全項目を要確認にする",
    async (_, respond) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-21T03:00:00Z"));
      stubJev(respond);

      const res = await handleApiRoute(
        apiRequest("/api/draft", { details: "30分" }, await sessionCookie()),
        env
      );

      expect(res.status).toBe(200);
      const draft = (await res.json()) as CriteriaDraft;
      expect(draft.failed).toBe(true);
      expect(draft.criteria).toEqual(defaultCriteria("2026-10-21"));
      expect(draft.review.sort()).toEqual(
        Object.keys(defaultCriteria("2026-10-21")).sort()
      );
    }
  );
});
