// =============================================================================
// server/tools/calendar-tools
// カレンダー照会ツール（読み取り専用・自動実行可）。
// scheduler の高レベル API を呼び、全員が空いている候補を返す。
// =============================================================================

import { tool } from "ai";
import { z } from "zod";
import { suggestRecurringSlots, suggestSlots } from "../../scheduler";
import type { ChatAgent } from "../chat-agent";
import { loadServiceAccount } from "../service-account";

/** preferredStartHour / preferredEndHour の両方が揃ったときだけ希望帯にする。 */
function toPreferredWindow(startHour?: number, endHour?: number) {
  return startHour != null && endHour != null
    ? { startHour, endHour }
    : undefined;
}

const NO_SUBJECT =
  "ログインユーザーが未確定のため、カレンダーを照会できません。再ログインしてください。";

export function calendarTools(agent: ChatAgent, env: Env) {
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
        if (!agent.state.userEmail) {
          return { error: NO_SUBJECT };
        }
        try {
          const candidates = await suggestSlots({
            serviceAccount: loadServiceAccount(env),
            subject: agent.state.userEmail,
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
          if (candidates.length === 0) {
            return {
              message: "指定期間内に全員が空いている枠が見つかりませんでした。"
            };
          }
          return { candidates };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[suggestSlots] failed:", msg);
          return { error: msg };
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
        if (!agent.state.userEmail) {
          return { error: NO_SUBJECT };
        }
        try {
          const candidates = await suggestRecurringSlots({
            serviceAccount: loadServiceAccount(env),
            subject: agent.state.userEmail,
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
          if (candidates.length === 0) {
            return {
              message:
                "指定条件で全オカレンス空いている枠が見つかりませんでした。"
            };
          }
          return { candidates };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[suggestRecurringSlots] failed:", msg);
          return { error: msg };
        }
      }
    })
  };
}
