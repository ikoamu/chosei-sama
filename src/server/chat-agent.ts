// =============================================================================
// server/chat-agent
// 調整さまの中核となる Durable Object（AIChatAgent ベース）。
// 状態・MCP 接続・cron スケジュールを持ち、チャットメッセージごとに
// Workers AI でツール呼び出し付きの応答をストリームする。
// =============================================================================

import { createWorkersAI } from "workers-ai-provider";
import { callable, type Schedule } from "agents";
import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import {
  convertToModelMessages,
  pruneMessages,
  stepCountIs,
  streamText,
  wrapLanguageModel
} from "ai";
import { buildSystemPrompt } from "./prompt";
import { buildTools } from "./tools";

const PRIMARY_MODEL = "@cf/moonshotai/kimi-k2.6";
const FALLBACK_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

export class ChatAgent extends AIChatAgent<Env> {
  maxPersistedMessages = 100;
  // 認証済みリクエスト者のメール。ドメイン委任の subject（誰として読むか）の
  // 唯一の出所。接続時に client から一度だけセットされ、ツールはここを参照する。
  userEmail = "";

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

  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const mcpTools = this.mcp.getAITools();
    const workersai = createWorkersAI({ binding: this.env.AI });
    const affinity = { sessionAffinity: this.sessionAffinity };

    // primary が capacity エラー等で失敗したら fallback に切り替える
    const fallback = workersai(FALLBACK_MODEL, affinity);
    const model = wrapLanguageModel({
      model: workersai(PRIMARY_MODEL, affinity),
      middleware: {
        specificationVersion: "v3" as const,
        wrapGenerate: async ({ doGenerate, params }) => {
          try {
            return await doGenerate();
          } catch {
            return await fallback.doGenerate(params);
          }
        },
        wrapStream: async ({ doStream, params }) => {
          try {
            return await doStream();
          } catch {
            return await fallback.doStream(params);
          }
        }
      }
    });

    const result = streamText({
      model,
      system: buildSystemPrompt(this.userEmail),
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages"
      }),
      tools: {
        ...mcpTools,
        ...buildTools(this, this.env)
      },
      stopWhen: stepCountIs(5),
      abortSignal: options?.abortSignal
    });

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        const msg =
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error);
        console.error("[ChatAgent] stream error:", msg);
        return msg;
      }
    });
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
