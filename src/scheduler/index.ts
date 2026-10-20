// =============================================================================
// scheduler
// Google Calendar の FreeBusy を使って複数メンバーの共通空き時間を探す提案エンジン。
// Cloudflare Workers / Agents 上で動くよう Web Crypto と fetch のみで実装し、
// 外部ライブラリ・Node 固有 API には依存しない。
//
// このバレルが公開 API。外部（server）とテストが実際に使うものだけを公開し、
// scheduler 内部モジュール同士は各 module を直接 import し合う。
// =============================================================================

export { createEvent } from "./events";
export { mergeIntervals, subtractIntervals } from "./intervals";
export { workingWindowsInRange } from "./windows";
export { commonFree, findSlots } from "./slots";
export { suggestSlots, suggestRecurringSlots } from "./suggest";
export { zonedWallToUtc } from "./timezone";
