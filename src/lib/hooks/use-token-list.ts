import { useQuery } from "@tanstack/react-query";

interface TokenListItem {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  extensions?: {
    superTokenInfo?: {
      type: string;
    };
  };
}

interface TokenList {
  name: string;
  tokens: TokenListItem[];
}

async function fetchTokenList(): Promise<TokenList> {
  const tokenlist = await import("@superfluid-finance/tokenlist");
  return tokenlist.default as unknown as TokenList;
}

export function useTokenList() {
  return useQuery({
    queryKey: ["tokenlist"],
    queryFn: fetchTokenList,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/**
 * Find a token in the token list by chain ID and address.
 */
export function useTokenFromList(chainId?: number, address?: string) {
  const { data: tokenList } = useTokenList();

  if (!tokenList || !chainId || !address) return undefined;

  return tokenList.tokens.find(
    (t) =>
      t.chainId === chainId &&
      t.address.toLowerCase() === address.toLowerCase()
  );
}
