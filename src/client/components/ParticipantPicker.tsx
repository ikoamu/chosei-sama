// =============================================================================
// client/components/ParticipantPicker
// 参加者を選ぶディレクトリ・オートコンプリート。
// サーバーが refresh_token で発行した access_token で People API を直接叩く。
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { Button, Surface, Text } from "@cloudflare/kumo";
import {
  MagnifyingGlassIcon,
  GearIcon,
  PlusIcon,
  UsersIcon,
  XIcon
} from "@phosphor-icons/react";
import type { AuthUser } from "../types";
import {
  fetchDirectoryToken,
  searchDirectory,
  type DirectoryPerson
} from "../lib/directory";
import type { ScheduleKind, ScheduleOptions } from "../lib/participants";

const PLACEHOLDERS: Record<ScheduleKind, string> = {
  single: "例: 1時間、来週中、午後希望",
  recurring: "例: 隔週1h、来月から6回、午後希望"
};

export function ParticipantPicker({
  self,
  disabled,
  onStart
}: {
  self: AuthUser;
  disabled: boolean;
  onStart: (people: DirectoryPerson[], options: ScheduleOptions) => void;
}) {
  // ログインユーザー本人。同僚検索の候補には出ないため、参加者として扱える形に変換する。
  const selfPerson: DirectoryPerson = {
    name: self.name,
    email: self.email,
    photo: self.picture
  };

  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryPerson[]>([]);
  // 既定で自分を参加者に含める（✕ で除外可能）。
  const [selected, setSelected] = useState<DirectoryPerson[]>([selfPerson]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  // 調整の種別（既定は定期）と希望条件のフリーテキスト。
  const [kind, setKind] = useState<ScheduleKind>("recurring");
  const [details, setDetails] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  const selfSelected = selected.some((s) => s.email === self.email);

  // マウント時にサーバーからディレクトリ参照用トークンを取得。
  // ポップアップ等は発生しない（サーバーが refresh_token で更新する）。
  useEffect(() => {
    fetchDirectoryToken()
      .then(setToken)
      .catch(() => setTokenError(true));
  }, []);

  // Debounced directory search (uses the user's own token, direct to Google)
  useEffect(() => {
    const q = query.trim();
    if (!q || !token) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        setResults(await searchDirectory(token, q));
        setOpen(true);
      } catch {
        // トークン期限切れの可能性があるため再取得を試みる
        try {
          const newToken = await fetchDirectoryToken();
          setToken(newToken);
          setResults(await searchDirectory(newToken, q));
          setOpen(true);
        } catch {
          setResults([]);
          setTokenError(true);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, token]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) {
      return;
    }
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const addPerson = (p: DirectoryPerson) => {
    if (!selected.some((s) => s.email === p.email)) {
      setSelected((prev) => [...prev, p]);
    }
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const removePerson = (email: string) => {
    setSelected((prev) => prev.filter((s) => s.email !== email));
  };

  const addSelf = () => {
    if (!selfSelected) {
      setSelected((prev) => [selfPerson, ...prev]);
    }
  };

  const visibleResults = results.filter(
    (p) => p.email !== self.email && !selected.some((s) => s.email === p.email)
  );

  // 自分のチップは常に先頭に表示する。
  const orderedSelected = [...selected].sort((a, b) =>
    a.email === self.email ? -1 : b.email === self.email ? 1 : 0
  );

  return (
    <div className="w-full max-w-md mx-auto space-y-3 text-left">
      <div className="flex items-center gap-2 justify-center">
        <UsersIcon size={16} className="text-kumo-subtle" />
        <Text size="sm" variant="secondary">
          参加者を選んでください
        </Text>
      </div>

      {tokenError && (
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

      {!token && !tokenError && (
        <p className="text-xs text-center text-kumo-subtle">
          ディレクトリに接続中…
        </p>
      )}

      {/* Selected chips */}
      {orderedSelected.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {orderedSelected.map((p) => {
            const isSelf = p.email === self.email;
            return (
              <span
                key={p.email}
                className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-kumo-control border border-kumo-line"
              >
                {p.photo ? (
                  <img
                    src={p.photo}
                    alt={p.name}
                    className="w-5 h-5 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-kumo-accent/20 flex items-center justify-center text-[10px] text-kumo-accent">
                    {p.name.charAt(0)}
                  </span>
                )}
                <span className="text-xs text-kumo-default">
                  {p.name}
                  {isSelf && (
                    <span className="text-kumo-subtle">（あなた）</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => removePerson(p.email)}
                  aria-label={`${p.name} を削除`}
                  className="text-kumo-inactive hover:text-kumo-danger"
                >
                  <XIcon size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search input + dropdown */}
      {token && (
        <div className="relative" ref={boxRef}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-kumo-line bg-kumo-base focus-within:ring-1 focus-within:ring-kumo-accent">
            <MagnifyingGlassIcon size={16} className="text-kumo-inactive" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setOpen(true)}
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
              <Surface className="rounded-lg ring ring-kumo-line shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                {visibleResults.map((p) => (
                  <button
                    key={p.email}
                    type="button"
                    onClick={() => addPerson(p)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-kumo-control transition-colors"
                  >
                    {p.photo ? (
                      <img
                        src={p.photo}
                        alt={p.name}
                        className="w-7 h-7 rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-kumo-accent/20 flex items-center justify-center text-xs text-kumo-accent">
                        {p.name.charAt(0)}
                      </span>
                    )}
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
              </Surface>
            </div>
          )}
        </div>
      )}

      {/* 自分を除外しているときだけ、再追加の導線を出す */}
      {!selfSelected && (
        <button
          type="button"
          onClick={addSelf}
          disabled={disabled}
          className="flex items-center gap-1.5 mx-auto text-xs text-kumo-subtle hover:text-kumo-accent transition-colors disabled:opacity-50"
        >
          <PlusIcon size={12} />
          自分（{self.name}）を追加
        </button>
      )}

      {/* 種別トグル＋希望条件 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-kumo-control border border-kumo-line w-fit mx-auto">
          {(["recurring", "single"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              disabled={disabled}
              aria-pressed={kind === k}
              className={`px-3 py-1 text-xs rounded-md transition-colors disabled:opacity-50 ${
                kind === k
                  ? "bg-kumo-base text-kumo-default shadow-sm"
                  : "text-kumo-subtle hover:text-kumo-default"
              }`}
            >
              {k === "recurring" ? "定期" : "単発"}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="block text-xs text-kumo-subtle mb-1">
            どんな調整？（所要時間・期間など）
          </span>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            disabled={disabled}
            rows={2}
            aria-label="調整の希望条件"
            placeholder={PLACEHOLDERS[kind]}
            className="w-full text-sm rounded-lg border border-kumo-line bg-kumo-base px-3 py-2 text-kumo-default placeholder:text-kumo-inactive focus:outline-none focus:ring-1 focus:ring-kumo-accent resize-none"
          />
        </label>
      </div>

      <Button
        variant="primary"
        className="w-full"
        disabled={disabled || selected.length === 0}
        onClick={() => onStart(selected, { kind, details })}
      >
        この参加者で空き時間を探す
      </Button>
    </div>
  );
}
