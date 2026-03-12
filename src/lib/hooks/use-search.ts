import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { isValidAddress } from "~/lib/utils/address";

export type SearchInputType = "address" | "name" | "symbol" | "unknown";

/**
 * Detect what type of search input the user has entered.
 */
export function detectSearchInputType(input: string): SearchInputType {
  const trimmed = input.trim();
  if (!trimmed) return "unknown";

  // Ethereum address: starts with 0x and has 40 hex chars
  if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return "address";

  // Name: contains a dot (ENS, Lens, etc.)
  if (trimmed.includes(".")) return "name";

  // Symbol: 3+ alphanumeric characters
  if (/^[a-zA-Z0-9]{3,}$/.test(trimmed)) return "symbol";

  // Fallback to symbol search for anything else
  if (trimmed.length >= 3) return "symbol";

  return "unknown";
}

interface SearchResult {
  type: "account" | "token" | "pool";
  network: string;
  networkName: string;
  address: string;
  name?: string;
  symbol?: string;
  logoUrl?: string;
}

/**
 * Debounced search state management.
 */
export function useSearchState() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const inputType = useMemo(() => detectSearchInputType(debouncedQuery), [debouncedQuery]);

  const updateQuery = useCallback((value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, 250);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
  }, []);

  return {
    query,
    debouncedQuery,
    inputType,
    updateQuery,
    reset,
  };
}

export type { SearchResult };
