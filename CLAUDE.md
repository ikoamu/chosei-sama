# chosei-sama

## WHY — 目的

Google Workspace の共有カレンダーから、指定メンバー全員が空いている時間を提案する社内ツール。
主な2ユースケース:

1. **定期開催の提案** — 例:「A・B・Cで隔週1h、来月開始、できれば午後」
2. **単発調整** — 例:「Dさんと30分、直近1週間で空き枠を探す」

## WHAT — 現状（2026-06 時点）

```
src/
  server.ts              # ChatAgent（AIChatAgent ベース）＋ツール定義
  app.tsx                # チャット UI（Kumo コンポーネント）
  client.tsx             # React エントリポイント
  styles.css             # Tailwind + Kumo スタイル
  scheduler-core.ts      # 提案エンジン（実装済み・テスト済み）
  scheduler-core.test.ts # 区間ロジックの単体テスト（13件）
index.html               # SPA エントリ
wrangler.jsonc            # Workers / Durable Object 設定
vite.config.ts            # Vite ビルド設定
workflows/
  sanity-check.yml        # CI（push/PR → npm install & check）
```

- `src/scheduler-core.ts` … 提案エンジン。**実装済み・テスト済み**。
  - `queryFreeBusy` … Google Calendar FreeBusy 照会（busy区間だけ取得し、予定の中身は見ない）。
  - `getAccessToken` … サービスアカウント鍵 → アクセストークン（Web Crypto / RS256、ドメイン委任の `subject` 偽装あり）。
  - 純粋関数の区間演算: `mergeIntervals` / `subtractIntervals` / `commonFree` / `findSlots`。
  - 高レベルAPI: `suggestSlots`（単発）/ `suggestRecurringSlots`（定期）。
- `src/scheduler-core.test.ts` … 区間ロジックの単体テスト（13件）。
- `src/server.ts` … Agents スターターの `ChatAgent`（デモツール付き）。**scheduler-core との結線はまだ**。
- `src/app.tsx` … チャット UI。Kumo デザインシステム、ダーク/ライトモード対応。
- **まだ無い**: scheduler-core との結線、イベント作成（予約確定）、自然文の解釈層、認証情報の配線。

## HOW — 技術スタックと方針

- ランタイム: **Cloudflare Workers + Agents SDK**。各Agentは Durable Object（状態・cron・WebSocketを持つ）。
- カレンダー: **Google Calendar API**。空き判定は FreeBusy（`freebusy.query`）でbusy区間のみ取得＝プライバシー配慮。
- 認証: **GCPサービスアカウント + Workspaceドメイン委任**（スコープ `calendar.readonly`）。
  鍵は `wrangler secret put GOOGLE_SA_KEY` で格納。**コードや .env に鍵を直書きしない。**
- タイムゾーン: 計算はすべて epoch ms。境界（勤務時間の生成・表示）でのみ IANA tz 変換。既定は `Asia/Tokyo`。

## 次のタスク（優先順）

1. **scheduler-core との結線** — `src/server.ts` のデモツールを置き換え、`suggestSlots` / `suggestRecurringSlots` を呼ぶツールを定義する。
2. 提案結果を予約確定する `events.insert`。**必ず human-in-the-loop**:「候補提示 → 人が承認 → 作成＋招待送信」。承認前に書き込まない。
3. **自然文の解釈層**（「Dさんと30分おさえて」→ パラメータ抽出 → `suggestSlots`）。
4. 仕上げ: 辞退済み予定/ランチ枠/会議間バッファ/個人別勤務時間、UI、複数tz対応。

## ガードレール（重要）

- カレンダーへの**書き込み・招待送信は副作用**。必ずユーザー承認を挟む。読み取り＆提案は自動でよい。
- 他人の free/busy へのアクセスは**情シス / Workspace管理者の承認が前提**。ドメイン委任の設定も管理者作業。
- 秘密情報（SA鍵・トークン）は **Secrets のみ**。ログ・URL・リポジトリに残さない。

## コマンド

- 開発サーバ: `pnpm dev`
- コアのテスト: `pnpm exec tsx src/scheduler-core.test.ts`
- lint / format / 型チェック: `pnpm check`
- デプロイ: `pnpm deploy`（= `vite build && wrangler deploy`）

## 参照リンク

- Cloudflare Agents: https://developers.cloudflare.com/agents/
- Google Calendar API (FreeBusy): `freebusy.query`
- Claude Code メモリ(CLAUDE.md): https://code.claude.com/docs/en/memory
