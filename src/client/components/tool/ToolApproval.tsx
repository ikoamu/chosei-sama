// =============================================================================
// client/components/tool/ToolApproval
// 承認待ちカード（Approve / Reject ボタン付き）。
// =============================================================================

import { Button, Surface, Text } from "@cloudflare/kumo";
import { CheckCircleIcon, GearIcon, XCircleIcon } from "@phosphor-icons/react";
import type { AddToolApprovalResponse } from "./types";
import { BookingSummary } from "./BookingSummary";

export function ToolApproval({
  toolName,
  input,
  approvalId,
  addToolApprovalResponse
}: {
  toolName: string;
  input: unknown;
  approvalId?: string;
  addToolApprovalResponse: AddToolApprovalResponse;
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
