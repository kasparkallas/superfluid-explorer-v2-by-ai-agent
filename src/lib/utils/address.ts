import { getAddress, isAddress } from "viem";

/**
 * Validate and checksum an Ethereum address.
 */
export function checksumAddress(address: string): string {
  try {
    return getAddress(address);
  } catch {
    return address;
  }
}

/**
 * Check if a string is a valid Ethereum address.
 */
export function isValidAddress(value: string): boolean {
  return isAddress(value);
}

/**
 * Truncate an address for display: 0x1234...5678
 */
export function truncateAddress(address: string, chars: number = 4): string {
  if (address.length < chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Zero address constant.
 */
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
