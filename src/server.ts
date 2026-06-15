import { createWorkersAI } from "workers-ai-provider";
import { callable, routeAgentRequest, type Schedule } from "agents";
import { getSchedulePrompt, scheduleSchema } from "agents/schedule";
import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import {
  convertToModelMessages,
  pruneMessages,
  stepCountIs,
  streamText,
  tool
} from "ai";
import { z } from "zod";
import {
  suggestSlots,
  suggestRecurringSlots,
  type ServiceAccount
} from "./scheduler-core";
import { handleOAuthRoute, verifySession } from "./auth";

export class ChatAgent extends AIChatAgent<Env> {
  maxPersistedMessages = 100;
  private userEmail = "";

  @callable()
  setUserEmail(email: string) {
    this.userEmail = email;
  }

  onStart() {
    this.mcp.configureOAuthCallback({
      customHandler: (result) => {
        if (result.authSuccess) {
          return new Response("<script>window.close();</script>", {
            headers: { "content-type": "text/html" },
            status: 200
          });
        }
        return new Response(
          `Authentication Failed: ${result.authError || "Unknown error"}`,
          { headers: { "content-type": "text/plain" }, status: 400 }
        );
      }
    });
  }

  @callable()
  async addServer(name: string, url: string) {
    return await this.addMcpServer(name, url);
  }

  @callable()
  async removeServer(serverId: string) {
    await this.removeMcpServer(serverId);
  }

  private loadServiceAccount(): ServiceAccount {
    try {
      return JSON.parse(this.env.GOOGLE_SA_KEY);
    } catch {
      throw new Error(
        "GOOGLE_SA_KEY が未設定か、JSON として不正です。`wrangler secret put GOOGLE_SA_KEY` でサービスアカウント鍵を設定してください。"
      );
    }
  }

  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const mcpTools = this.mcp.getAITools();
    const workersai = createWorkersAI({ binding: this.env.AI });

    const result = streamText({
      model: workersai("@cf/moonshotai/kimi-k2.6", {
        sessionAffinity: this.sessionAffinity
      }),
      system: `あなたは「調整さま」— Google Workspace のカレンダーを参照して、メンバー全員が空いている会議時間を提案するアシスタントです。

できること:
- 単発ミーティング: メンバーのメールアドレス・所要時間・検索期間を受け取り、全員が空いている候補を提案する
- 定期開催: メンバー・所要時間・頻度（毎週/隔週）を受け取り、全オカレンスで空いている曜日・時刻を提案する
- ユーザーのタイムゾーンを自動検出する

手順:
1. ユーザーから参加メンバー・所要時間・希望期間を聞き取る
2. suggestSlots または suggestRecurringSlots ツールで候補を検索する
3. 結果を見やすく整形して提示する

注意:
- 候補の提示は自動で行ってよいが、カレンダーへの書き込み・招待送信はしない
- タイムゾーンはユーザーに確認するか、getUserTimezone で自動取得する
- 日時は必ず ISO 8601 形式で渡す
${this.userEmail ? `\n現在のユーザー: ${this.userEmail}\nsuggestSlots / suggestRecurringSlots の subject にはこのメールアドレスを使ってください。` : "- subject にはリクエストしているユーザー本人のメールアドレスを渡す"}

${getSchedulePrompt({ date: new Date() })}`,
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages"
      }),
      tools: {
        ...mcpTools,

        suggestSlots: tool({
          description:
            "指定メンバー全員が空いている単発ミーティングの候補時間を検索する",
          inputSchema: z.object({
            members: z
              .array(z.string())
              .describe("参加者全員のメールアドレス（カレンダーID）"),
            subject: z
              .string()
              .describe(
                "リクエストしているユーザーのメールアドレス（ドメイン委任の subject）"
              ),
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
            subject,
            durationMinutes,
            timeMin,
            timeMax,
            timeZone,
            preferredStartHour,
            preferredEndHour
          }) => {
            const candidates = await suggestSlots({
              serviceAccount: this.loadServiceAccount(),
              subject,
              calendarIds: members,
              timeMin: new Date(timeMin),
              timeMax: new Date(timeMax),
              preferences: {
                durationMinutes,
                timeZone,
                preferredWindow:
                  preferredStartHour != null && preferredEndHour != null
                    ? {
                        startHour: preferredStartHour,
                        endHour: preferredEndHour
                      }
                    : undefined
              }
            });
            if (candidates.length === 0) {
              return {
                message:
                  "指定期間内に全員が空いている枠が見つかりませんでした。"
              };
            }
            return { candidates };
          }
        }),

        suggestRecurringSlots: tool({
          description:
            "定期開催のミーティングで、全オカレンスにわたり全員が空いている曜日・時間帯を検索する",
          inputSchema: z.object({
            members: z.array(z.string()).describe("参加者全員のメールアドレス"),
            subject: z
              .string()
              .describe("リクエストしているユーザーのメールアドレス"),
            durationMinutes: z
              .number()
              .int()
              .positive()
              .describe("1回あたりの会議の長さ（分）"),
            firstDate: z
              .string()
              .describe(
                "開始日（ISO 8601）。この日以降の最初の該当曜日から開始"
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
            subject,
            durationMinutes,
            firstDate,
            occurrences,
            everyNWeeks,
            timeZone,
            preferredStartHour,
            preferredEndHour
          }) => {
            const candidates = await suggestRecurringSlots({
              serviceAccount: this.loadServiceAccount(),
              subject,
              calendarIds: members,
              firstDate: new Date(firstDate),
              occurrences,
              everyNWeeks,
              preferences: {
                durationMinutes,
                timeZone,
                preferredWindow:
                  preferredStartHour != null && preferredEndHour != null
                    ? {
                        startHour: preferredStartHour,
                        endHour: preferredEndHour
                      }
                    : undefined
              }
            });
            if (candidates.length === 0) {
              return {
                message:
                  "指定条件で全オカレンス空いている枠が見つかりませんでした。"
              };
            }
            return { candidates };
          }
        }),

        getUserTimezone: tool({
          description:
            "ユーザーのブラウザからタイムゾーンを取得する。ローカル時刻やタイムゾーンが必要なときに使う。",
          inputSchema: z.object({})
        }),

        scheduleTask: tool({
          description:
            "タスクを後で実行するようスケジュールする。リマインダーや定期チェックに使う。",
          inputSchema: scheduleSchema,
          execute: async ({ when, description }) => {
            if (when.type === "no-schedule") {
              return "Not a valid schedule input";
            }
            const input =
              when.type === "scheduled"
                ? when.date
                : when.type === "delayed"
                  ? when.delayInSeconds
                  : when.type === "cron"
                    ? when.cron
                    : null;
            if (!input) {
              return "Invalid schedule type";
            }
            try {
              this.schedule(input, "executeTask", description, {
                idempotent: true
              });
              return `Task scheduled: "${description}" (${when.type}: ${input})`;
            } catch (error) {
              return `Error scheduling task: ${error}`;
            }
          }
        }),

        getScheduledTasks: tool({
          description: "スケジュール済みのタスク一覧を返す",
          inputSchema: z.object({}),
          execute: async () => {
            const tasks = this.getSchedules();
            return tasks.length > 0 ? tasks : "No scheduled tasks found.";
          }
        }),

        cancelScheduledTask: tool({
          description: "スケジュール済みのタスクをIDで取り消す",
          inputSchema: z.object({
            taskId: z.string().describe("取り消すタスクのID")
          }),
          execute: async ({ taskId }) => {
            try {
              this.cancelSchedule(taskId);
              return `Task ${taskId} cancelled.`;
            } catch (error) {
              return `Error cancelling task: ${error}`;
            }
          }
        })
      },
      stopWhen: stepCountIs(5),
      abortSignal: options?.abortSignal
    });

    return result.toUIMessageStreamResponse();
  }

  async executeTask(description: string, _task: Schedule<string>) {
    console.log(`Executing scheduled task: ${description}`);
    this.broadcast(
      JSON.stringify({
        type: "scheduled-task",
        description,
        timestamp: new Date().toISOString()
      })
    );
  }
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/oauth/")) {
      return handleOAuthRoute(request, env);
    }

    if (url.pathname.startsWith("/agents/")) {
      const session = await verifySession(
        request.headers.get("Cookie"),
        env.COOKIE_SECRET
      );
      if (!session) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
