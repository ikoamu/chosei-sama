// =============================================================================
// server/tools/calendar-tools
// 調整ツール（読み取り＆提案は自動実行可・予約のみ承認制）。
// 依頼者本人の OAuth アクセストークンで、ディレクトリ検索／FreeBusy 照会／予約を行う。
// =============================================================================

import { tool } from "ai";
import { z } from "zod";
import {
  createEvent,
  suggestRecurringSlots,
  suggestSlots
} from "../../scheduler";
import { searchDirectory } from "../../shared/directory";
import type { ChatAgent } from "../chat-agent";

/** preferredStartHour / preferredEndHour の両方が揃ったときだけ希望帯にする。 */
function toPreferredWindow(startHour?: number, endHour?: number) {
  return startHour != null && endHour != null
    ? { startHour, endHour }
    : undefined;
}

/** 調整さまは日本時間固定で扱う。 */
const TIME_ZONE = "Asia/Tokyo";

const RELOGIN =
  "カレンダーへのアクセス権限がありません。カレンダー権限を含めて再ログインしてください。";

/** 読めなかった参加者を名指しするメッセージ。 */
function unreadableMessage(ids: string[]): string {
  return `次の参加者の空き情報を取得できませんでした: ${ids.join(
    "、"
  )}。これらの方を参加者から外すか、カレンダーの予定共有設定をご確認ください。`;
}

/** トークン期限切れ・スコープ不足（401/403）は再ログイン案内に変換する。 */
function toUserError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/\b(401|403)\b/.test(msg) || /insufficient|scope/i.test(msg)) {
    return RELOGIN;
  }
  return msg;
}

// ---------------------------------------------------------------------------
// 入力スキーマ（zod）。各ツール定義から切り出して定義する。
// ---------------------------------------------------------------------------

const weekdaysSchema = z
  .array(z.number().int().min(0).max(6))
  .optional()
  .describe(
    "候補に含める曜日（0=日,1=月,…,5=金,6=土）。例: 金曜のみなら [5]。未指定なら平日"
  );

const findPeopleInput = z.object({
  query: z.string().describe("検索する名前またはメールの一部")
});

const suggestSlotsInput = z.object({
  members: z
    .array(z.string())
    .describe("参加者全員のメールアドレス（カレンダーID）"),
  durationMinutes: z.number().int().positive().describe("会議の長さ（分）"),
  timeMin: z.string().describe("検索範囲の開始（ISO 8601）"),
  timeMax: z.string().describe("検索範囲の終了（ISO 8601）"),
  preferredStartHour: z
    .number()
    .int()
    .min(0)
    .max(23)
    .optional()
    .describe("希望時間帯の開始時（ローカル時刻）"),
  preferredEndHour: z
    .number()
    .int()
    .min(0)
    .max(23)
    .optional()
    .describe("希望時間帯の終了時（ローカル時刻）"),
  weekdays: weekdaysSchema
});

const suggestRecurringInput = z.object({
  members: z.array(z.string()).describe("参加者全員のメールアドレス"),
  durationMinutes: z
    .number()
    .int()
    .positive()
    .describe("1回あたりの会議の長さ（分）"),
  firstDate: z
    .string()
    .describe(
      "探索の開始日（ISO 8601）。この日以降を対象期間の下限とする。曜日の指定ではない"
    ),
  occurrences: z
    .number()
    .int()
    .positive()
    .describe("検証するオカレンス数（例: 6）"),
  everyNWeeks: z
    .number()
    .int()
    .positive()
    .describe("開催頻度（1=毎週, 2=隔週）"),
  preferredStartHour: z
    .number()
    .int()
    .min(0)
    .max(23)
    .optional()
    .describe("希望時間帯の開始時"),
  preferredEndHour: z
    .number()
    .int()
    .min(0)
    .max(23)
    .optional()
    .describe("希望時間帯の終了時"),
  weekdays: weekdaysSchema
});

const createEventInput = z.object({
  title: z.string().describe("予定のタイトル"),
  startISO: z.string().describe("開始時刻（ISO 8601）"),
  endISO: z.string().describe("終了時刻（ISO 8601）"),
  attendees: z
    .array(z.string())
    .describe("招待する参加者のメールアドレス（主催者本人は不要）"),
  description: z.string().optional().describe("予定の説明（任意）"),
  addMeet: z
    .boolean()
    .default(true)
    .describe("Google Meet リンクを付けるか（既定: 付ける）"),
  recurrence: z
    .object({
      everyNWeeks: z
        .number()
        .int()
        .positive()
        .describe("開催頻度（1=毎週, 2=隔週）"),
      occurrences: z.number().int().positive().describe("開催回数")
    })
    .optional()
    .describe(
      "定例のとき指定。Google の繰り返しで1つの定例予定として作成する。startISO は初回。単発のときは省略"
    )
});

// ---------------------------------------------------------------------------
// ツール定義。各ツールを個別のファクトリ関数に分離する。
// ---------------------------------------------------------------------------

function findPeopleTool(agent: ChatAgent) {
  return tool({
    description:
      "自然文中の名前（例: 田中さん）をドメインの同僚（メールアドレス）に解決する。suggestSlots などに渡すメールを得るために使う。",
    inputSchema: findPeopleInput,
    execute: async ({ query }) => {
      if (!query.trim()) {
        return { message: "検索する名前を指定してください。" };
      }
      const accessToken = await agent.getCalendarAccessToken();
      if (!accessToken) {
        return { error: RELOGIN };
      }
      try {
        const people = await searchDirectory(accessToken, query.trim());
        if (people.length === 0) {
          return {
            message: `「${query}」に一致する同僚が見つかりませんでした。`
          };
        }
        // name と email のみ返す（写真は不要）。
        return {
          people: people.map((p) => ({ name: p.name, email: p.email }))
        };
      } catch (err) {
        console.error("[findPeople] failed:", err);
        return { error: toUserError(err) };
      }
    }
  });
}

function suggestSlotsTool(agent: ChatAgent) {
  return tool({
    description:
      "指定メンバー全員が空いている単発ミーティングの候補時間を検索する",
    inputSchema: suggestSlotsInput,
    execute: async ({
      members,
      durationMinutes,
      timeMin,
      timeMax,
      preferredStartHour,
      preferredEndHour,
      weekdays
    }) => {
      const accessToken = await agent.getCalendarAccessToken();
      if (!accessToken) {
        return { error: RELOGIN };
      }
      try {
        const { candidates, unreadable } = await suggestSlots({
          accessToken,
          calendarIds: members,
          timeMin: new Date(timeMin),
          timeMax: new Date(timeMax),
          preferences: {
            durationMinutes,
            timeZone: TIME_ZONE,
            allowedWeekdays: weekdays,
            preferredWindow: toPreferredWindow(
              preferredStartHour,
              preferredEndHour
            )
          }
        });
        if (unreadable.length > 0) {
          return { error: unreadableMessage(unreadable) };
        }
        if (candidates.length === 0) {
          return {
            message: "指定期間内に全員が空いている枠が見つかりませんでした。"
          };
        }
        return { candidates };
      } catch (err) {
        console.error("[suggestSlots] failed:", err);
        return { error: toUserError(err) };
      }
    }
  });
}

function suggestRecurringSlotsTool(agent: ChatAgent) {
  return tool({
    description:
      "定期開催のミーティングで、全オカレンスにわたり全員が空いている曜日・時間帯を検索する",
    inputSchema: suggestRecurringInput,
    execute: async ({
      members,
      durationMinutes,
      firstDate,
      occurrences,
      everyNWeeks,
      preferredStartHour,
      preferredEndHour,
      weekdays
    }) => {
      const accessToken = await agent.getCalendarAccessToken();
      if (!accessToken) {
        return { error: RELOGIN };
      }
      try {
        const { candidates, unreadable } = await suggestRecurringSlots({
          accessToken,
          calendarIds: members,
          firstDate: new Date(firstDate),
          occurrences,
          everyNWeeks,
          preferences: {
            durationMinutes,
            timeZone: TIME_ZONE,
            allowedWeekdays: weekdays,
            preferredWindow: toPreferredWindow(
              preferredStartHour,
              preferredEndHour
            )
          }
        });
        if (unreadable.length > 0) {
          return { error: unreadableMessage(unreadable) };
        }
        if (candidates.length === 0) {
          return {
            message:
              "指定条件で全オカレンス空いている枠が見つかりませんでした。"
          };
        }
        return { candidates };
      } catch (err) {
        console.error("[suggestRecurringSlots] failed:", err);
        return { error: toUserError(err) };
      }
    }
  });
}

function createEventTool(agent: ChatAgent) {
  return tool({
    description:
      "確定した候補をカレンダー予定として作成し、参加者へ招待を送る。書き込み（副作用）のため必ずユーザー承認を挟む。",
    // 副作用ツール: 実行前に必ず人が承認する（CLAUDE.md ガードレール）。
    needsApproval: true,
    inputSchema: createEventInput,
    execute: async ({
      title,
      startISO,
      endISO,
      attendees,
      description,
      addMeet,
      recurrence
    }) => {
      const accessToken = await agent.getCalendarAccessToken();
      if (!accessToken) {
        return { error: RELOGIN };
      }
      try {
        const result = await createEvent(accessToken, {
          organizer: agent.state.userEmail,
          title,
          startISO,
          endISO,
          attendees,
          timeZone: TIME_ZONE,
          description,
          addMeet,
          recurrence
        });
        return {
          created: true,
          alreadyExists: result.alreadyExists,
          htmlLink: result.htmlLink,
          hangoutLink: result.hangoutLink,
          message: result.alreadyExists
            ? "同じ予約が既に作成済みです。"
            : "予約を作成し、参加者に招待を送りました。"
        };
      } catch (err) {
        console.error("[createEvent] failed:", err);
        return { error: toUserError(err) };
      }
    }
  });
}

export function calendarTools(agent: ChatAgent) {
  return {
    findPeople: findPeopleTool(agent),
    suggestSlots: suggestSlotsTool(agent),
    suggestRecurringSlots: suggestRecurringSlotsTool(agent),
    createEvent: createEventTool(agent)
  };
}
