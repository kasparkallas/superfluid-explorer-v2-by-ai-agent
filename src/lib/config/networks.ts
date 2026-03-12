export interface Network {
  chainId: number;
  slug: string;
  name: string;
  isTestnet: boolean;
  subgraphUrl: string;
  blockExplorerUrl: string;
}

export const DEFAULT_NETWORK = "base-mainnet";

export const allNetworks: Network[] = [
  // Mainnets
  {
    chainId: 1,
    slug: "ethereum-mainnet",
    name: "Ethereum",
    isTestnet: false,
    subgraphUrl: "https://subgraph-endpoints.superfluid.dev/ethereum-mainnet/protocol-v1",
    blockExplorerUrl: "https://etherscan.io",
  },
  {
    chainId: 8453,
    slug: "base-mainnet",
    name: "Base",
    isTestnet: false,
    subgraphUrl: "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1",
    blockExplorerUrl: "https://basescan.org",
  },
  {
    chainId: 137,
    slug: "polygon-mainnet",
    name: "Polygon",
    isTestnet: false,
    subgraphUrl: "https://subgraph-endpoints.superfluid.dev/polygon-mainnet/protocol-v1",
    blockExplorerUrl: "https://polygonscan.com",
  },
  {
    chainId: 10,
    slug: "optimism-mainnet",
    name: "Optimism",
    isTestnet: false,
    subgraphUrl: "https://subgraph-endpoints.superfluid.dev/optimism-mainnet/protocol-v1",
    blockExplorerUrl: "https://optimistic.etherscan.io",
  },
  {
    chainId: 42161,
    slug: "arbitrum-one",
    name: "Arbitrum One",
    isTestnet: false,
    subgraphUrl: "https://subgraph-endpoints.superfluid.dev/arbitrum-one/protocol-v1",
    blockExplorerUrl: "https://arbiscan.io",
  },
  {
    chainId: 100,
    slug: "gnosis-mainnet",
    name: "Gnosis Chain",
    isTestnet: false,
    subgraphUrl: "https://subgraph-endpoints.superfluid.dev/gnosis-mainnet/protocol-v1",
    blockExplorerUrl: "https://gnosisscan.io",
  },
  {
    chainId: 43114,
    slug: "avalanche-c",
    name: "Avalanche C-Chain",
    isTestnet: false,
    subgraphUrl: "https://subgraph-endpoints.superfluid.dev/avalanche-c/protocol-v1",
    blockExplorerUrl: "https://snowtrace.io",
  },
  {
    chainId: 56,
    slug: "bsc-mainnet",
    name: "BNB Smart Chain",
    isTestnet: false,
    subgraphUrl: "https://subgraph-endpoints.superfluid.dev/bsc-mainnet/protocol-v1",
    blockExplorerUrl: "https://bscscan.com",
  },
  {
    chainId: 42220,
    slug: "celo-mainnet",
    name: "Celo",
    isTestnet: false,
    subgraphUrl: "https://subgraph-endpoints.superfluid.dev/celo-mainnet/protocol-v1",
    blockExplorerUrl: "https://celoscan.io",
  },
  {
    chainId: 666666666,
    slug: "degenchain",
    name: "Degen Chain",
    isTestnet: false,
    subgraphUrl: "https://subgraph-endpoints.superfluid.dev/degenchain/protocol-v1",
    blockExplorerUrl: "https://explorer.degen.tips",
  },
  {
    chainId: 534352,
    slug: "scroll-mainnet",
    name: "Scroll",
    isTestnet: false,
    subgraphUrl: "https://subgraph-endpoints.superfluid.dev/scroll-mainnet/protocol-v1",
    blockExplorerUrl: "https://scrollscan.com",
  },
  // Testnets
  {
    chainId: 11155111,
    slug: "eth-sepolia",
    name: "Sepolia",
    isTestnet: true,
    subgraphUrl: "https://subgraph-endpoints.superfluid.dev/eth-sepolia/protocol-v1",
    blockExplorerUrl: "https://sepolia.etherscan.io",
  },
  {
    chainId: 11155420,
    slug: "optimism-sepolia",
    name: "Optimism Sepolia",
    isTestnet: true,
    subgraphUrl: "https://subgraph-endpoints.superfluid.dev/optimism-sepolia/protocol-v1",
    blockExplorerUrl: "https://sepolia-optimistic.etherscan.io",
  },
  {
    chainId: 84532,
    slug: "base-sepolia",
    name: "Base Sepolia",
    isTestnet: true,
    subgraphUrl: "https://subgraph-endpoints.superfluid.dev/base-sepolia/protocol-v1",
    blockExplorerUrl: "https://sepolia.basescan.org",
  },
  {
    chainId: 534351,
    slug: "scroll-sepolia",
    name: "Scroll Sepolia",
    isTestnet: true,
    subgraphUrl: "https://subgraph-endpoints.superfluid.dev/scroll-sepolia/protocol-v1",
    blockExplorerUrl: "https://sepolia.scrollscan.com",
  },
  {
    chainId: 43113,
    slug: "avalanche-fuji",
    name: "Avalanche Fuji",
    isTestnet: true,
    subgraphUrl: "https://subgraph-endpoints.superfluid.dev/avalanche-fuji/protocol-v1",
    blockExplorerUrl: "https://testnet.snowtrace.io",
  },
];

export const mainnetNetworks = allNetworks.filter((n) => !n.isTestnet);
export const testnetNetworks = allNetworks.filter((n) => n.isTestnet);

export type NetworkSlug = typeof allNetworks[number]["slug"];

export function getNetworkBySlug(slug: string): Network | undefined {
  return allNetworks.find((n) => n.slug === slug);
}

export function getNetworkByChainId(chainId: number): Network | undefined {
  return allNetworks.find((n) => n.chainId === chainId);
}

export function getSubgraphUrl(slug: string): string | undefined {
  return getNetworkBySlug(slug)?.subgraphUrl;
}
