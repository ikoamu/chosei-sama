// =============================================================================
// client/components/participant/SearchBox
// 同僚検索の入力欄と候補ドロップダウン。
// =============================================================================

import type { RefObject } from "react";
import { LayerCard } from "@cloudflare/kumo";
import { GearIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import type { DirectoryPerson } from "../../lib/directory";
import { PersonAvatar } from "./PersonAvatar";

export function SearchBox({
  query,
  setQuery,
  loading,
  open,
  setOpen,
  boxRef,
  visibleResults,
  onAdd,
  disabled,
  hasResults
}: {
  query: string;
  setQuery: (v: string) => void;
  loading: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  boxRef: RefObject<HTMLDivElement | null>;
  visibleResults: DirectoryPerson[];
  onAdd: (p: DirectoryPerson) => void;
  disabled: boolean;
  hasResults: boolean;
}) {
  return (
    <div className="relative" ref={boxRef}>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-kumo-line bg-kumo-base focus-within:ring-1 focus-within:ring-kumo-accent">
        <MagnifyingGlassIcon size={16} className="text-kumo-inactive" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => hasResults && setOpen(true)}
          aria-label="同僚を検索"
          placeholder="名前・メールで検索…"
          disabled={disabled}
          className="flex-1 text-sm bg-transparent text-kumo-default placeholder:text-kumo-inactive focus:outline-none"
        />
        {loading && (
          <GearIcon size={14} className="text-kumo-inactive animate-spin" />
        )}
      </div>

      {open && visibleResults.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50">
          <LayerCard className="rounded-lg ring ring-kumo-line shadow-lg overflow-hidden max-h-64 overflow-y-auto">
            {visibleResults.map((p) => (
              <button
                key={p.email}
                type="button"
                onClick={() => onAdd(p)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-kumo-control transition-colors"
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
              </button>
            ))}
          </LayerCard>
        </div>
      )}
    </div>
  );
}
