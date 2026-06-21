// =============================================================================
// client/components/participant/SelectedChips
// 選択済み参加者のチップ列。自分は削除不可。
// =============================================================================

import { XIcon } from "@phosphor-icons/react";
import type { DirectoryPerson } from "../../lib/directory";
import { PersonAvatar } from "./PersonAvatar";

export function SelectedChips({
  people,
  selfEmail,
  onRemove
}: {
  people: DirectoryPerson[];
  selfEmail: string;
  onRemove: (email: string) => void;
}) {
  if (people.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {people.map((p) => {
        const isSelf = p.email === selfEmail;
        return (
          <span
            key={p.email}
            className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-kumo-control border border-kumo-line"
          >
            <PersonAvatar person={p} size="sm" />
            <span className="text-xs text-kumo-default">
              {p.name}
              {isSelf && <span className="text-kumo-subtle">（あなた）</span>}
            </span>
            {/* 自分は必ず参加者に含めるため削除ボタンを出さない。 */}
            {!isSelf && (
              <button
                type="button"
                onClick={() => onRemove(p.email)}
                aria-label={`${p.name} を削除`}
                className="text-kumo-inactive hover:text-kumo-danger"
              >
                <XIcon size={12} />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
