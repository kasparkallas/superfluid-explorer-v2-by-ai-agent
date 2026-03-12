import { formatFlowRate, type FlowRateGranularity } from "~/lib/utils/format";
import { cn } from "~/lib/utils";

interface FlowRateDisplayProps {
  flowRate: string;
  granularity?: FlowRateGranularity;
  tokenSymbol?: string;
  decimals?: number;
  className?: string;
}

export function FlowRateDisplay({
  flowRate,
  granularity = "/mo",
  tokenSymbol,
  decimals = 5,
  className,
}: FlowRateDisplayProps) {
  const formatted = formatFlowRate(flowRate, granularity, decimals);

  return (
    <span className={cn("tabular-nums text-sm", className)}>
      {formatted}
      {tokenSymbol && <span className="text-muted-foreground ml-1">{tokenSymbol}</span>}
      <span className="text-muted-foreground text-xs ml-0.5">{granularity}</span>
    </span>
  );
}
