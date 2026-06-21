// =============================================================================
// client/components/chat/ChatInput
// 下部の入力欄。初回は参加者ピッカーが入力口になるため呼び出し側で出し分ける。
// =============================================================================

import { Button, InputArea } from "@cloudflare/kumo";
import { PaperPlaneRightIcon, StopIcon } from "@phosphor-icons/react";
import type { ChatSession } from "../../hooks/useChatSession";

export function ChatInput({
  input,
  setInput,
  getTextareaProps,
  triggerSubmit,
  isStreaming,
  connected,
  onStop
}: {
  input: string;
  setInput: ChatSession["setInput"];
  getTextareaProps: ChatSession["getTextareaProps"];
  triggerSubmit: ChatSession["triggerSubmit"];
  isStreaming: boolean;
  connected: boolean;
  onStop: () => void;
}) {
  return (
    <div className="border-t border-kumo-line bg-kumo-base">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          triggerSubmit();
        }}
        className="max-w-3xl mx-auto px-5 py-4"
      >
        <div className="flex items-end gap-3 rounded-xl border border-kumo-line bg-kumo-base p-3 shadow-sm focus-within:ring-2 focus-within:ring-kumo-ring focus-within:border-transparent transition-shadow">
          <InputArea
            {...getTextareaProps({
              value: input,
              onChange: (e) => {
                setInput(e.target.value);
                const el = e.target;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }
            })}
            placeholder="メッセージを入力…（Enterで改行／⌘・Ctrl+Enterで送信）"
            disabled={!connected || isStreaming}
            rows={1}
            className="flex-1 ring-0! focus:ring-0! shadow-none! bg-transparent! outline-none! resize-none max-h-40"
          />
          {isStreaming ? (
            <Button
              type="button"
              variant="secondary"
              shape="square"
              aria-label="Stop generation"
              icon={<StopIcon size={18} />}
              onClick={onStop}
              className="mb-0.5"
            />
          ) : (
            <Button
              type="submit"
              variant="primary"
              shape="square"
              aria-label="Send message"
              disabled={!input.trim() || !connected}
              icon={<PaperPlaneRightIcon size={18} />}
              className="mb-0.5"
            />
          )}
        </div>
      </form>
    </div>
  );
}
