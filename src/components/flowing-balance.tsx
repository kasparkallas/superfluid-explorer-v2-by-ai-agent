import { useFlowingBalance } from "~/lib/hooks/use-flowing-balance";
import { formatEther } from "~/lib/utils/format";

interface FlowingBalanceProps {
  balance: string;
  timestamp: string;
  flowRate: string;
  decimals?: number;
  className?: string;
}

export function FlowingBalance({
  balance,
  timestamp,
  flowRate,
  decimals = 5,
  className,
}: FlowingBalanceProps) {
  const current = useFlowingBalance(balance, timestamp, flowRate);
  const isFlowing = BigInt(flowRate) !== 0n;

  return (
    <span className={className}>
      <span className={isFlowing ? "tabular-nums" : undefined}>
        {formatEther(current, decimals)}
      </span>
    </span>
  );
}
