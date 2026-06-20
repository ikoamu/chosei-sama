// =============================================================================
// server/tools/task-tools
// 補助ツール。Durable Object の cron を使ったタスクのスケジュール・一覧・取消。
// =============================================================================

import { tool } from "ai";
import { z } from "zod";
import { scheduleSchema } from "agents/schedule";
import type { ChatAgent } from "../chat-agent";

export function taskTools(agent: ChatAgent) {
  return {
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
          agent.schedule(input, "executeTask", description, {
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
        const tasks = agent.getSchedules();
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
          agent.cancelSchedule(taskId);
          return `Task ${taskId} cancelled.`;
        } catch (error) {
          return `Error cancelling task: ${error}`;
        }
      }
    })
  };
}
