// =============================================================================
// client/components/ToolPartView
// ツール呼び出しパートの表示。実行中・完了・承認待ち・却下の各状態を描き分け、
// 承認待ちのときは Approve / Reject ボタンを出す。
// =============================================================================

import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { Badge, Button, Surface, Text } from "@cloudflare/kumo";
import { CheckCircleIcon, GearIcon, XCircleIcon } from "@phosphor-icons/react";

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
              {JSON.stringify(part.output, null, 2)}
            </Text>
          </div>
        </Surface>
      </div>
    );
  }

  // Needs approval
  if ("approval" in part && part.state === "approval-requested") {
    const approvalId = (part.approval as { id?: string })?.id;
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
              <BookingSummary input={part.input} />
            ) : (
              <Text size="xs" variant="secondary">
                <span className="font-mono">
                  {JSON.stringify(part.input, null, 2)}
                </span>
              </Text>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={<CheckCircleIcon size={14} />}
              onClick={() => {
                if (approvalId) {
                  addToolApprovalResponse({ id: approvalId, approved: true });
                }
              }}
            >
              Approve
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<XCircleIcon size={14} />}
              onClick={() => {
                if (approvalId) {
                  addToolApprovalResponse({ id: approvalId, approved: false });
                }
              }}
            >
              Reject
            </Button>
          </div>
        </Surface>
      </div>
    );
  }

  // Rejected / denied
  if (
    part.state === "output-denied" ||
    ("approval" in part &&
      (part.approval as { approved?: boolean })?.approved === false)
  ) {
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

  // Executing
  if (part.state === "input-available" || part.state === "input-streaming") {
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
  return (
    <div className="space-y-1">
      {row("件名", ev.title || "（無題）")}
      {row("日時", `${fmt(ev.startISO)} 〜 ${fmt(ev.endISO)}`)}
      {row("参加者", ev.attendees?.length ? ev.attendees.join("、") : "なし")}
      {row("Meet", ev.addMeet === false ? "なし" : "あり")}
    </div>
  );
}
