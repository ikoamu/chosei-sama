// =============================================================================
// client/components/participant/SearchBox
// 同僚検索の入力欄と候補ドロップダウン。
// Kumo（Base UI）の Autocomplete を使い、↑↓ で候補移動・Enter で確定できる。
// 候補は本人トークンの非同期検索で得た visibleResults をそのまま出すため
// mode="none"（クライアント側の再フィルタを無効化）にする。
// =============================================================================

import { Autocomplete } from "@cloudflare/kumo";
import { GearIcon } from "@phosphor-icons/react";
import type { DirectoryPerson } from "../../lib/directory";
import { PersonAvatar } from "./PersonAvatar";

export function SearchBox({
  query,
  setQuery,
  loading,
  open,
  setOpen,
  visibleResults,
  onAdd,
  disabled
}: {
  query: string;
  setQuery: (v: string) => void;
  loading: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  visibleResults: DirectoryPerson[];
  onAdd: (p: DirectoryPerson) => void;
  disabled: boolean;
}) {
  return (
    <div className="relative">
      <Autocomplete
        items={visibleResults}
        value={query}
        onValueChange={(value, details) => {
          // 項目選択（クリック / Enter）時に Base UI が入力欄を選択値（オブジェクト）で
          // 埋める挙動を無視する。追加とクリアは Item の onClick → addPerson
          // （setQuery("")）が担うため、ここではタイピング等だけを反映する。
          if (details.reason === "item-press") {
            return;
          }
          setQuery(value);
        }}
        open={open && visibleResults.length > 0}
        onOpenChange={setOpen}
        mode="none"
        disabled={disabled}
      >
        <Autocomplete.InputGroup placeholder="名前・メールで検索…" />
        <Autocomplete.Content className="participant-popup z-50">
          <Autocomplete.List>
            {(item: unknown) => {
              const p = item as DirectoryPerson;
              return (
                <Autocomplete.Item
                  key={p.email}
                  value={p}
                  onClick={() => onAdd(p)}
                  className="flex items-center gap-2.5 px-3 py-2 cursor-pointer rounded-md transition-colors data-[highlighted]:bg-[#07AF4A]/15! data-[highlighted]:shadow-[inset_3px_0_0_0_#07AF4A]!"
                >
                  <PersonAvatar person={p} size="md" />
                  <span className="min-w-0">
                    <span className="block text-sm text-kumo-default truncate">
                      {p.name}
                    </span>
                    <span className="block text-xs text-kumo-subtle truncate">
                      {p.email}
                    </span>
                  </span>
                </Autocomplete.Item>
              );
            }}
          </Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
      {loading && (
        <GearIcon
          size={14}
          className="animate-spin text-kumo-inactive absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
        />
      )}
    </div>
  );
}
