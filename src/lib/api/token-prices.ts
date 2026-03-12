import { createServerFn } from "@tanstack/react-start";

export interface TokenPrice {
  usd?: number;
}

export const getTokenPrice = createServerFn({ method: "GET" })
  .inputValidator((input: { network: string; tokenAddress: string }) => input)
  .handler(async ({ data: { network, tokenAddress } }) => {
    try {
      const res = await fetch(
        `https://token-prices-api.superfluid.dev/v1/${network}/${tokenAddress}`
      );
      if (!res.ok) return null;
      return (await res.json()) as TokenPrice;
    } catch {
      return null;
    }
  });
