// =============================================================================
// client/components/LoginScreen
// 未ログイン時に表示するログイン画面。Google OAuth へリダイレクトする。
// =============================================================================

import { Button, Surface, Text } from "@cloudflare/kumo";
import { SignInIcon } from "@phosphor-icons/react";

export function LoginScreen() {
  const error = new URLSearchParams(window.location.search).get("error");

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-kumo-elevated">
      <Surface className="p-8 rounded-2xl ring ring-kumo-line max-w-sm w-full text-center space-y-4">
        <h1 className="text-2xl font-semibold text-kumo-default">調整さま</h1>
        <Text variant="secondary">
          Google Workspace アカウントでログインしてください
        </Text>
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <span className="text-xs text-red-500">
              {decodeURIComponent(error)}
            </span>
          </div>
        )}
        <Button
          variant="primary"
          onClick={() => {
            window.location.href = "/oauth/login";
          }}
        >
          <SignInIcon size={16} className="mr-1" />
          Google でログイン
        </Button>
      </Surface>
    </div>
  );
}
