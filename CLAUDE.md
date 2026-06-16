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
    base64url.ts          # base64url 変換（server / scheduler 共有）
  scheduler/              # 提案エンジン（ランタイム非依存・テスト対象）
    index.ts              # 公開 API のバレル（外からはここ経由で import）
    types.ts              # Interval / SlotPreferences など型定義
    intervals.ts          # mergeIntervals / subtractIntervals / overlaps（純粋）
    timezone.ts           # epoch ms ⇄ IANA tz の変換ヘルパー（純粋）
    windows.ts            # workingWindowsInRange（勤務時間ウィンドウ生成）
    slots.ts              # commonFree / findSlots / scoreSlot
    google-auth.ts        # getAccessToken（SA 鍵 → トークン, RS256）
    freebusy.ts           # queryFreeBusy（FreeBusy 照会）
    suggest.ts            # suggestSlots（単発）/ suggestRecurringSlots（定期）
    intervals.test.ts     # 区間・tz ロジックの単体テスト（13件）
  server/                 # Worker / Durable Object 側
    index.ts              # Worker エントリ（wrangler main）。ルーティング＋ChatAgent re-export
    chat-agent.ts         # ChatAgent（AIChatAgent ベースの Durable Object）
    prompt.ts             # システムプロンプト生成
    service-account.ts    # GOOGLE_SA_KEY（Secrets）の読み出し
    tools/
      index.ts            # buildTools（自前ツールを束ねる）
      calendar-tools.ts   # suggestSlots / suggestRecurringSlots ツール
      task-tools.ts       # getUserTimezone / scheduleTask など
    auth/
      index.ts            # /oauth/* ハンドラ＋ verifySession re-export
      session.ts          # 署名付きセッション Cookie（HMAC）
      google-oauth.ts     # Google ログイン（認可 URL・コード交換）
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
  - `queryFreeBusy` … Google Calendar FreeBusy 照会（busy区間だけ取得し、予定の中身は見ない）。
  - `getAccessToken` … サービスアカウント鍵 → アクセストークン（Web Crypto / RS256、ドメイン委任の `subject` 偽装あり）。
  - 純粋関数の区間演算: `mergeIntervals` / `subtractIntervals` / `commonFree` / `findSlots`。
  - 高レベルAPI: `suggestSlots`（単発）/ `suggestRecurringSlots`（定期）。
- `src/server/` … `ChatAgent` と OAuth・ツール定義。**scheduler との結線済み**（`tools/calendar-tools.ts`）。
- `src/client/` … チャット UI。Kumo デザインシステム、ダーク/ライトモード対応。
- **まだ無い**: イベント作成（予約確定）、自然文の解釈層の作り込み。

## HOW — 技術スタックと方針

- ランタイム: **Cloudflare Workers + Agents SDK**。各Agentは Durable Object（状態・cron・WebSocketを持つ）。
- カレンダー: **Google Calendar API**。空き判定は FreeBusy（`freebusy.query`）でbusy区間のみ取得＝プライバシー配慮。
- 認証: **GCPサービスアカウント + Workspaceドメイン委任**（スコープ `calendar.readonly`）。
  鍵は `wrangler secret put GOOGLE_SA_KEY` で格納。**コードや .env に鍵を直書きしない。**
- タイムゾーン: 計算はすべて epoch ms。境界（勤務時間の生成・表示）でのみ IANA tz 変換。既定は `Asia/Tokyo`。

## 次のタスク（優先順）

1. 提案結果を予約確定する `events.insert`。**必ず human-in-the-loop**:「候補提示 → 人が承認 → 作成＋招待送信」。承認前に書き込まない。
2. **自然文の解釈層**（「Dさんと30分おさえて」→ パラメータ抽出 → `suggestSlots`）。
3. 仕上げ: 辞退済み予定/ランチ枠/会議間バッファ/個人別勤務時間、UI、複数tz対応。

## ガードレール（重要）

- カレンダーへの**書き込み・招待送信は副作用**。必ずユーザー承認を挟む。読み取り＆提案は自動でよい。
- 他人の free/busy へのアクセスは**情シス / Workspace管理者の承認が前提**。ドメイン委任の設定も管理者作業。
- 秘密情報（SA鍵・トークン）は **Secrets のみ**。ログ・URL・リポジトリに残さない。

## コマンド

- 開発サーバ: `pnpm dev`
- コアのテスト: `pnpm exec tsx src/scheduler/intervals.test.ts`
- lint / format / 型チェック: `pnpm check`
- デプロイ: main push で Cloudflare Workers Builds が自動実行。手動: `pnpm deploy`（= `vite build && wrangler deploy`）

## 参照リンク

- Cloudflare Agents: https://developers.cloudflare.com/agents/
- Google Calendar API (FreeBusy): `freebusy.query`
- Claude Code メモリ(CLAUDE.md): https://code.claude.com/docs/en/memory
