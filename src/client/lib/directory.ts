// =============================================================================
// client/lib/directory (browser only)
// People API のディレクトリ検索（同僚オートコンプリート）。
// トークンは /oauth/directory-token からサーバー経由で取得し、メモリにキャッシュする。
// =============================================================================

export interface DirectoryPerson {
  name: string;
  email: string;
  photo?: string;
}

// ---------- トークン管理 ----------

let cached: { token: string; expiresAt: number } | null = null;

/**
 * ディレクトリ参照用の短命アクセストークンを取得する。
 * サーバーがセッション中の refresh_token で Google に問い合わせるため、
 * ブラウザでポップアップやリダイレクトは一切発生しない。
 */
export async function fetchDirectoryToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }
  const res = await fetch("/oauth/directory-token");
  if (!res.ok) {
    throw new Error(`directory token fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    accessToken: string;
    expiresIn: number;
  };
  cached = {
    token: data.accessToken,
    expiresAt: Date.now() + data.expiresIn * 1000
  };
  return cached.token;
}

// ---------- ディレクトリ検索 ----------

/** People API でディレクトリを部分一致検索する。 */
export async function searchDirectory(
  token: string,
  query: string
): Promise<DirectoryPerson[]> {
  const url = new URL(
    "https://people.googleapis.com/v1/people:searchDirectoryPeople"
  );
  url.searchParams.set("query", query);
  url.searchParams.set("readMask", "names,emailAddresses,photos");
  url.searchParams.append("sources", "DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE");
  url.searchParams.set("pageSize", "10");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`directory search failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    people?: {
      names?: { displayName?: string }[];
      emailAddresses?: { value?: string }[];
      photos?: { url?: string }[];
    }[];
  };

  const out: DirectoryPerson[] = [];
  for (const p of data.people ?? []) {
    const email = p.emailAddresses?.[0]?.value;
    if (!email) {
      continue;
    }
    out.push({
      name: p.names?.[0]?.displayName ?? email,
      email,
      photo: p.photos?.[0]?.url
    });
  }
  return out;
}
