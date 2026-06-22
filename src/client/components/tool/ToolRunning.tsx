// =============================================================================
// client/components/tool/ToolRunning
// 実行中のツール呼び出しの表示。
// =============================================================================

import { LayerCard, Text } from "@cloudflare/kumo";
import { GearIcon } from "@phosphor-icons/react";

export function ToolRunning({ toolName }: { toolName: string }) {
  return (
    <div className="flex justify-start">
      <LayerCard className="max-w-[85%] px-4 py-2.5 rounded-xl ring ring-kumo-line">
        <div className="flex items-center gap-2">
          <GearIcon size={14} className="text-kumo-inactive animate-spin" />
          <Text size="xs" variant="secondary">
            Running {toolName}...
          </Text>
        </div>
      </LayerCard>
    </div>
  );
}
