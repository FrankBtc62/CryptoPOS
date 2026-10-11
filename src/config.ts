/**
 * wagmi configuration — CryptoPOS
 * Chains: Arc Testnet, Base Sepolia, Arbitrum Sepolia, Robinhood Chain Testnet
 */

import { http, createConfig } from 'wagmi'
import { mainnet, baseSepolia, arbitrumSepolia } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import { defineChain } from 'viem'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'

// Robinhood Chain Testnet (chain ID 46630)
export const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.chain.robinhood.com'] },
  },
  blockExplorers: {
    default: {
      name: 'Robinhood Explorer',
      url: 'https://explorer.testnet.chain.robinhood.com',
    },
  },
  testnet: true,
})

// Pre-register chains for trace event labels
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])
registerChain(baseSepolia.id, baseSepolia.rpcUrls.default.http[0])
registerChain(arbitrumSepolia.id, arbitrumSepolia.rpcUrls.default.http[0])
registerChain(robinhoodTestnet.id, robinhoodTestnet.rpcUrls.default.http[0])

export const config = createConfig({
  chains: [arcTestnet, baseSepolia, arbitrumSepolia, robinhoodTestnet, mainnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(),
    [baseSepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
    [robinhoodTestnet.id]: http(),
    [mainnet.id]: http(), // ENS resolution
  },
})
