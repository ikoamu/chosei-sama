# チャット・DO・Agents SDK を削除する

Status: ready-for-agent

## What to build

フォーム版（#02〜#04）に置き換え終わったので、チャット版を丸ごと取り除く（ADR 0003）。

- `ChatAgent`（Durable Object）、チャット UI、チャット用のツール定義・システムプロンプト、他人の DO への接続を防ぐ判定を削除する。
- 依存から `agents`、`workers-ai-provider`、および `@callable` のビルド用に入れていたデコレータ関連のプラグインを外し、`.fallowrc.jsonc` の抑制設定も整理する。
- Workers の設定に DO クラスを削除するマイグレーション（`deleted_classes`）を入れる。**main にマージすると自動デプロイで既存 DO のデータ（会話履歴・保存済み `refresh_token`）が消え、元に戻せない**。マージの判断は人が行う。
- `CLAUDE.md` の構成図・WHAT・HOW・ガードレールを新しい構成（状態を持たない Worker の API、Jev、承認ボタン）に書き換える。

## Acceptance criteria

- [ ] チャット関連のコードと依存が残っていない（`pnpm quality` で未使用の検出が出ない）
- [ ] `deleted_classes` のマイグレーションが入っている
- [ ] `pnpm check` と `pnpm test` が通る
- [ ] `CLAUDE.md` が新しい構成を説明している
- [ ] PR の説明に「マージ時に DO のデータが消える」ことを明記している

## Blocked by

- .scratch/jev-replace/issues/03-approve-and-book.md
- .scratch/jev-replace/issues/04-jev-criteria-draft.md

## Comments
