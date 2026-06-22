// =============================================================================
// client/components/tool/ToolRejected
// 却下／拒否されたツール呼び出しの表示。
// =============================================================================

import { Badge, LayerCard, Text } from "@cloudflare/kumo";
import { XCircleIcon } from "@phosphor-icons/react";

export function ToolRejected({ toolName }: { toolName: string }) {
  return (
    <div className="flex justify-start">
      <LayerCard className="max-w-[85%] px-4 py-2.5 rounded-xl ring ring-kumo-line">
        <div className="flex items-center gap-2">
          <XCircleIcon size={14} className="text-kumo-danger" />
          <Text size="xs" variant="secondary" bold>
            {toolName}
          </Text>
          <Badge variant="secondary">Rejected</Badge>
        </div>
      </LayerCard>
    </div>
  );
}
