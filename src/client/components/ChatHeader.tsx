// =============================================================================
// client/components/ChatHeader
// チャット画面のヘッダー。接続状態・デバッグ切替・テーマ切替・履歴クリア・
// ログイン中ユーザーとログアウトを並べる。
// =============================================================================

import { Badge, Button, Switch, Text } from "@cloudflare/kumo";
import {
  BugIcon,
  ChatCircleDotsIcon,
  CircleIcon,
  PlusIcon,
  SignOutIcon
} from "@phosphor-icons/react";
import { ThemeToggle } from "./ThemeToggle";
import type { AuthUser } from "../types";

export function ChatHeader({
  user,
  connected,
  showDebug,
  onToggleDebug,
  onClear
}: {
  user: AuthUser;
  connected: boolean;
  showDebug: boolean;
  onToggleDebug: (next: boolean) => void;
  onClear: () => void;
}) {
  return (
    <header className="px-5 py-4 bg-kumo-base border-b border-kumo-line">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-kumo-default">調整さま</h1>
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
              className={connected ? "text-kumo-success" : "text-kumo-danger"}
            />
            <Text size="xs" variant="secondary">
              {connected ? "Connected" : "Disconnected"}
            </Text>
          </div>
          <div className="flex items-center gap-1.5">
            <BugIcon size={14} className="text-kumo-inactive" />
            <Switch
              checked={showDebug}
              onCheckedChange={onToggleDebug}
              size="sm"
              aria-label="Toggle debug mode"
            />
          </div>
          <ThemeToggle />
          <Button
            variant="secondary"
            icon={<PlusIcon size={16} />}
            onClick={onClear}
          >
            新しい調整
          </Button>
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-kumo-line">
            <img
              src={user.picture}
              alt={user.name}
              className="w-6 h-6 rounded-full"
              referrerPolicy="no-referrer"
            />
            <span className="text-xs text-kumo-subtle hidden sm:block">
              {user.name}
            </span>
            <Button
              variant="ghost"
              shape="square"
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
