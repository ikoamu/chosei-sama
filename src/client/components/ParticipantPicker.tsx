// =============================================================================
// client/components/ParticipantPicker
// 参加者を選ぶディレクトリ・オートコンプリート。
// ステートフルな配線は useParticipantPicker に委譲し、ここでは組み立てに専念する。
// =============================================================================

import { Button, Text } from "@cloudflare/kumo";
import { SparkleIcon, UsersIcon } from "@phosphor-icons/react";
import type { AuthUser } from "../types";
import type { DirectoryPerson } from "../lib/directory";
import { useParticipantPicker } from "../hooks/useParticipantPicker";
import { SelectedChips } from "./participant/SelectedChips";
import { SearchBox } from "./participant/SearchBox";
import { DetailsField } from "./participant/DetailsField";

export function ParticipantPicker({
  self,
  disabled,
  onStart
}: {
  self: AuthUser;
  disabled: boolean;
  onStart: (people: DirectoryPerson[], details: string) => void;
}) {
  const picker = useParticipantPicker(self);

  return (
    <div className="w-full max-w-md mx-auto space-y-3 text-left">
      <div className="flex items-center gap-2 justify-center">
        <UsersIcon size={16} className="text-kumo-subtle" />
        <Text size="sm" variant="secondary">
          参加者を選んでください
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
        <p className="text-xs text-center text-kumo-subtle">
          ディレクトリに接続中…
        </p>
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

      <DetailsField
        details={picker.details}
        setDetails={picker.setDetails}
        disabled={disabled}
      />

      <div className="flex justify-end">
        <Button
          variant="primary"
          icon={<SparkleIcon size={16} />}
          disabled={disabled || picker.selected.length === 0}
          onClick={() => onStart(picker.selected, picker.details)}
        >
          この内容で調整を始める
        </Button>
      </div>
    </div>
  );
}
