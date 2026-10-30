# chosei-sama

## WHY — 目的

Google Workspace の共有カレンダーから、指定メンバー全員が空いている時間を提案する社内ツール。
主な2ユースケース:

1. **定期開催の提案** — 例:「A・B・Cで隔週1h、来月開始、できれば午後」
2. **単発調整** — 例:「Dさんと30分、直近1週間で空き枠を探す」

## WHAT — 現状（2026-10 時点）

ランタイム境界で `scheduler`（純粋エンジン）/ `server`（Worker）/ `client`（ブラウザ）に分割し、
共有ユーティリティは `shared/` に置く。各ディレクトリは原則 `index.ts` を公開窓口とする。
画面の流れは「参加者を選ぶ → 条件を文章で書いて下書きを作る → フォームで直す → 候補を探す → 予約ボタンで確定」
（チャット＋LLM から Jev の下書き＋フォームへ置き換えた経緯は `docs/adr/0003`）。

```
src/
  shared/
    criteria.ts           # 調整条件（SchedulingCriteria）・既定値・必須項目・下書き（CriteriaDraft）の型
    booking.ts            # 予約確定のリクエスト型と予定タイトルの固定テンプレート
    directory.ts          # People API ディレクトリ検索（findPeople）＝参加者解決（server / client 共有）
    *.test.ts             # 単体テスト（vitest）
  scheduler/              # 提案エンジン（ランタイム非依存・テスト対象）
    index.ts              # 公開 API のバレル（外＝server/テストが実消費する分だけを公開）
    types.ts              # Interval / SlotPreferences など型定義
    intervals.ts          # mergeIntervals / subtractIntervals / overlaps（純粋）
    timezone.ts           # epoch ms ⇄ IANA tz の変換ヘルパー（純粋）
    windows.ts            # workingWindowsInRange（勤務時間ウィンドウ生成）
    slots.ts              # commonFree / findSlots / scoreSlot
    freebusy.ts           # queryFreeBusy / parseFreeBusyResponse（FreeBusy 照会）
    suggest.ts            # suggestSlots（単発）/ suggestRecurringSlots（定期）
    events.ts             # buildEventRequest / createEvent（events.insert＝予約確定）
    *.test.ts             # intervals / freebusy / events / suggest の単体テスト（vitest）
  server/                 # Worker 側（状態を持たない）
    index.ts              # Worker エントリ（wrangler main）。/oauth/* と /api/* へルーティング
    api/
      index.ts            # handleApiRoute（セッション検証 → /api/draft・/api/suggest・/api/events）
      suggest.ts          # 調整条件 → 候補（scheduler の suggest* を呼ぶ）
      events.ts           # 予約確定（events.insert）
      testing.ts          # API テスト用のヘルパー（Google・Jev の fetch モック）
      *.test.ts           # API の振る舞いテスト
    jev/
      index.ts            # draftCriteria（Jev に問い合わせて下書きを作る。失敗時は全項目要確認）
      questions.ts        # Jev への質問（Choice / Noul）
      client.ts           # Jev API（systemone）の fetch 呼び出し
      draft.ts            # Jev の答え → 調整条件の下書き（相対日付の解決・要確認の判定）
      mask.ts             # 送信前にメールアドレスを伏せ字にする
    auth/
      index.ts            # /oauth/* ハンドラ＋ verifySession / refreshAccessToken re-export
      session.ts          # 署名付きセッション Cookie（HMAC）
      google-oauth.ts     # Google ログイン（認可 URL・コード交換・トークン更新）
      base64url.ts        # base64url 変換（セッション HMAC・ID トークンのデコード）
  client/                 # ブラウザ / React 側
    index.tsx             # React エントリポイント
    App.tsx               # ルート（ログイン／調整画面の出し分け）
    styles.css            # Tailwind + Kumo スタイル（ライトモード固定）
    types.ts              # AuthUser などクライアント共有型
    hooks/                # useAuth / useParticipantPicker / useCriteriaDraft
    lib/                  # directory（People API 直叩き）/ suggest（/api/* 呼び出し・日時表示）
    components/           # ScheduleScreen / ParticipantPicker / CriteriaForm / SuggestResultView /
                          # BookButton / AppHeader / LoginScreen と
                          # criteria/・participant/ 配下のサブ表示
index.html                # SPA エントリ（/src/client/index.tsx を読む）
env.secrets.d.ts          # Secrets（wrangler types で消えない Env 型補完）
wrangler.jsonc            # Workers 設定（DO は廃止。migrations v2 で ChatAgent を削除済み）
vite.config.ts            # Vite ビルド設定
vitest.config.ts          # テスト設定（node 環境・src/**/*.test.ts）
.fallowrc.jsonc           # fallow（pnpm quality）設定
                          # デプロイは Cloudflare Workers Builds（Git 連携）で自動実行
```

- `src/scheduler/` … 提案エンジン。**実装済み・テスト済み**。公開 API は `index.ts` 経由。
  - `queryFreeBusy` / `parseFreeBusyResponse` … FreeBusy 照会（busy区間だけ取得し、予定の中身は見ない）。読めなかった参加者は throw せず `unreadable` に分ける。
  - 照会は**依頼者本人の OAuth アクセストークン**で行う（SA は廃止。`docs/adr/0001` 参照）。
  - 純粋関数の区間演算: `mergeIntervals` / `subtractIntervals` / `commonFree` / `findSlots`。
  - 高レベルAPI: `suggestSlots`（単発）/ `suggestRecurringSlots`（定期）。
  - 予約確定: `buildEventRequest` / `createEvent`（`events.insert`）。
- `src/server/` … 状態を持たない Worker の API。
  - `POST /api/draft` … 条件の文章だけを Jev に送り、**調整条件の下書き**を返す（確からしさ 0.8 未満・必須の欠けは要確認）。
  - `POST /api/suggest` … 調整条件と参加者から候補を返す。必須項目が欠けていれば 400。
  - `POST /api/events` … 選ばれた候補で予約を確定する。**ユーザーが予約ボタンを押したこと自体を承認とみなす**。
- `src/client/` … フォーム UI。参加者は既存のピッカーで選ぶ（文章から推測しない）。Kumo デザインシステム。ヘッダーは緑 (#07AF4A) のライトモード固定。

## HOW — 技術スタックと方針

- ランタイム: **Cloudflare Workers**（状態を持たない Worker の HTTP API。Durable Object・Agents SDK は使わない）。
- 条件の解釈: **TypeSafe AI の Jev**（`jev-latest`）。文章を自由に抜き出せない判断モデルなので、項目はすべて Choice / Noul で選ばせ、日付の計算はコードで行う。SDK は使わず fetch で直接呼ぶ。
- カレンダー: **Google Calendar API**。空き判定は FreeBusy（`freebusy.query`）でbusy区間のみ取得＝プライバシー配慮。
- 認証: **ユーザー自身の OAuth**（ログイン時にスコープ `calendar.freebusy` を同意）。FreeBusy は依頼者本人のトークンで叩く。
  ログインの `refresh_token` を署名付きセッション Cookie に保持し、API はリクエストごとに検証して `refreshAccessToken` で access_token を発行する。
  **SA + ドメイン委任は廃止**（管理者が委任を許可せず `unauthorized_client`。経緯は `docs/adr/0001`）。
  読めない参加者がいる場合は候補を出さず名指しで中断する（CONTEXT.md「空き可視性」）。
- タイムゾーン: 計算はすべて epoch ms。境界（勤務時間の生成・表示）でのみ IANA tz 変換。`Asia/Tokyo` 固定。

## ガードレール（重要）

- カレンダーへの**書き込み・招待送信は副作用**。必ずユーザー承認（予約ボタン）を挟む。読み取り＆提案は自動でよい。
- 他人の free/busy は**依頼者本人の権限で読める範囲のみ**。読めない人は黙って無視せず名指しで中断する。
- 静的な秘密情報（OAuth クライアントシークレット・`COOKIE_SECRET`・`TYPESAFE_API_KEY`）は **Secrets のみ**。ログ・URL・リポジトリに残さない。
- ユーザーの `refresh_token` は per-user の動的資格情報。署名付き HttpOnly Cookie とサーバー内の処理にのみ置き、レスポンス本文やログには出さない。
- Jev（外部サービス）に送るのは**条件の文章（メールアドレスは伏せ字）と今日の日付・タイムゾーンだけ**。参加者やカレンダーの中身は送らない。

## コマンド

- 開発サーバ: `pnpm dev`
- テスト: `pnpm test`（vitest, node 環境）。テストは `src/**/*.test.ts`
- lint / format / 型チェック: `pnpm check`
- コード品質の傾向確認: `pnpm quality`（fallow）。検出が出たら基本は本物。
- デプロイ: main push で Cloudflare Workers Builds が自動実行。手動: `pnpm deploy`（= `vite build && wrangler deploy`）

## 参照リンク

- Cloudflare Workers: https://developers.cloudflare.com/workers/
- TypeSafe AI（Jev）: `POST https://api.typesafe.ai/v1/systemone`（`docs/adr/0003` 参照）
- Google Calendar API (FreeBusy): `freebusy.query`
- Claude Code メモリ(CLAUDE.md): https://code.claude.com/docs/en/memory

## エージェントスキル

### イシュートラッカー

イシューと PRD は `.scratch/<feature>/` 配下の Markdown ファイルとして管理する。詳細は `docs/agents/issue-tracker.md`。

### トリアージラベル

5つの正規トリアージ役割（needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix）をデフォルト文字列で使用。詳細は `docs/agents/triage-labels.md`。

### ドメインドキュメント

シングルコンテキスト構成：リポジトリ直下に `CONTEXT.md` と `docs/adr/` を1つずつ（必要時に随時作成）。詳細は `docs/agents/domain.md`。
