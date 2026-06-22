# chosei-sama

## WHY — 目的

Google Workspace の共有カレンダーから、指定メンバー全員が空いている時間を提案する社内ツール。
主な2ユースケース:

1. **定期開催の提案** — 例:「A・B・Cで隔週1h、来月開始、できれば午後」
2. **単発調整** — 例:「Dさんと30分、直近1週間で空き枠を探す」

## WHAT — 現状（2026-06 時点）

ランタイム境界で `scheduler`（純粋エンジン）/ `server`（Worker）/ `client`（ブラウザ）に分割し、
共有ユーティリティは `shared/` に置く。各ディレクトリは原則 `index.ts` を公開窓口とする。

```
src/
  shared/
    directory.ts          # People API ディレクトリ検索（findPeople）＝参加者解決（server / client 共有）
  scheduler/              # 提案エンジン（ランタイム非依存・テスト対象）
    index.ts              # 公開 API のバレル（外からはここ経由で import）
    types.ts              # Interval / SlotPreferences など型定義
    intervals.ts          # mergeIntervals / subtractIntervals / overlaps（純粋）
    timezone.ts           # epoch ms ⇄ IANA tz の変換ヘルパー（純粋）
    windows.ts            # workingWindowsInRange（勤務時間ウィンドウ生成）
    slots.ts              # commonFree / findSlots / scoreSlot
    freebusy.ts           # queryFreeBusy / parseFreeBusyResponse（FreeBusy 照会）
    suggest.ts            # suggestSlots（単発）/ suggestRecurringSlots（定期）
    events.ts             # buildEventRequest / createEvent（events.insert＝予約確定）
    intervals.test.ts     # 区間・tz ロジックの単体テスト（vitest）
    freebusy.test.ts      # FreeBusy レスポンス分解の単体テスト（vitest）
    events.test.ts        # イベント生成リクエスト組み立ての単体テスト（vitest）
  server/                 # Worker / Durable Object 側
    index.ts              # Worker エントリ（wrangler main）。ルーティング＋ChatAgent re-export
    chat-agent.ts         # ChatAgent（DO）。onConnect で認証確定＋refresh_token保持、
                          # getCalendarAccessToken で本人トークン発行
    prompt.ts             # システムプロンプト生成
    tools/
      index.ts            # buildTools（自前ツールを束ねる）
      calendar-tools.ts   # findPeople / suggestSlots / suggestRecurringSlots / createEvent ツール
      task-tools.ts       # getUserTimezone / scheduleTask など
    auth/
      index.ts            # /oauth/* ハンドラ＋ verifySession re-export
      session.ts          # 署名付きセッション Cookie（HMAC）
      google-oauth.ts     # Google ログイン（認可 URL・コード交換）
      base64url.ts        # base64url 変換（セッション HMAC・ID トークンのデコード）
  client/                 # ブラウザ / React 側
    index.tsx             # React エントリポイント
    App.tsx               # ルート（ログイン／チャットの出し分け）
    styles.css            # Tailwind + Kumo スタイル
    types.ts              # AuthUser などクライアント共有型
    hooks/useAuth.ts      # ログイン状態フック
    lib/directory.ts      # People API ディレクトリ検索（ブラウザ直叩き）
    components/           # Chat / ChatHeader / MessageList / ToolPartView /
                          # ParticipantPicker / LoginScreen / ThemeToggle
index.html                # SPA エントリ（/src/client/index.tsx を読む）
env.secrets.d.ts          # Secrets（wrangler types で消えない Env 型補完）
wrangler.jsonc            # Workers / Durable Object 設定
vite.config.ts            # Vite ビルド設定
                          # デプロイは Cloudflare Workers Builds（Git 連携）で自動実行
```

- `src/scheduler/` … 提案エンジン。**実装済み・テスト済み**。公開 API は `index.ts` 経由。
  - `queryFreeBusy` / `parseFreeBusyResponse` … FreeBusy 照会（busy区間だけ取得し、予定の中身は見ない）。読めなかった参加者は throw せず `unreadable` に分ける。
  - 照会は**依頼者本人の OAuth アクセストークン**で行う（SA は廃止。`docs/adr/0001` 参照）。
  - 純粋関数の区間演算: `mergeIntervals` / `subtractIntervals` / `commonFree` / `findSlots`。
  - 高レベルAPI: `suggestSlots`（単発）/ `suggestRecurringSlots`（定期）。
  - 予約確定: `buildEventRequest` / `createEvent`（`events.insert`）。書き込みは server 側で承認を挟む。
- `src/server/` … `ChatAgent` と OAuth・ツール定義。**scheduler との結線済み**（`tools/calendar-tools.ts`）。
  - 参加者解決: `shared/directory.ts`（People API findPeople）を `findPeople` ツールとして公開。
  - 予約確定: `scheduler/events.ts`（`events.insert`）を `createEvent` ツールとして公開。**human-in-the-loop**（`needsApproval: true`）で承認を挟んでから書き込む。
- `src/client/` … チャット UI。Kumo デザインシステム、ダーク/ライトモード対応。

## HOW — 技術スタックと方針

- ランタイム: **Cloudflare Workers + Agents SDK**。各Agentは Durable Object（状態・cron・WebSocketを持つ）。
- カレンダー: **Google Calendar API**。空き判定は FreeBusy（`freebusy.query`）でbusy区間のみ取得＝プライバシー配慮。
- 認証: **ユーザー自身の OAuth**（ログイン時にスコープ `calendar.freebusy` を同意）。FreeBusy は依頼者本人のトークンで叩く。
  ログインの `refresh_token` をセッション Cookie に保持し、DO は `onConnect` で検証して `ctx.storage` に保管、`getCalendarAccessToken` で都度 access_token を発行。
  **SA + ドメイン委任は廃止**（管理者が委任を許可せず `unauthorized_client`。経緯は `docs/adr/0001`）。
  読めない参加者がいる場合は候補を出さず名指しで中断する（CONTEXT.md「空き可視性」）。
- タイムゾーン: 計算はすべて epoch ms。境界（勤務時間の生成・表示）でのみ IANA tz 変換。既定は `Asia/Tokyo`。

## ガードレール（重要）

- カレンダーへの**書き込み・招待送信は副作用**。必ずユーザー承認を挟む。読み取り＆提案は自動でよい。
- 他人の free/busy は**依頼者本人の権限で読める範囲のみ**。読めない人は黙って無視せず名指しで中断する。
- 静的な秘密情報（OAuth クライアントシークレット・`COOKIE_SECRET`）は **Secrets のみ**。ログ・URL・リポジトリに残さない。
- ユーザーの `refresh_token` は per-user の動的資格情報。DO の `ctx.storage`（サーバー専用）にのみ保持し、`setState`（クライアントへ同期）やログには出さない。

## コマンド

- 開発サーバ: `pnpm dev`
- テスト: `pnpm test`（vitest, node 環境）。テストは `src/**/*.test.ts`
- lint / format / 型チェック: `pnpm check`
- コード品質の傾向確認: `pnpm quality`（fallow）。**スコアは鵜呑みにしない** — `@babel/plugin-proposal-decorators` / `@rolldown/plugin-babel`（`@callable` デコレータのビルドに必要）や `ChatAgent` のライフサイクル（`onConnect`/`onStart`/`onChatMessage` 等、SDK が呼ぶ）は「未使用」と誤検知される。これらは削除しない。
- デプロイ: main push で Cloudflare Workers Builds が自動実行。手動: `pnpm deploy`（= `vite build && wrangler deploy`）

## 参照リンク

- Cloudflare Agents: https://developers.cloudflare.com/agents/
- Google Calendar API (FreeBusy): `freebusy.query`
- Claude Code メモリ(CLAUDE.md): https://code.claude.com/docs/en/memory

## エージェントスキル

### イシュートラッカー

イシューと PRD は `.scratch/<feature>/` 配下の Markdown ファイルとして管理する。詳細は `docs/agents/issue-tracker.md`。

### トリアージラベル

5つの正規トリアージ役割（needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix）をデフォルト文字列で使用。詳細は `docs/agents/triage-labels.md`。

### ドメインドキュメント

シングルコンテキスト構成：リポジトリ直下に `CONTEXT.md` と `docs/adr/` を1つずつ（必要時に随時作成）。詳細は `docs/agents/domain.md`。
