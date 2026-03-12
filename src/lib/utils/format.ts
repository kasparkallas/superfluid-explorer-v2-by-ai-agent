// Flow rate granularity multipliers
export const FLOW_RATE_MULTIPLIERS = {
  "/s": 1n,
  "/min": 60n,
  "/hr": 3600n,
  "/day": 86400n,
  "/wk": 604800n,
  "/mo": 2592000n, // 30 days
} as const;

export type FlowRateGranularity = keyof typeof FLOW_RATE_MULTIPLIERS;

/**
 * Format a BigInt wei value to a human-readable decimal string.
 * Super Tokens always have 18 decimals.
 */
export function formatEther(wei: bigint | string, displayDecimals: number = 5): string {
  const value = typeof wei === "string" ? BigInt(wei) : wei;
  const isNegative = value < 0n;
  const absValue = isNegative ? -value : value;
  const integer = absValue / 10n ** 18n;
  const fraction = absValue % (10n ** 18n);
  const fractionStr = fraction.toString().padStart(18, "0").slice(0, displayDecimals);

  // Trim trailing zeros for "smart" display
  const trimmed = fractionStr.replace(/0+$/, "");
  const sign = isNegative ? "-" : "";

  if (trimmed.length === 0) return `${sign}${integer.toLocaleString()}`;
  return `${sign}${integer.toLocaleString()}.${trimmed}`;
}

/**
 * Format a flow rate from wei/second to the chosen granularity.
 */
export function formatFlowRate(
  weiPerSecond: bigint | string,
  granularity: FlowRateGranularity = "/mo",
  displayDecimals: number = 5
): string {
  const rate = typeof weiPerSecond === "string" ? BigInt(weiPerSecond) : weiPerSecond;
  const multiplier = FLOW_RATE_MULTIPLIERS[granularity];
  const scaled = rate * multiplier;
  return formatEther(scaled, displayDecimals);
}

/**
 * Format a timestamp to relative time (e.g., "5 min ago", "2 days ago").
 */
export function formatRelativeTime(timestamp: number | string): string {
  const ts = typeof timestamp === "string" ? parseInt(timestamp) : timestamp;
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;

  if (diff < 0) {
    const absDiff = -diff;
    if (absDiff < 60) return `in ${absDiff}s`;
    if (absDiff < 3600) return `in ${Math.floor(absDiff / 60)}m`;
    if (absDiff < 86400) return `in ${Math.floor(absDiff / 3600)}h`;
    if (absDiff < 604800) return `in ${Math.floor(absDiff / 86400)}d`;
    return `in ${Math.floor(absDiff / 604800)}w`;
  }

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}

/**
 * Format a full date/time string.
 */
export function formatTimestamp(timestamp: number | string): string {
  const ts = typeof timestamp === "string" ? parseInt(timestamp) : timestamp;
  return new Date(ts * 1000).toLocaleString();
}
