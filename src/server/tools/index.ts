// =============================================================================
// server/tools
// ChatAgent が streamText に渡す自前ツール（カレンダー照会 ＋ タスク管理）を
// 1 つのオブジェクトに束ねる。MCP ツールは呼び出し側で spread する。
// =============================================================================

import type { ChatAgent } from "../chat-agent";
import { calendarTools } from "./calendar-tools";
import { taskTools } from "./task-tools";

export function buildTools(agent: ChatAgent) {
  return {
    ...calendarTools(agent),
    ...taskTools(agent)
  };
}
