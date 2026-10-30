// =============================================================================
// client/components/ParticipantPicker
// 参加者を選ぶディレクトリ・オートコンプリート。
// ステートフルな配線は useParticipantPicker（呼び出し側が持つ）に委譲し、
// ここでは組み立てに専念する。
// =============================================================================

import { Button, Text } from "@cloudflare/kumo";
import { UsersIcon } from "@phosphor-icons/react";
import type { AuthUser } from "../types";
import type { useParticipantPicker } from "../hooks/useParticipantPicker";
import { SelectedChips } from "./participant/SelectedChips";
import { SearchBox } from "./participant/SearchBox";

export function ParticipantPicker({
  self,
  picker,
  disabled
}: {
  self: AuthUser;
  picker: ReturnType<typeof useParticipantPicker>;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <UsersIcon size={16} className="text-kumo-subtle" />
        <Text size="sm" variant="secondary">
          参加者
        </Text>
      </div>

      {picker.tokenError && (
        <div className="flex flex-col items-center gap-2">
          <Text size="xs" variant="secondary">
            同僚検索の接続に失敗しました。再ログインしてください。
          </Text>
          <Button
            variant="secondary"
            onClick={() => {
              window.location.href = "/oauth/login";
            }}
          >
            再ログイン
          </Button>
        </div>
      )}

      {!picker.token && !picker.tokenError && (
        <p className="text-xs text-kumo-subtle">ディレクトリに接続中…</p>
      )}

      <SelectedChips
        people={picker.orderedSelected}
        selfEmail={self.email}
        onRemove={picker.removePerson}
      />

      {picker.token && (
        <SearchBox
          query={picker.query}
          setQuery={picker.setQuery}
          loading={picker.loading}
          open={picker.open}
          setOpen={picker.setOpen}
          visibleResults={picker.visibleResults}
          onAdd={picker.addPerson}
          disabled={disabled}
        />
      )}
    </div>
  );
}
