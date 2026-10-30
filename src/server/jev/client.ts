// =============================================================================
// server/jev/client
// Jev（TypeSafe AI）の System One API を呼ぶ。SDK は使わず fetch で直接叩く
// （アーリーアクセスで SDK の Workers 対応が不明なため。docs/adr/0003）。
// =============================================================================

import type { JevAnswers } from "./draft";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";

/** 下書きは手入力の加速装置なので、待たせすぎず短めに打ち切る。 */
const TIMEOUT_MS = 3000;

/**
 * state に対して questions をまとめて問い、answers を返す。
 * HTTP エラー・タイムアウト・形の崩れた応答は throw する。
 */
export async function askJev(
  apiKey: string,
  state: string,
  questions: Record<string, unknown>
): Promise<JevAnswers> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ state, model: "jev-latest", questions }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) {
    throw new Error(`jev failed: ${res.status}`);
  }
  const data = (await res.json()) as { answers?: JevAnswers };
  if (!data.answers) {
    throw new Error("jev response has no answers");
  }
  return data.answers;
}
