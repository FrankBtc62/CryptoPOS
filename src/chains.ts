/**
 * CryptoPOS — supported chains & USDC facts
 * All chain IDs and USDC addresses come from @/onchain-facts where available.
 * Robinhood Testnet has no USDC yet — future-proofed with undefined guard.
 */

import { getUsdc, requireChain } from '@/onchain-facts'

// Chain IDs
export const ARC_TESTNET_ID = 5042002
export const BASE_SEPOLIA_ID = 84532
export const ARB_SEPOLIA_ID = 421614
export const ROBINHOOD_TESTNET_ID = 46630

export interface SupportedChain {
  id: number
  name: string
  shortName: string
  explorerBase: string
  usdcAddress: `0x${string}` | undefined
  usdcDecimals: number
  nativeSymbol: string
  colorClass: string
}

function buildChain(
  id: number,
  shortName: string,
  colorClass: string,
  overrides?: {
    usdcAddress?: `0x${string}` | undefined
    usdcDecimals?: number
    explorerBase?: string
    nativeSymbol?: string
  }
): SupportedChain {
  let explorerBase: string
  let nativeSymbol: string
  try {
    const c = requireChain(id)
    explorerBase = overrides?.explorerBase ?? c.explorerBase
    nativeSymbol = overrides?.nativeSymbol ?? c.nativeCurrency.symbol
  } catch {
    explorerBase = overrides?.explorerBase ?? ''
    nativeSymbol = overrides?.nativeSymbol ?? 'ETH'
  }

  const usdc = getUsdc(id)
  const usdcAddress: `0x${string}` | undefined =
    overrides && 'usdcAddress' in overrides
      ? overrides.usdcAddress
      : (usdc?.address as `0x${string}` | undefined)

  const usdcDecimals = overrides?.usdcDecimals ?? usdc?.decimals ?? 6

  const chain = (() => {
    try {
      return requireChain(id)
    } catch {
      return null
    }
  })()
  const name = chain?.name ?? shortName

  return { id, name, shortName, explorerBase, usdcAddress, usdcDecimals, nativeSymbol, colorClass }
}

export const SUPPORTED_CHAINS: SupportedChain[] = [
  buildChain(ARC_TESTNET_ID, 'Arc', 'bg-blue-600'),
  buildChain(BASE_SEPOLIA_ID, 'Base', 'bg-blue-500'),
  buildChain(ARB_SEPOLIA_ID, 'Arbitrum', 'bg-sky-600'),
  buildChain(ROBINHOOD_TESTNET_ID, 'Robinhood', 'bg-emerald-600', {
    explorerBase: 'https://explorer.testnet.chain.robinhood.com',
    nativeSymbol: 'ETH',
    usdcAddress: undefined, // No USDC on Robinhood Testnet yet; native ETH payments used
  }),
]

export const CHAIN_BY_ID = new Map(SUPPORTED_CHAINS.map((c) => [c.id, c]))

export function getChainInfo(chainId: number): SupportedChain | undefined {
  return CHAIN_BY_ID.get(chainId)
}

export function buildTxUrl(chainId: number, txHash: string): string {
  const chain = getChainInfo(chainId)
  if (!chain || !chain.explorerBase) return '#'
  return `${chain.explorerBase}/tx/${txHash}`
}

export function buildAddressUrl(chainId: number, address: string): string {
  const chain = getChainInfo(chainId)
  if (!chain || !chain.explorerBase) return '#'
  return `${chain.explorerBase}/address/${address}`
}

export const SUPPORTED_CHAIN_IDS = SUPPORTED_CHAINS.map((c) => c.id)
