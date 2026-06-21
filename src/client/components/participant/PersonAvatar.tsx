// =============================================================================
// client/components/participant/PersonAvatar
// 顔写真 or イニシャルのアバター。sm=チップ用 / md=検索結果用。
// =============================================================================

import type { DirectoryPerson } from "../../lib/directory";

export function PersonAvatar({
  person,
  size
}: {
  person: DirectoryPerson;
  size: "sm" | "md";
}) {
  const dim = size === "sm" ? "w-5 h-5" : "w-7 h-7";
  if (person.photo) {
    return (
      <img
        src={person.photo}
        alt={person.name}
        className={`${dim} rounded-full`}
        referrerPolicy="no-referrer"
      />
    );
  }
  const text = size === "sm" ? "text-[10px]" : "text-xs";
  return (
    <span
      className={`${dim} rounded-full bg-kumo-accent/20 flex items-center justify-center ${text} text-kumo-accent`}
    >
      {person.name.charAt(0)}
    </span>
  );
}
