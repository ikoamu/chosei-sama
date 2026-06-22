// =============================================================================
// server/chat-agent
// 調整さまの中核となる Durable Object（AIChatAgent ベース）。
// 状態・MCP 接続・cron スケジュールを持ち、チャットメッセージごとに
// Workers AI でツール呼び出し付きの応答をストリームする。
// =============================================================================

import { createWorkersAI } from "workers-ai-provider";
import {
  callable,
  type Connection,
  type ConnectionContext,
  type Schedule
} from "agents";
import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import {
  convertToModelMessages,
  pruneMessages,
  stepCountIs,
  streamText,
  wrapLanguageModel
} from "ai";
import { refreshAccessToken, verifySession } from "./auth";
import { buildSystemPrompt } from "./prompt";
import { buildTools } from "./tools";

const PRIMARY_MODEL = "@cf/moonshotai/kimi-k2.6";
const FALLBACK_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

/** SQLite に永続される Agent 状態。hibernation を跨いでも保持される。 */
interface ChatState {
  /** 認証済みリクエスト者のメール。本人トークンで誰として読む/書くかの唯一の出所。 */
  userEmail: string;
}

export class ChatAgent extends AIChatAgent<Env, ChatState> {
  maxPersistedMessages = 100;
  initialState: ChatState = { userEmail: "" };

  // 接続時にセッション Cookie を検証し、認証済みメールをサーバー側で確定する。
  // クライアントの申告に依存せず、hibernation で失われない（state は永続）。
  // フレームワークのラッパーが本処理（state 同期・ストリーム再開）を済ませた後に
  // 呼ばれる拡張フックのため、super.onConnect は呼ばない。
  async onConnect(_connection: Connection, ctx: ConnectionContext) {
    const session = await verifySession(
      ctx.request.headers.get("Cookie"),
      this.env.COOKIE_SECRET
    );
    if (!session) {
      return;
    }
    if (this.state.userEmail !== session.email) {
      this.setState({ userEmail: session.email });
    }
    // refresh_token はサーバー専用ストレージに保持する。setState はクライアントへ
    // ブロードキャストされるため秘密情報には使わない。
    await this.ctx.storage.put("refreshToken", session.refreshToken);
  }

  /**
   * 保存した refresh_token から Calendar 用の access_token を発行する。
   * 取得できなければ null（要・再ログイン）。
   */
  async getCalendarAccessToken(): Promise<string | null> {
    const refreshToken = await this.ctx.storage.get<string>("refreshToken");
    if (!refreshToken) {
      return null;
    }
    const result = await refreshAccessToken(
      refreshToken,
      this.env.GOOGLE_CLIENT_ID,
      this.env.GOOGLE_CLIENT_SECRET
    );
    return result?.accessToken ?? null;
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
      system: buildSystemPrompt(this.state.userEmail),
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages"
      }),
      tools: {
        ...mcpTools,
        ...buildTools(this)
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
