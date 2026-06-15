// =============================================================================
// client/components/ParticipantPicker
// 参加者を選ぶディレクトリ・オートコンプリート。
// ブラウザのトークンで People API を直接叩き、選んだ参加者で調整を開始する。
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { Button, Surface, Text } from "@cloudflare/kumo";
import {
  MagnifyingGlassIcon,
  GearIcon,
  UsersIcon,
  XIcon
} from "@phosphor-icons/react";
import {
  getGoogleToken,
  searchDirectory,
  type DirectoryPerson
} from "../lib/directory";

export function ParticipantPicker({
  clientId,
  selfEmail,
  disabled,
  onStart
}: {
  clientId: string;
  selfEmail: string;
  disabled: boolean;
  onStart: (people: DirectoryPerson[]) => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryPerson[]>([]);
  const [selected, setSelected] = useState<DirectoryPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // ログイン時に directory スコープへ同意済みなら、ポップアップ無しでトークンを引き当てる。
  useEffect(() => {
    getGoogleToken(clientId, { silent: true })
      .then(setToken)
      .catch(() => setNeedsConsent(true));
  }, [clientId]);

  // サイレント取得に失敗した場合のみ、操作起点で明示的に取得する。
  const connect = async () => {
    setConnecting(true);
    try {
      setToken(await getGoogleToken(clientId));
      setNeedsConsent(false);
    } catch (e) {
      console.error("Google 接続に失敗:", e);
    } finally {
      setConnecting(false);
    }
  };

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
        setResults([]);
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

  const visibleResults = results.filter(
    (p) => p.email !== selfEmail && !selected.some((s) => s.email === p.email)
  );

  return (
    <div className="w-full max-w-md mx-auto space-y-3 text-left">
      <div className="flex items-center gap-2 justify-center">
        <UsersIcon size={16} className="text-kumo-subtle" />
        <Text size="sm" variant="secondary">
          参加者を選んでください
        </Text>
      </div>

      {!token && needsConsent && (
        <div className="flex flex-col items-center gap-2">
          <Text size="xs" variant="secondary">
            同僚検索の利用には Google の追加許可が必要です
          </Text>
          <Button variant="secondary" disabled={connecting} onClick={connect}>
            {connecting ? "許可を確認中…" : "Google で許可する"}
          </Button>
        </div>
      )}

      {!token && !needsConsent && (
        <p className="text-xs text-center text-kumo-subtle">準備中…</p>
      )}

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {selected.map((p) => (
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
              <span className="text-xs text-kumo-default">{p.name}</span>
              <button
                type="button"
                onClick={() => removePerson(p.email)}
                aria-label={`${p.name} を削除`}
                className="text-kumo-inactive hover:text-kumo-danger"
              >
                <XIcon size={12} />
              </button>
            </span>
          ))}
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

      <Button
        variant="primary"
        className="w-full"
        disabled={disabled || selected.length === 0}
        onClick={() => onStart(selected)}
      >
        この参加者で空き時間を探す
      </Button>
    </div>
  );
}
