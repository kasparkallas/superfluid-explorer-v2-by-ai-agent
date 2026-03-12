import { useParams } from "@tanstack/react-router";
import { getNetworkBySlug, type Network } from "~/lib/config/networks";

/**
 * Get the current network from route params.
 * Returns undefined if the network slug is invalid.
 */
export function useNetwork(): Network | undefined {
  const { network } = useParams({ strict: false }) as { network?: string };
  if (!network) return undefined;
  return getNetworkBySlug(network);
}
