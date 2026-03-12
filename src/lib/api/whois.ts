import { createServerFn } from "@tanstack/react-start";

// GOTCHA: naming is inverted! "resolve" takes an address, "reverse-resolve" takes a name
const BASE_URL = "https://whois.superfluid.finance/api";

interface WhoisServiceEntry {
  handle: string;
  avatarUrl?: string;
  address: string;
}

interface WhoisApiResponse {
  ENS?: WhoisServiceEntry | null;
  Farcaster?: WhoisServiceEntry | null;
  TOREX?: WhoisServiceEntry | null;
  recommendedName?: string;
  recommendedAvatar?: string;
  recommendedService?: string;
}

export interface WhoisResult {
  address: string;
  name?: string;
  avatar?: string;
}

function parseWhoisResponse(raw: WhoisApiResponse): WhoisResult | null {
  const address =
    raw.ENS?.address ?? raw.Farcaster?.address ?? raw.TOREX?.address;
  if (!address) return null;
  return {
    address,
    name: raw.recommendedName,
    avatar: raw.recommendedAvatar,
  };
}

export const resolveAddress = createServerFn({ method: "GET" })
  .inputValidator((address: string) => address)
  .handler(async ({ data: address }) => {
    try {
      const res = await fetch(`${BASE_URL}/resolve/${address}`);
      if (!res.ok) return null;
      const raw: WhoisApiResponse = await res.json();
      return parseWhoisResponse(raw);
    } catch {
      return null;
    }
  });

export const reverseResolveName = createServerFn({ method: "GET" })
  .inputValidator((name: string) => name)
  .handler(async ({ data: name }) => {
    try {
      const res = await fetch(`${BASE_URL}/reverse-resolve/${name}`);
      if (!res.ok) return null;
      const raw: WhoisApiResponse = await res.json();
      return parseWhoisResponse(raw);
    } catch {
      return null;
    }
  });
