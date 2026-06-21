// =============================================================================
// client/components/ParticipantPicker
// 参加者を選ぶディレクトリ・オートコンプリート。
// サーバーが refresh_token で発行した access_token で People API を直接叩く。
// =============================================================================

import { useEffect, useRef, useState, type RefObject } from "react";
import { Button, Surface, Text } from "@cloudflare/kumo";
import {
  MagnifyingGlassIcon,
  GearIcon,
  UsersIcon,
  XIcon
} from "@phosphor-icons/react";
import type { AuthUser } from "../types";
import {
  fetchDirectoryToken,
  searchDirectory,
  type DirectoryPerson
} from "../lib/directory";

/** 希望条件のテンプレ文。クリックでテキストエリアに入れて微修正してもらう。 */
const TEMPLATES = {
  single: "30分のミーティングを来週中で。できれば午後希望。",
  recurring: "1時間の定例を隔週で、来月から6回。できれば午後希望。"
} as const;

// ---------------------------------------------------------------------------
// フック
// ---------------------------------------------------------------------------

/** マウント時にディレクトリ参照用トークンを取得する（ポップアップなし）。 */
function useDirectoryToken() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);
  useEffect(() => {
    fetchDirectoryToken()
      .then(setToken)
      .catch(() => setTokenError(true));
  }, []);
  return { token, setToken, tokenError, setTokenError };
}

/** デバウンス付きディレクトリ検索（本人トークンで Google を直接叩く）。 */
function useDirectorySearch(
  query: string,
  token: string | null,
  setToken: (t: string) => void,
  setTokenError: (v: boolean) => void
) {
  const [results, setResults] = useState<DirectoryPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

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
  }, [query, token, setToken, setTokenError]);

  return { results, setResults, loading, open, setOpen };
}

/** 参加者ピッカーの状態・効果・派生値をまとめる。 */
function useParticipantPicker(self: AuthUser) {
  // ログインユーザー本人。同僚検索の候補には出ないため参加者として扱える形に変換。
  const selfPerson: DirectoryPerson = {
    name: self.name,
    email: self.email,
    photo: self.picture
  };

  const [query, setQuery] = useState("");
  // 自分は必ず参加者に含める（削除不可）。
  const [selected, setSelected] = useState<DirectoryPerson[]>([selfPerson]);
  // 希望条件のフリーテキスト（単発/定期はこの文面から Agent が推測する）。
  const [details, setDetails] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  const { token, setToken, tokenError, setTokenError } = useDirectoryToken();
  const { results, setResults, loading, open, setOpen } = useDirectorySearch(
    query,
    token,
    setToken,
    setTokenError
  );

  // ドロップダウンの外側クリックで閉じる。
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
  }, [open, setOpen]);

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
    (p) => p.email !== self.email && !selected.some((s) => s.email === p.email)
  );

  // 自分のチップは常に先頭に表示する。
  const orderedSelected = [...selected].sort((a, b) =>
    a.email === self.email ? -1 : b.email === self.email ? 1 : 0
  );

  return {
    token,
    tokenError,
    query,
    setQuery,
    loading,
    open,
    setOpen,
    boxRef,
    selected,
    details,
    setDetails,
    addPerson,
    removePerson,
    visibleResults,
    orderedSelected,
    hasResults: results.length > 0
  };
}

// ---------------------------------------------------------------------------
// 表示コンポーネント
// ---------------------------------------------------------------------------

/** 顔写真 or イニシャルのアバター。sm=チップ用 / md=検索結果用。 */
function PersonAvatar({
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

/** 選択済み参加者のチップ列。自分は削除不可。 */
function SelectedChips({
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

/** 同僚検索の入力欄と候補ドロップダウン。 */
function SearchBox({
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
          <Surface className="rounded-lg ring ring-kumo-line shadow-lg overflow-hidden max-h-64 overflow-y-auto">
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
          </Surface>
        </div>
      )}
    </div>
  );
}

/** 希望条件のテンプレボタンとフリーテキスト欄。 */
function DetailsField({
  details,
  setDetails,
  disabled
}: {
  details: string;
  setDetails: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-kumo-subtle">テンプレから入力:</span>
        {(["single", "recurring"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setDetails(TEMPLATES[k])}
            disabled={disabled}
            className="px-2 py-0.5 rounded-md border border-kumo-line text-kumo-default hover:bg-kumo-control transition-colors disabled:opacity-50"
          >
            {k === "single" ? "単発" : "定例"}
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
          rows={3}
          aria-label="調整の希望条件"
          placeholder="例: 30分のミーティングを来週中で。できれば午後希望。"
          className="w-full text-sm rounded-lg border border-kumo-line bg-kumo-base px-3 py-2 text-kumo-default placeholder:text-kumo-inactive focus:outline-none focus:ring-1 focus:ring-kumo-accent resize-none"
        />
      </label>
    </div>
  );
}

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
          boxRef={picker.boxRef}
          visibleResults={picker.visibleResults}
          onAdd={picker.addPerson}
          disabled={disabled}
          hasResults={picker.hasResults}
        />
      )}

      <DetailsField
        details={picker.details}
        setDetails={picker.setDetails}
        disabled={disabled}
      />

      <Button
        variant="primary"
        className="w-full"
        disabled={disabled || picker.selected.length === 0}
        onClick={() => onStart(picker.selected, picker.details)}
      >
        この参加者で空き時間を探す
      </Button>
    </div>
  );
}
