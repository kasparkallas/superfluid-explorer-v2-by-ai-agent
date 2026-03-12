import { ZERO_ADDRESS } from "./address";

export type TokenType = "native" | "wrapper" | "pure";

/**
 * Determine Super Token type from subgraph fields.
 * - isNativeAssetSuperToken === true → "native" (ETH/MATIC wrapper)
 * - underlyingAddress !== 0x0 → "wrapper"
 * - otherwise → "pure"
 */
export function getTokenType(token: {
  isNativeAssetSuperToken: boolean;
  underlyingAddress: string;
}): TokenType {
  if (token.isNativeAssetSuperToken) return "native";
  if (
    token.underlyingAddress &&
    token.underlyingAddress.toLowerCase() !== ZERO_ADDRESS
  ) {
    return "wrapper";
  }
  return "pure";
}

export function tokenTypeLabel(type: TokenType): string {
  switch (type) {
    case "native": return "Native Asset";
    case "wrapper": return "Wrapper";
    case "pure": return "Pure";
  }
}
