// =============================================================================
// client/lib/directory (browser only)
// ログインユーザー本人の OAuth アクセストークンを Google Identity Services で取得し、
// People API のディレクトリ検索（同僚オートコンプリート）をブラウザから直接行う。
// トークンはメモリ保持のみ。サーバには渡さない。
// =============================================================================

const DIRECTORY_SCOPE = "https://www.googleapis.com/auth/directory.readonly";
const GIS_SRC = "https://accounts.google.com/gsi/client";

// GIS の最小型定義（@types/google.accounts を入れずに済ませる）。
interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface TokenClient {
  callback: (resp: TokenResponse) => void;
  error_callback?: (err: { type?: string; message?: string }) => void;
  requestAccessToken: (opts?: { prompt?: string }) => void;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: TokenResponse) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

export interface DirectoryPerson {
  name: string;
  email: string;
  photo?: string;
}

let scriptPromise: Promise<void> | null = null;
let tokenClient: TokenClient | null = null;
let cachedToken: { value: string; expiresAt: number } | null = null;

function loadGisScript(): Promise<void> {
  if (scriptPromise) {
    return scriptPromise;
  }
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("GIS スクリプトの読み込みに失敗"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * ディレクトリ参照用のアクセストークンを取得する。
 * `silent: true` はポップアップを出さず、ログイン時に同意済みのスコープを黙って引き当てる。
 * 未同意などで取れない場合は reject するので、呼び出し側でフォールバック（操作起点の再取得）する。
 */
export async function getGoogleToken(
  clientId: string,
  opts?: { silent?: boolean }
): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  await loadGisScript();
  const oauth2 = window.google?.accounts.oauth2;
  if (!oauth2) {
    throw new Error("Google Identity Services が利用できません");
  }
  if (!tokenClient) {
    tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: DIRECTORY_SCOPE,
      callback: () => {}
    });
  }

  return new Promise<string>((resolve, reject) => {
    tokenClient!.callback = (resp) => {
      if (resp.error || !resp.access_token) {
        reject(new Error(resp.error ?? "アクセストークンの取得に失敗"));
        return;
      }
      cachedToken = {
        value: resp.access_token,
        expiresAt: Date.now() + (resp.expires_in ?? 3600) * 1000
      };
      resolve(resp.access_token);
    };
    tokenClient!.error_callback = (err) => {
      reject(new Error(err.type ?? err.message ?? "トークン取得に失敗"));
    };
    // prompt: "" … 同意済みなら UI なしで発行。未同意なら error_callback に来る。
    // 明示取得時は通常フロー（必要なら同意ポップアップ）。
    tokenClient!.requestAccessToken({ prompt: opts?.silent ? "" : "consent" });
  });
}

export function hasGoogleToken(): boolean {
  return !!cachedToken && cachedToken.expiresAt > Date.now() + 60_000;
}

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
