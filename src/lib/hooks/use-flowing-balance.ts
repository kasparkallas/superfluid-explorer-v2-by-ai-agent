import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Hook that animates a Superfluid real-time balance.
 * Formula: currentBalance = balance + BigInt(now_s - timestamp) * flowRate
 *
 * @param balance - snapshot balance in wei (BigInt or string)
 * @param timestamp - snapshot timestamp in seconds (number or string)
 * @param flowRate - net flow rate in wei/second (BigInt or string)
 * @returns current computed balance as BigInt
 */
export function useFlowingBalance(
  balance: bigint | string,
  timestamp: number | string,
  flowRate: bigint | string
): bigint {
  const balanceBn = typeof balance === "string" ? BigInt(balance) : balance;
  const ts = typeof timestamp === "string" ? parseInt(timestamp) : timestamp;
  const rateBn = typeof flowRate === "string" ? BigInt(flowRate) : flowRate;

  const compute = useCallback(() => {
    if (rateBn === 0n) return balanceBn;
    const now = Math.floor(Date.now() / 1000);
    return balanceBn + BigInt(now - ts) * rateBn;
  }, [balanceBn, ts, rateBn]);

  const [current, setCurrent] = useState(compute);
  const rafRef = useRef<number>(0);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    if (rateBn === 0n) {
      setCurrent(balanceBn);
      return;
    }

    const animate = () => {
      const now = Date.now();
      // Update ~10 times per second
      if (now - lastUpdateRef.current >= 100) {
        setCurrent(compute());
        lastUpdateRef.current = now;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [compute, rateBn, balanceBn]);

  return current;
}
