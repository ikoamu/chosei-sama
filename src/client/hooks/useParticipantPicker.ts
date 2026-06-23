// =============================================================================
// client/hooks/useParticipantPicker
// 参加者ピッカーのステートフルな配線。
// ディレクトリ参照トークンの取得・デバウンス検索・選択状態・派生値をまとめる。
// =============================================================================

import { useEffect, useState } from "react";
import type { AuthUser } from "../types";
import {
  fetchDirectoryToken,
  searchDirectory,
  type DirectoryPerson
} from "../lib/directory";

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
export function useParticipantPicker(self: AuthUser) {
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

  const { token, setToken, tokenError, setTokenError } = useDirectoryToken();
  const { results, setResults, loading, open, setOpen } = useDirectorySearch(
    query,
    token,
    setToken,
    setTokenError
  );
  // ポップアップの開閉・外側クリックでの dismiss は Autocomplete（Base UI）が担う。

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
    selected,
    details,
    setDetails,
    addPerson,
    removePerson,
    visibleResults,
    orderedSelected
  };
}
