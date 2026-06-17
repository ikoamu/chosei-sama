# イシュートラッカー: ローカル Markdown

このリポジトリのイシューと PRD は `.scratch/` 配下の Markdown ファイルとして管理する。

## 規約

- 1機能につき1ディレクトリ: `.scratch/<feature-slug>/`
- PRD は `.scratch/<feature-slug>/PRD.md`
- 実装イシューは `.scratch/<feature-slug>/issues/<NN>-<slug>.md`（`01` から連番）
- トリアージ状態は各イシューファイル上部の `Status:` 行に記録（役割文字列は `triage-labels.md` を参照）
- コメント・会話履歴はファイル末尾の `## Comments` 見出しの下に追記する

## スキルが「イシュートラッカーに公開」と言う場合

`.scratch/<feature-slug>/` 配下に新規ファイルを作成する（必要ならディレクトリも作成）。

## スキルが「該当チケットを取得」と言う場合

参照先パスのファイルを読む。通常はユーザーがパスまたはイシュー番号を直接渡す。
