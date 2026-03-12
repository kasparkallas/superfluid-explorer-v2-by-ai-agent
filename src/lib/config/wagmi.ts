import { createConfig, http } from "wagmi";
import {
  mainnet,
  base,
  polygon,
  optimism,
  arbitrum,
  gnosis,
  avalanche,
  bsc,
  celo,
  scroll,
  sepolia,
  optimismSepolia,
  baseSepolia,
  scrollSepolia,
  avalancheFuji,
} from "viem/chains";
import { defineChain } from "viem";

// Define custom chain for Degen Chain (not in viem/chains)
const degen = defineChain({
  id: 666666666,
  name: "Degen Chain",
  nativeCurrency: { name: "DEGEN", symbol: "DEGEN", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.degen.tips"] } },
  blockExplorers: {
    default: { name: "Degen Explorer", url: "https://explorer.degen.tips" },
  },
});

export const wagmiConfig = createConfig({
  chains: [
    // Mainnets
    mainnet,
    base,
    polygon,
    optimism,
    arbitrum,
    gnosis,
    avalanche,
    bsc,
    celo,
    degen,
    scroll,
    // Testnets
    sepolia,
    optimismSepolia,
    baseSepolia,
    scrollSepolia,
    avalancheFuji,
  ],
  transports: {
    // Mainnets
    [mainnet.id]: http(),
    [base.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
    [gnosis.id]: http(),
    [avalanche.id]: http(),
    [bsc.id]: http(),
    [celo.id]: http(),
    [degen.id]: http(),
    [scroll.id]: http(),
    // Testnets
    [sepolia.id]: http(),
    [optimismSepolia.id]: http(),
    [baseSepolia.id]: http(),
    [scrollSepolia.id]: http(),
    [avalancheFuji.id]: http(),
  },
});
