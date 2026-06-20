// =============================================================================
// shared/directory
// People API（ディレクトリ）検索のレスポンス変換と検索（server / client 共有）。
// busy 情報などは持たず、名前→メールの対応づけ（参加者解決）に使う。
// =============================================================================

export interface DirectoryPerson {
  name: string;
  email: string;
  photo?: string;
}

/** People API searchDirectoryPeople のレスポンス（必要なフィールドのみ）。 */
export interface DirectoryResponse {
  people?: {
    names?: { displayName?: string }[];
    emailAddresses?: { value?: string }[];
    photos?: { url?: string }[];
  }[];
}

/**
 * People API のレスポンスを DirectoryPerson[] に変換する純粋関数。
 * メールの無いエントリは参加者にできないため除外する。
 */
export function parseDirectoryResponse(
  data: DirectoryResponse
): DirectoryPerson[] {
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

/**
 * People API でドメインディレクトリを部分一致検索する。
 * token は directory.readonly スコープを含むアクセストークン。
 * 失敗時は status 付きで throw（呼び出し側で再ログイン案内に変換できる）。
 */
export async function searchDirectory(
  token: string,
  query: string,
  pageSize = 10
): Promise<DirectoryPerson[]> {
  const url = new URL(
    "https://people.googleapis.com/v1/people:searchDirectoryPeople"
  );
  url.searchParams.set("query", query);
  url.searchParams.set("readMask", "names,emailAddresses,photos");
  url.searchParams.append("sources", "DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE");
  url.searchParams.set("pageSize", String(pageSize));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(
      `directory search failed: ${res.status} ${await res.text()}`
    );
  }
  return parseDirectoryResponse((await res.json()) as DirectoryResponse);
}
