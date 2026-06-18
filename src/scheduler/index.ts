// =============================================================================
// scheduler
// Google Calendar の FreeBusy を使って複数メンバーの共通空き時間を探す提案エンジン。
// Cloudflare Workers / Agents 上で動くよう Web Crypto と fetch のみで実装し、
// 外部ライブラリ・Node 固有 API には依存しない。
//
// このバレルが公開 API。内部モジュール（intervals / timezone / ...）へ直接
//依存せず、ここ経由で import する。
// =============================================================================

export type {
  Interval,
  RecurringCandidate,
  SlotCandidate,
  SlotPreferences,
  WorkingHours
} from "./types";

export {
  queryFreeBusy,
  parseFreeBusyResponse,
  type FreeBusyResult
} from "./freebusy";
export { mergeIntervals, subtractIntervals, overlaps } from "./intervals";
export { workingWindowsInRange } from "./windows";
export { commonFree, findSlots, scoreSlot } from "./slots";
export {
  suggestSlots,
  suggestRecurringSlots,
  type SuggestSlotsOptions,
  type SuggestSlotsResult,
  type SuggestRecurringOptions,
  type SuggestRecurringResult
} from "./suggest";
