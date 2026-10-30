// =============================================================================
// client/components/BookButton
// 候補 1 件ぶんの予約ボタン。押したこと自体が承認で、押すまで書き込まない
// （docs/adr/0003）。成功したらカレンダーへのリンクを出す。
// =============================================================================

import { useState } from "react";
import { Button } from "@cloudflare/kumo";
import { CalendarCheckIcon } from "@phosphor-icons/react";
import type { BookingRequest } from "../../shared/booking";
import { requestBooking } from "../lib/suggest";

type State =
  | { kind: "idle" }
  | { kind: "booking" }
  | { kind: "done"; htmlLink?: string; alreadyExists: boolean }
  | { kind: "error"; message: string };

export function BookButton({ request }: { request: BookingRequest }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  if (state.kind === "done") {
    return (
      <span className="text-xs text-[#07AF4A]">
        {state.alreadyExists ? "予約済みです" : "予約しました"}
        {state.htmlLink && (
          <>
            {" "}
            <a
              href={state.htmlLink}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              カレンダーで開く
            </a>
          </>
        )}
      </span>
    );
  }

  const book = async () => {
    setState({ kind: "booking" });
    try {
      setState({ kind: "done", ...(await requestBooking(request)) });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err)
      });
    }
  };

  return (
    <span className="flex items-center gap-2">
      {state.kind === "error" && (
        <span className="text-xs text-red-600">{state.message}</span>
      )}
      <Button
        variant="secondary"
        icon={<CalendarCheckIcon size={14} />}
        disabled={state.kind === "booking"}
        onClick={book}
      >
        {state.kind === "booking" ? "予約中…" : "この枠で予約"}
      </Button>
    </span>
  );
}
