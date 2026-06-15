# chosei-sama

Google Workspace の共有カレンダーから、指定メンバー全員が空いている時間を提案する社内ツール。
Cloudflare Agents + Google Calendar FreeBusy API で動く。

## プロジェクト構成

```
src/
  server.ts              # ChatAgent（AIChatAgent ベース）＋ツール定義
  app.tsx                # チャット UI（Kumo コンポーネント）
  client.tsx             # React エントリポイント
  styles.css             # Tailwind + Kumo スタイル
  scheduler-core.ts      # 提案エンジン（空き時間の計算ロジック）
  scheduler-core.test.ts # 区間ロジックの単体テスト（13件）
index.html               # SPA エントリ
wrangler.jsonc            # Workers / Durable Object 設定
vite.config.ts            # Vite ビルド設定
workflows/
  sanity-check.yml        # CI（push/PR → pnpm install & check）
```

## セットアップ

```bash
pnpm install
```

## 開発

```bash
pnpm dev
```

http://localhost:5173 でチャット UI が開く。

## テスト

```bash
pnpm exec tsx src/scheduler-core.test.ts   # 区間ロジックの単体テスト（13件）
```

## デプロイ

```bash
pnpm deploy   # vite build && wrangler deploy
```

## デプロイ前に必要な外部設定（管理者作業を含む）

### スケジュール提案（FreeBusy／サーバ側・サービスアカウント）

1. GCP でサービスアカウントを作成し、JSON 鍵を取得
2. Workspace 管理者に、そのサービスアカウントへ `calendar.readonly` スコープの **ドメイン全体の委任** を許可してもらう
3. 鍵を Cloudflare に格納: `wrangler secret put GOOGLE_SA_KEY`

### ログイン & 同僚検索（OAuth／ブラウザ側・ユーザートークン）

同僚検索はサービスアカウントではなく、**ログインユーザー本人のトークン**でブラウザから
直接 People API を叩く（ドメイン委任の追加は不要）。

1. GCP で OAuth 2.0 クライアント ID（ウェブアプリ）を作成
2. **承認済みリダイレクト URI** に `https://<your-domain>/oauth/callback` を追加
3. **承認済み JavaScript 生成元** にアプリのオリジン（例 `https://<your-domain>`）を追加
   ← Google Identity Services のトークン取得に必須
4. OAuth 同意画面のスコープに `directory.readonly` を追加（同一ドメイン内ユーザーが同意して使う）
5. シークレットを格納:
   `wrangler secret put GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `ALLOWED_DOMAIN` / `COOKIE_SECRET`

## ライセンス

MIT
