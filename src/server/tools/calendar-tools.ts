// =============================================================================
// server/tools/calendar-tools
// カレンダー照会ツール（読み取り専用・自動実行可）。
// 依頼者本人の OAuth アクセストークンで FreeBusy を照会し、全員が空いている候補を返す。
// =============================================================================

import { tool } from "ai";
import { z } from "zod";
import {
  createEvent,
  suggestRecurringSlots,
  suggestSlots
} from "../../scheduler";
import type { ChatAgent } from "../chat-agent";

/** preferredStartHour / preferredEndHour の両方が揃ったときだけ希望帯にする。 */
function toPreferredWindow(startHour?: number, endHour?: number) {
  return startHour != null && endHour != null
    ? { startHour, endHour }
    : undefined;
}

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

export function calendarTools(agent: ChatAgent) {
  return {
    suggestSlots: tool({
      description:
        "指定メンバー全員が空いている単発ミーティングの候補時間を検索する",
      inputSchema: z.object({
        members: z
          .array(z.string())
          .describe("参加者全員のメールアドレス（カレンダーID）"),
        durationMinutes: z
          .number()
          .int()
          .positive()
          .describe("会議の長さ（分）"),
        timeMin: z.string().describe("検索範囲の開始（ISO 8601）"),
        timeMax: z.string().describe("検索範囲の終了（ISO 8601）"),
        timeZone: z
          .string()
          .default("Asia/Tokyo")
          .describe("IANA タイムゾーン"),
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
          .describe("希望時間帯の終了時（ローカル時刻）")
      }),
      execute: async ({
        members,
        durationMinutes,
        timeMin,
        timeMax,
        timeZone,
        preferredStartHour,
        preferredEndHour
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
              timeZone,
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
    }),

    suggestRecurringSlots: tool({
      description:
        "定期開催のミーティングで、全オカレンスにわたり全員が空いている曜日・時間帯を検索する",
      inputSchema: z.object({
        members: z.array(z.string()).describe("参加者全員のメールアドレス"),
        durationMinutes: z
          .number()
          .int()
          .positive()
          .describe("1回あたりの会議の長さ（分）"),
        firstDate: z
          .string()
          .describe("開始日（ISO 8601）。この日以降の最初の該当曜日から開始"),
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
        timeZone: z
          .string()
          .default("Asia/Tokyo")
          .describe("IANA タイムゾーン"),
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
          .describe("希望時間帯の終了時")
      }),
      execute: async ({
        members,
        durationMinutes,
        firstDate,
        occurrences,
        everyNWeeks,
        timeZone,
        preferredStartHour,
        preferredEndHour
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
              timeZone,
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
    }),

    createEvent: tool({
      description:
        "確定した候補をカレンダー予定として作成し、参加者へ招待を送る。書き込み（副作用）のため必ずユーザー承認を挟む。",
      // 副作用ツール: 実行前に必ず人が承認する（CLAUDE.md ガードレール）。
      needsApproval: true,
      inputSchema: z.object({
        title: z.string().describe("予定のタイトル"),
        startISO: z.string().describe("開始時刻（ISO 8601）"),
        endISO: z.string().describe("終了時刻（ISO 8601）"),
        attendees: z
          .array(z.string())
          .describe("招待する参加者のメールアドレス（主催者本人は不要）"),
        timeZone: z
          .string()
          .default("Asia/Tokyo")
          .describe("IANA タイムゾーン"),
        description: z.string().optional().describe("予定の説明（任意）"),
        addMeet: z
          .boolean()
          .default(true)
          .describe("Google Meet リンクを付けるか（既定: 付ける）")
      }),
      execute: async ({
        title,
        startISO,
        endISO,
        attendees,
        timeZone,
        description,
        addMeet
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
            timeZone,
            description,
            addMeet
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
    })
  };
}
