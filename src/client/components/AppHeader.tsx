// =============================================================================
// client/components/AppHeader
// ヘッダー。アプリ名と、ログイン中ユーザー・ログアウトを並べる。
// 背景は緑 (#07AF4A) 固定。
// =============================================================================

import { Button } from "@cloudflare/kumo";
import { SignOutIcon } from "@phosphor-icons/react";
import type { AuthUser } from "../types";

export function AppHeader({ user }: { user: AuthUser }) {
  return (
    <header className="px-5 py-4 bg-[#07AF4A] border-b border-white/20">
      <div className="max-w-xl mx-auto flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">調整さま</h1>
        <div className="flex items-center gap-2">
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
    </header>
  );
}
