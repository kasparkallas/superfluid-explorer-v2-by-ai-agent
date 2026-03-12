import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Badge } from "~/components/ui/badge";
import { useSearchState, detectSearchInputType, type SearchResult } from "~/lib/hooks/use-search";
import { allNetworks } from "~/lib/config/networks";
import { querySubgraph } from "~/lib/subgraph/client";
import { resolveAddress, reverseResolveName } from "~/lib/api/whois";
import { useSettings } from "~/lib/hooks/use-settings";

export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { query, debouncedQuery, inputType, updateQuery, reset } = useSearchState();
  const { settings } = useSettings();

  const visibleNetworks = allNetworks.filter(
    (n) => !n.isTestnet || settings.showTestnets
  );

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Search across networks
  const { data: results, isLoading } = useQuery({
    queryKey: ["search", debouncedQuery, inputType],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!debouncedQuery || debouncedQuery.length < 3) return [];

      const allResults: SearchResult[] = [];

      if (inputType === "address") {
        // Search for address across all visible networks
        const promises = visibleNetworks.map(async (network) => {
          try {
            const data = await querySubgraph<{
              accounts: Array<{ id: string; isSuperApp: boolean }>;
              tokens: Array<{ id: string; symbol: string; name: string; isSuperToken: boolean }>;
              pools: Array<{ id: string }>;
            }>(network.slug, `{
              accounts(where: { id: "${debouncedQuery.toLowerCase()}" }) { id isSuperApp }
              tokens(where: { id: "${debouncedQuery.toLowerCase()}" }) { id symbol name isSuperToken }
              pools(where: { id: "${debouncedQuery.toLowerCase()}" }) { id }
            }`);

            for (const account of data.accounts || []) {
              allResults.push({
                type: "account",
                network: network.slug,
                networkName: network.name,
                address: account.id,
              });
            }
            for (const token of data.tokens || []) {
              if (token.isSuperToken) {
                allResults.push({
                  type: "token",
                  network: network.slug,
                  networkName: network.name,
                  address: token.id,
                  symbol: token.symbol,
                  name: token.name,
                });
              }
            }
            for (const pool of data.pools || []) {
              allResults.push({
                type: "pool",
                network: network.slug,
                networkName: network.name,
                address: pool.id,
              });
            }
          } catch {
            // ignore network errors
          }
        });

        // Await subgraph queries and Whois resolution in parallel
        const [, whoisResult] = await Promise.all([
          Promise.allSettled(promises),
          resolveAddress({ data: debouncedQuery.toLowerCase() }).catch(() => null),
        ]);
        if (whoisResult?.name) {
          allResults.forEach((r) => {
            if (r.address.toLowerCase() === debouncedQuery.toLowerCase()) {
              r.name = whoisResult.name;
            }
          });
        }
      } else if (inputType === "name") {
        // Reverse resolve name to address, then search
        try {
          const whois = await reverseResolveName({ data: debouncedQuery });
          if (whois?.address) {
            // Recursively search as address across networks
            const promises = visibleNetworks.map(async (network) => {
              try {
                const data = await querySubgraph<{
                  accounts: Array<{ id: string }>;
                }>(network.slug, `{
                  accounts(where: { id: "${whois!.address!.toLowerCase()}" }) { id }
                }`);
                for (const account of data.accounts || []) {
                  allResults.push({
                    type: "account",
                    network: network.slug,
                    networkName: network.name,
                    address: account.id,
                    name: whois!.name,
                  });
                }
              } catch {}
            });
            await Promise.allSettled(promises);
          }
        } catch {}
      } else if (inputType === "symbol") {
        // Search tokens by symbol across networks
        const promises = visibleNetworks.map(async (network) => {
          try {
            const data = await querySubgraph<{
              tokens: Array<{ id: string; symbol: string; name: string; isSuperToken: boolean }>;
            }>(network.slug, `{
              tokens(where: { symbol_contains_nocase: "${debouncedQuery}", isSuperToken: true }, first: 5) {
                id symbol name isSuperToken
              }
            }`);
            for (const token of data.tokens || []) {
              allResults.push({
                type: "token",
                network: network.slug,
                networkName: network.name,
                address: token.id,
                symbol: token.symbol,
                name: token.name,
              });
            }
          } catch {}
        });
        await Promise.allSettled(promises);
      }

      return allResults;
    },
    enabled: !!debouncedQuery && debouncedQuery.length >= 3,
    staleTime: 30_000,
  });

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    reset();

    switch (result.type) {
      case "account":
        navigate({
          to: "/$network/accounts/$address",
          params: { network: result.network, address: result.address },
          search: {},
        });
        break;
      case "token":
        navigate({
          to: "/$network/supertokens/$address",
          params: { network: result.network, address: result.address },
          search: {},
        });
        break;
      case "pool":
        navigate({
          to: "/$network/pools/$address",
          params: { network: result.network, address: result.address },
          search: {},
        });
        break;
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative h-8 w-64 justify-start text-sm text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span>Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <CommandInput
          placeholder="Search addresses, tokens, names..."
          value={query}
          onValueChange={updateQuery}
        />
        <CommandList>
          <CommandEmpty>
            {isLoading ? "Searching..." : "No results found."}
          </CommandEmpty>
          {results && results.length > 0 && (
            <>
              {/* Group results by network */}
              {visibleNetworks
                .filter((n) => results.some((r) => r.network === n.slug))
                .map((network) => (
                  <CommandGroup key={network.slug} heading={network.name}>
                    {results
                      .filter((r) => r.network === network.slug)
                      .map((result) => (
                        <CommandItem
                          key={`${result.network}-${result.type}-${result.address}`}
                          onSelect={() => handleSelect(result)}
                          className="flex items-center gap-2"
                        >
                          <Badge variant="outline" className="text-xs">
                            {result.type}
                          </Badge>
                          <span className="font-mono text-xs">
                            {result.address.slice(0, 6)}...{result.address.slice(-4)}
                          </span>
                          {result.name && (
                            <span className="text-sm">{result.name}</span>
                          )}
                          {result.symbol && (
                            <span className="text-sm font-medium">{result.symbol}</span>
                          )}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                ))}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
