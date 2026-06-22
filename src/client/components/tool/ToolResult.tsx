// =============================================================================
// client/components/tool/ToolResult
// 汎用ツールの完了表示（createEvent 以外）。
// 出力が冗長になりがちなので、Reasoning と同じくデフォルトで折りたたむ。
// =============================================================================

import { Badge, LayerCard, Text } from "@cloudflare/kumo";
import { CaretDownIcon, GearIcon } from "@phosphor-icons/react";

export function ToolResult({
  toolName,
  output
}: {
  toolName: string;
  output: unknown;
}) {
  return (
    <div className="flex justify-start">
      <LayerCard className="max-w-[85%] w-full px-4 py-2.5 rounded-xl ring ring-kumo-line">
        <details>
          <summary className="flex items-center gap-2 cursor-pointer select-none">
            <GearIcon size={14} className="text-kumo-inactive" />
            <Text size="xs" variant="secondary" bold>
              {toolName}
            </Text>
            <Badge variant="secondary">Done</Badge>
            <CaretDownIcon size={14} className="ml-auto text-kumo-inactive" />
          </summary>
          <div className="font-mono mt-2">
            <Text size="xs" variant="secondary">
              {JSON.stringify(output, null, 2)}
            </Text>
          </div>
        </details>
      </LayerCard>
    </div>
  );
}
