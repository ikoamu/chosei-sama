---
status: accepted
---

# FreeBusy 照会をサービスアカウントからユーザー OAuth に切り替える

カレンダーの空き照会を、サービスアカウント＋ドメイン全体委任（DwD）ではなく、**ログインユーザー自身の OAuth トークン**で行う。Workspace 管理者が DwD を許可しておらず（`unauthorized_client`）、SA 方式が使えないため。Directory 検索（People API）と同じく、ログイン時に取得した refresh_token から access_token を発行して FreeBusy を叩く。要求スコープは最小権限の `calendar.freebusy`。

## Considered Options

- **SA + ドメイン全体委任**: 全ドメインのカレンダーを管理者承認のもと確実に読める。ただし管理者が委任設定を許可しないと使えない（今回これに該当）。
- **ユーザー OAuth（採用）**: 管理者作業が不要で、依頼者の権限で読める。ただし読める範囲は各人の free/busy 共有設定に依存する。

## Consequences

- **空き可視性**が依頼者権限に依存する。free/busy を共有していない参加者や外部ドメインのメールは読めず、その場合は該当者を明示して調整を中断する（黙って無視して候補を出さない）。
- 既存ユーザーは calendar スコープを含む再ログインが必要（スコープ不足を検知して誘導）。
- refresh_token は DO の `ctx.storage`（サーバー専用・クライアント非同期）に保持する。`setState` はクライアントへブロードキャストされるため使わない。
- 将来の予約確定（`events.insert`）では `calendar.events` を incremental auth で追加する。
