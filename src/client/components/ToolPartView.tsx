// =============================================================================
// client/components/ToolPartView
// ツール呼び出しパートの表示。実行中・完了・承認待ち・却下の各状態を描き分け、
// 承認待ちのときは Approve / Reject ボタンを出す。
// =============================================================================

import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { Badge, Button, Surface, Text } from "@cloudflare/kumo";
import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  GearIcon,
  VideoCameraIcon,
  WarningCircleIcon,
  XCircleIcon
} from "@phosphor-icons/react";

/** 汎用ツールの完了表示（createEvent 以外）。 */
function ToolResult({
  toolName,
  output
}: {
  toolName: string;
  output: unknown;
}) {
  return (
    <div className="flex justify-start">
      <Surface className="max-w-[85%] px-4 py-2.5 rounded-xl ring ring-kumo-line">
        <div className="flex items-center gap-2 mb-1">
          <GearIcon size={14} className="text-kumo-inactive" />
          <Text size="xs" variant="secondary" bold>
            {toolName}
          </Text>
          <Badge variant="secondary">Done</Badge>
        </div>
        <div className="font-mono">
          <Text size="xs" variant="secondary">
            {JSON.stringify(output, null, 2)}
          </Text>
        </div>
      </Surface>
    </div>
  );
}

/** 承認待ちカード（Approve / Reject ボタン付き）。 */
function ToolApproval({
  toolName,
  input,
  approvalId,
  addToolApprovalResponse
}: {
  toolName: string;
  input: unknown;
  approvalId?: string;
  addToolApprovalResponse: (response: {
    id: string;
    approved: boolean;
  }) => void;
}) {
  const respond = (approved: boolean) => {
    if (approvalId) {
      addToolApprovalResponse({ id: approvalId, approved });
    }
  };
  return (
    <div className="flex justify-start">
      <Surface className="max-w-[85%] px-4 py-3 rounded-xl ring-2 ring-kumo-warning">
        <div className="flex items-center gap-2 mb-2">
          <GearIcon size={14} className="text-kumo-warning" />
          <Text size="sm" bold>
            {toolName === "createEvent"
              ? "この内容で予約しますか？"
              : `Approval needed: ${toolName}`}
          </Text>
        </div>
        <div className="mb-3">
          {toolName === "createEvent" ? (
            <BookingSummary input={input} />
          ) : (
            <Text size="xs" variant="secondary">
              <span className="font-mono">
                {JSON.stringify(input, null, 2)}
              </span>
            </Text>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            icon={<CheckCircleIcon size={14} />}
            onClick={() => respond(true)}
          >
            Approve
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<XCircleIcon size={14} />}
            onClick={() => respond(false)}
          >
            Reject
          </Button>
        </div>
      </Surface>
    </div>
  );
}

/** 却下／拒否されたツール呼び出しの表示。 */
function ToolRejected({ toolName }: { toolName: string }) {
  return (
    <div className="flex justify-start">
      <Surface className="max-w-[85%] px-4 py-2.5 rounded-xl ring ring-kumo-line">
        <div className="flex items-center gap-2">
          <XCircleIcon size={14} className="text-kumo-danger" />
          <Text size="xs" variant="secondary" bold>
            {toolName}
          </Text>
          <Badge variant="secondary">Rejected</Badge>
        </div>
      </Surface>
    </div>
  );
}

/** 実行中のツール呼び出しの表示。 */
function ToolRunning({ toolName }: { toolName: string }) {
  return (
    <div className="flex justify-start">
      <Surface className="max-w-[85%] px-4 py-2.5 rounded-xl ring ring-kumo-line">
        <div className="flex items-center gap-2">
          <GearIcon size={14} className="text-kumo-inactive animate-spin" />
          <Text size="xs" variant="secondary">
            Running {toolName}...
          </Text>
        </div>
      </Surface>
    </div>
  );
}

export function ToolPartView({
  part,
  addToolApprovalResponse
}: {
  part: UIMessage["parts"][number];
  addToolApprovalResponse: (response: {
    id: string;
    approved: boolean;
  }) => void;
}) {
  if (!isToolUIPart(part)) {
    return null;
  }
  const toolName = getToolName(part);

  // Completed
  if (part.state === "output-available") {
    return toolName === "createEvent" ? (
      <BookingResult output={part.output} />
    ) : (
      <ToolResult toolName={toolName} output={part.output} />
    );
  }

  // Needs approval
  if ("approval" in part && part.state === "approval-requested") {
    return (
      <ToolApproval
        toolName={toolName}
        input={part.input}
        approvalId={(part.approval as { id?: string })?.id}
        addToolApprovalResponse={addToolApprovalResponse}
      />
    );
  }

  // Rejected / denied
  if (
    part.state === "output-denied" ||
    ("approval" in part &&
      (part.approval as { approved?: boolean })?.approved === false)
  ) {
    return <ToolRejected toolName={toolName} />;
  }

  // Executing
  if (part.state === "input-available" || part.state === "input-streaming") {
    return <ToolRunning toolName={toolName} />;
  }

  return null;
}

/** createEvent の承認カードに出す、人間が読める予約内容の要約。 */
function BookingSummary({ input }: { input: unknown }) {
  const ev = (input ?? {}) as {
    title?: string;
    startISO?: string;
    endISO?: string;
    attendees?: string[];
    timeZone?: string;
    addMeet?: boolean;
    recurrence?: { everyNWeeks?: number; occurrences?: number };
  };
  const tz = ev.timeZone || "Asia/Tokyo";
  const fmt = (iso?: string) => {
    if (!iso) {
      return "—";
    }
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleString("ja-JP", {
          timeZone: tz,
          dateStyle: "medium",
          timeStyle: "short"
        });
  };
  const row = (label: string, value: string) => (
    <div className="flex gap-2 text-xs">
      <span className="text-kumo-subtle shrink-0 w-12">{label}</span>
      <span className="text-kumo-default break-all">{value}</span>
    </div>
  );
  const recur = ev.recurrence;
  const recurText = recur
    ? `${recur.everyNWeeks === 1 ? "毎週" : `${recur.everyNWeeks}週ごと`}・全${recur.occurrences}回`
    : null;
  return (
    <div className="space-y-1">
      {row("件名", ev.title || "（無題）")}
      {row("日時", `${fmt(ev.startISO)} 〜 ${fmt(ev.endISO)}`)}
      {recurText && row("繰り返し", recurText)}
      {row("参加者", ev.attendees?.length ? ev.attendees.join("、") : "なし")}
      {row("Meet", ev.addMeet === false ? "なし" : "あり")}
    </div>
  );
}

/** createEvent 実行後の完了/失敗を読める形で表示する。 */
function BookingResult({ output }: { output: unknown }) {
  const res = (output ?? {}) as {
    created?: boolean;
    alreadyExists?: boolean;
    htmlLink?: string;
    hangoutLink?: string;
    message?: string;
    error?: string;
  };

  // 失敗（スコープ不足・読めない参加者・その他）。
  if (res.error) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] flex items-start gap-2.5 px-4 py-3 rounded-2xl rounded-bl-md bg-red-500/10 border border-red-500/20 text-sm">
          <WarningCircleIcon
            size={18}
            className="text-red-500 shrink-0 mt-0.5"
          />
          <div className="min-w-0 space-y-1">
            <p className="text-kumo-default">予約できませんでした。</p>
            <p className="text-xs text-kumo-subtle break-all">{res.error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <Surface className="max-w-[85%] px-4 py-3 rounded-xl ring ring-kumo-line space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircleIcon size={16} className="text-kumo-success" />
          <Text size="sm" bold>
            {res.alreadyExists ? "同じ予約が作成済みです" : "予約しました"}
          </Text>
        </div>
        {res.message && (
          <Text size="xs" variant="secondary">
            {res.message}
          </Text>
        )}
        <div className="flex flex-wrap gap-3">
          {res.htmlLink && (
            <a
              href={res.htmlLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-kumo-accent hover:underline"
            >
              <ArrowSquareOutIcon size={14} />
              Google カレンダーで開く
            </a>
          )}
          {res.hangoutLink && (
            <a
              href={res.hangoutLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-kumo-accent hover:underline"
            >
              <VideoCameraIcon size={14} />
              Meet を開く
            </a>
          )}
        </div>
      </Surface>
    </div>
  );
}
