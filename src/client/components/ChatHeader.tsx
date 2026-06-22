// =============================================================================
// client/components/ChatHeader
// チャット画面のヘッダー。接続状態・履歴クリア・
// ログイン中ユーザーとログアウトを並べる。背景は緑 (#07AF4A) 固定。
// =============================================================================

import { Badge, Button } from "@cloudflare/kumo";
import {
  ChatCircleDotsIcon,
  CircleIcon,
  PlusIcon,
  SignOutIcon
} from "@phosphor-icons/react";
import type { AuthUser } from "../types";

export function ChatHeader({
  user,
  connected,
  onClear
}: {
  user: AuthUser;
  connected: boolean;
  onClear: () => void;
}) {
  return (
    <header className="px-5 py-4 bg-[#07AF4A] border-b border-white/20">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-white">調整さま</h1>
          <Badge variant="secondary">
            <ChatCircleDotsIcon size={12} weight="bold" className="mr-1" />
            AI Chat
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <CircleIcon
              size={8}
              weight="fill"
              className={connected ? "text-white" : "text-red-300"}
            />
            <span className="text-xs text-white/90">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <Button
            variant="secondary"
            icon={<PlusIcon size={16} />}
            onClick={onClear}
          >
            新しい調整
          </Button>
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/30">
            <img
              src={user.picture}
              alt={user.name}
              className="w-6 h-6 rounded-full"
              referrerPolicy="no-referrer"
            />
            <span className="text-xs text-white/90 hidden sm:block">
              {user.name}
            </span>
            <Button
              variant="ghost"
              shape="square"
              className="text-white hover:bg-white/20! hover:text-white!"
              icon={<SignOutIcon size={16} />}
              onClick={() => {
                window.location.href = "/oauth/logout";
              }}
              aria-label="Logout"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
