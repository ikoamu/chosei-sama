// =============================================================================
// client/components/tool/ToolResult
// 汎用ツールの完了表示（createEvent 以外）。
// =============================================================================

import { Badge, Surface, Text } from "@cloudflare/kumo";
import { GearIcon } from "@phosphor-icons/react";

export function ToolResult({
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
