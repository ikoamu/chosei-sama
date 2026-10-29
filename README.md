# chosei-sama

Google Workspace の共有カレンダーから、指定メンバー全員が空いている時間を提案する社内ツール。
Cloudflare Workers + Google Calendar FreeBusy API + TypeSafe AI の Jev（条件の下書き）で動く。

## プロジェクト構成

ランタイム境界で 3 つに分割している。各ディレクトリは `index.ts` を公開窓口とする。

```
src/
  shared/        # criteria（調整条件）/ booking / directory（People API 検索）など server / client 共有
  scheduler/     # 提案エンジン（ランタイム非依存・テスト対象）
                 #   intervals / timezone / windows / slots / freebusy /
                 #   suggest / events を index.ts のバレルで公開
  server/        # Worker 側（状態を持たない HTTP API）
                 #   index.ts（エントリ）/ api/*（/api/draft・suggest・events）/
                 #   jev/*（Jev で調整条件の下書き）/ auth/*（OAuth・セッション）
  client/        # ブラウザ / React 側
                 #   index.tsx / App.tsx / components/* / hooks/* / lib/*
index.html       # SPA エントリ
env.secrets.d.ts # Secrets の Env 型補完（wrangler types 再生成で消えない）
wrangler.jsonc   # Workers 設定
vite.config.ts   # Vite ビルド設定
workflows/
  sanity-check.yml # CI（push/PR → pnpm install & check）
```

## セットアップ

```bash
pnpm install
```

## 開発

初回はローカル用のシークレットを用意する。`.dev.sample.vars` をコピーして
`.dev.vars` を作り、実値を記入してから起動する（`.dev.vars` は `.gitignore` 済み）。

```bash
cp .dev.sample.vars .dev.vars   # 各値を埋める（GOOGLE_CLIENT_ID・TYPESAFE_API_KEY 等）
pnpm dev
```

Google Cloud の OAuth クライアントには、ローカルのリダイレクト URI
`http://localhost:5173/oauth/callback` を「承認済みのリダイレクト URI」として
登録しておくこと。

http://localhost:5173 で調整画面が開く。

## テスト

```bash
pnpm test    # vitest（src/**/*.test.ts）
```

## デプロイ

```bash
pnpm deploy   # vite build && wrangler deploy
```

## デプロイ前に必要な外部設定

ログイン・同僚検索・FreeBusy 照会・予約確定はすべて **ログインユーザー本人の
OAuth トークン**で行う。サービスアカウントやドメイン全体委任は使わない（管理者作業は不要。
経緯は `docs/adr/0001-user-oauth-for-freebusy.md`）。

1. GCP で OAuth 2.0 クライアント ID（ウェブアプリ）を作成
2. **承認済みリダイレクト URI** に `https://<your-domain>/oauth/callback` を追加
3. **承認済み JavaScript 生成元** にアプリのオリジン（例 `https://<your-domain>`）を追加
   ← Google Identity Services のトークン取得に必須
4. OAuth 同意画面のスコープに以下を追加（同一ドメイン内ユーザーが同意して使う）:
   `directory.readonly`（同僚検索）/ `calendar.freebusy`（空き照会）/ `calendar.events`（予約確定）
5. シークレットを格納:
   `wrangler secret put GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `ALLOWED_DOMAIN` / `COOKIE_SECRET` / `TYPESAFE_API_KEY`

## ライセンス

MIT
