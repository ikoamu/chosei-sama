# chosei-sama

Google Workspace の共有カレンダーから、指定メンバー全員が空いている時間を提案する社内ツール。
Cloudflare Agents + Google Calendar FreeBusy API で動く。

## プロジェクト構成

ランタイム境界で 3 つに分割している。各ディレクトリは `index.ts` を公開窓口とする。

```
src/
  shared/        # directory（People API 検索）など server / client 共有のユーティリティ
  scheduler/     # 提案エンジン（ランタイム非依存・テスト対象）
                 #   intervals / timezone / windows / slots / freebusy /
                 #   google-auth / suggest を index.ts のバレルで公開
  server/        # Worker / Durable Object 側
                 #   index.ts（エントリ）/ chat-agent / prompt /
                 #   tools/*（ツール定義）/ auth/*（OAuth・セッション）
  client/        # ブラウザ / React 側
                 #   index.tsx / App.tsx / components/* / hooks/* / lib/*
index.html       # SPA エントリ
env.secrets.d.ts # Secrets の Env 型補完（wrangler types 再生成で消えない）
wrangler.jsonc   # Workers / Durable Object 設定
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
cp .dev.sample.vars .dev.vars   # 各値を埋める（GOOGLE_CLIENT_ID 等）
pnpm dev
```

Google Cloud の OAuth クライアントには、ローカルのリダイレクト URI
`http://localhost:5173/oauth/callback` を「承認済みのリダイレクト URI」として
登録しておくこと。

http://localhost:5173 でチャット UI が開く。

## テスト

```bash
pnpm exec tsx src/scheduler/intervals.test.ts   # 区間ロジックの単体テスト（13件）
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
   `wrangler secret put GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `ALLOWED_DOMAIN` / `COOKIE_SECRET`

## ライセンス

MIT
