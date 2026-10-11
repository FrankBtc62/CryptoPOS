import { useState, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  useAccount,
  useReadContract,
  useWatchContractEvent,
  useBalance,
  useSwitchChain,
} from 'wagmi'
import { erc20Abi, parseUnits, formatUnits } from 'viem'
import { ConnectKitButton } from 'connectkit'
import { motion, AnimatePresence } from 'framer-motion'
import {
  QrCode,
  CheckCircle2,
  Copy,
  ExternalLink,
  Wallet,
  ArrowDownLeft,
  RefreshCw,
  Share2,
  ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  SUPPORTED_CHAINS,
  SUPPORTED_CHAIN_IDS,
  getChainInfo,
  buildTxUrl,
  type SupportedChain,
} from '@/chains'

export interface PaymentRecord {
  from: string
  amount: bigint
  txHash: string
  timestamp: number
  chainId: number
  isNative: boolean
}

interface PaymentPOSProps {
  onPaymentReceived: (record: PaymentRecord) => void
  payments: PaymentRecord[]
}

const glass = {
  card: {
    background: 'rgba(255,255,255,0.72)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(18,45,69,0.10)',
    boxShadow: '0 4px 32px rgba(18,45,69,0.07)',
  } as React.CSSProperties,
  inner: {
    background: 'rgba(255,255,255,0.55)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(18,45,69,0.08)',
  } as React.CSSProperties,
}

const formatAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

const QUICK_AMOUNTS = ['1', '5', '10', '25', '50', '100']

export default function PaymentPOS({ onPaymentReceived, payments }: PaymentPOSProps) {
  const { address, isConnected, chainId: walletChainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [qrVisible, setQrVisible] = useState(false)
  const [lastPayment, setLastPayment] = useState<PaymentRecord | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [chainMenuOpen, setChainMenuOpen] = useState(false)
  const [selectedChainId, setSelectedChainId] = useState<number>(SUPPORTED_CHAIN_IDS[0])

  const selectedChain: SupportedChain | undefined = getChainInfo(selectedChainId)
  const isUsdcChain = !!selectedChain?.usdcAddress
  const payToken = isUsdcChain ? 'USDC' : selectedChain?.nativeSymbol ?? 'ETH'

  const wrongChain = isConnected && walletChainId !== selectedChainId

  // USDC balance (ERC-20) — only for USDC chains
  const { data: rawUsdcBalance, refetch: refetchUsdc } = useReadContract({
    address: selectedChain?.usdcAddress ?? '0x0000000000000000000000000000000000000000',
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: selectedChainId,
    query: { enabled: !!address && isUsdcChain },
  })

  // Native balance — for Robinhood (no USDC) or as fallback
  const { data: nativeBalance, refetch: refetchNative } = useBalance({
    address,
    chainId: selectedChainId,
    query: { enabled: !!address && !isUsdcChain },
  })

  const formattedBalance = isUsdcChain
    ? rawUsdcBalance != null
      ? Number(formatUnits(rawUsdcBalance, selectedChain.usdcDecimals)).toFixed(2)
      : '—'
    : nativeBalance
    ? Number(nativeBalance.formatted).toFixed(4)
    : '—'

  const refetchBalance = () => {
    void (isUsdcChain ? refetchUsdc() : refetchNative())
  }

  // Watch incoming USDC transfers on USDC chains
  useWatchContractEvent({
    address: selectedChain?.usdcAddress ?? '0x0000000000000000000000000000000000000000',
    abi: erc20Abi,
    eventName: 'Transfer',
    chainId: selectedChainId,
    onLogs: (logs) => {
      if (!address || !isUsdcChain) return
      for (const log of logs) {
        const args = log.args as { from?: string; to?: string; value?: bigint }
        if (
          args.to?.toLowerCase() === address.toLowerCase() &&
          args.value &&
          args.value > 0n
        ) {
          const record: PaymentRecord = {
            from: args.from ?? 'unknown',
            amount: args.value,
            txHash: log.transactionHash ?? '',
            timestamp: Date.now(),
            chainId: selectedChainId,
            isNative: false,
          }
          setLastPayment(record)
          setShowSuccess(true)
          onPaymentReceived(record)
          void refetchUsdc()
          setTimeout(() => setShowSuccess(false), 6000)
        }
      }
    },
    enabled: !!address && isConnected && isUsdcChain,
  })

  // Build EIP-681 payment URI
  const buildPaymentUri = useCallback(() => {
    if (!address) return ''
    const decimals = isUsdcChain ? (selectedChain?.usdcDecimals ?? 6) : 18
    const parsedAmount = amount ? parseUnits(amount, decimals) : 0n
    if (isUsdcChain && selectedChain?.usdcAddress) {
      let uri = `ethereum:${selectedChain.usdcAddress}@${selectedChainId}/transfer?address=${address}&uint256=${parsedAmount}`
      if (memo) uri += `&memo=${encodeURIComponent(memo)}`
      return uri
    }
    // Native ETH payment URI
    let uri = `ethereum:${address}@${selectedChainId}?value=${parsedAmount}`
    if (memo) uri += `&memo=${encodeURIComponent(memo)}`
    return uri
  }, [address, amount, memo, selectedChainId, selectedChain, isUsdcChain])

  const generateQR = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    setQrVisible(true)
  }

  const resetQR = () => {
    setQrVisible(false)
    setAmount('')
    setMemo('')
  }

  const copyAddress = () => {
    if (!address) return
    void navigator.clipboard.writeText(address)
    toast.success('Wallet address copied')
  }

  const copyQRLink = () => {
    void navigator.clipboard.writeText(buildPaymentUri())
    toast.success('Payment link copied')
  }

  const shareQR = async () => {
    const uri = buildPaymentUri()
    if (navigator.share) {
      await navigator.share({ title: 'CryptoPOS Payment', text: uri })
    } else {
      copyQRLink()
    }
  }

  const handleChainSelect = (id: number) => {
    setSelectedChainId(id)
    setChainMenuOpen(false)
    setQrVisible(false)
    setAmount('')
    setMemo('')
    if (isConnected && walletChainId !== id) {
      switchChain({ chainId: id })
    }
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-3xl p-8 text-center" style={glass.card}>
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--accent)' }}>
              <QrCode className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="display mb-2 text-2xl font-bold" style={{ color: 'var(--ink)' }}>CryptoPOS</h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--muted)' }}>
            Accept USDC payments instantly on multiple chains
          </p>
          <ConnectKitButton />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh px-4 py-8">
      <div className="mx-auto max-w-md space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'var(--accent)' }}>
              <QrCode className="h-4 w-4 text-white" />
            </div>
            <span className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>CryptoPOS</span>
          </div>
          <ConnectKitButton />
        </div>

        {/* Chain selector */}
        <div className="relative">
          <button
            onClick={() => setChainMenuOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition-all hover:scale-[1.01]"
            style={glass.inner}
          >
            <div className="flex items-center gap-2.5">
              <span className={`inline-flex h-2.5 w-2.5 rounded-full ${selectedChain?.colorClass ?? 'bg-slate-400'}`} />
              <span style={{ color: 'var(--ink)' }}>{selectedChain?.name ?? 'Select Network'}</span>
              {wrongChain && (
                <span className="rounded-md px-1.5 py-0.5 text-xs font-semibold" style={{ background: 'rgba(186,43,76,0.10)', color: 'var(--danger)' }}>
                  Switch needed
                </span>
              )}
            </div>
            <ChevronDown className="h-4 w-4" style={{ color: 'var(--subtle)' }} />
          </button>

          <AnimatePresence>
            {chainMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(24px)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(18,45,69,0.12)' }}
              >
                {SUPPORTED_CHAINS.map((chain) => (
                  <button
                    key={chain.id}
                    onClick={() => handleChainSelect(chain.id)}
                    disabled={isSwitching}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
                    style={{ color: chain.id === selectedChainId ? 'var(--accent)' : 'var(--ink-2)' }}
                  >
                    <span className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${chain.colorClass}`} />
                    <span className="font-medium">{chain.name}</span>
                    {!chain.usdcAddress && (
                      <span className="ml-auto text-xs" style={{ color: 'var(--subtle)' }}>Native ETH</span>
                    )}
                    {chain.id === selectedChainId && (
                      <CheckCircle2 className="ml-auto h-4 w-4" style={{ color: 'var(--success)' }} />
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Switch chain CTA */}
        {wrongChain && (
          <button
            onClick={() => switchChain({ chainId: selectedChainId })}
            disabled={isSwitching}
            className="w-full rounded-2xl py-2.5 text-sm font-semibold transition-all hover:scale-[1.01] disabled:opacity-50"
            style={{ background: 'rgba(186,43,76,0.08)', color: 'var(--danger)', border: '1px solid rgba(186,43,76,0.20)' }}
          >
            {isSwitching ? 'Switching...' : `Switch wallet to ${selectedChain?.name}`}
          </button>
        )}

        {/* Balance card */}
        <div className="rounded-3xl p-5" style={glass.card}>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
              Wallet Balance
            </span>
            <button
              onClick={refetchBalance}
              className="rounded-lg p-1 transition-opacity hover:opacity-70"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" style={{ color: 'var(--subtle)' }} />
            </button>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="display text-4xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {formattedBalance}
            </span>
            <span className="text-lg font-medium" style={{ color: 'var(--subtle)' }}>{payToken}</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Wallet className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--muted)' }} />
            <span className="mono text-xs truncate" style={{ color: 'var(--muted)' }}>{address}</span>
            <button onClick={copyAddress} className="shrink-0 transition-opacity hover:opacity-70">
              <Copy className="h-3.5 w-3.5" style={{ color: 'var(--subtle)' }} />
            </button>
          </div>
        </div>

        {/* Success notification */}
        <AnimatePresence>
          {showSuccess && lastPayment && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="rounded-2xl p-4"
              style={{ background: 'rgba(26,128,71,0.08)', border: '1px solid rgba(26,128,71,0.22)' }}
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--success)' }} />
                <div className="min-w-0">
                  <div className="font-semibold" style={{ color: 'var(--success)' }}>Payment Received!</div>
                  <div className="mt-0.5 text-sm" style={{ color: 'var(--ink-2)' }}>
                    <span className="font-bold">
                      {Number(formatUnits(lastPayment.amount, getChainInfo(lastPayment.chainId)?.usdcDecimals ?? 6)).toFixed(2)} {lastPayment.isNative ? getChainInfo(lastPayment.chainId)?.nativeSymbol : 'USDC'}
                    </span>{' '}
                    · {formatAddr(lastPayment.from)}
                  </div>
                  {lastPayment.txHash && (
                    <a
                      href={buildTxUrl(lastPayment.chainId, lastPayment.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs"
                      style={{ color: 'var(--accent-hover)' }}
                    >
                      View on Explorer <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* QR / Amount panel */}
        <div className="rounded-3xl p-5" style={glass.card}>
          <AnimatePresence mode="wait">
            {!qrVisible ? (
              <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <h2 className="display text-base font-semibold" style={{ color: 'var(--ink)' }}>
                  Create Payment Request
                </h2>

                {/* Quick amounts */}
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_AMOUNTS.map((q) => (
                    <button
                      key={q}
                      onClick={() => setAmount(q)}
                      className="rounded-xl py-2 text-sm font-semibold transition-all hover:scale-[1.03] active:scale-[0.98]"
                      style={
                        amount === q
                          ? { background: 'var(--accent)', color: '#fff' }
                          : { background: 'var(--surface-muted)', color: 'var(--ink-2)' }
                      }
                    >
                      {isUsdcChain ? '$' : ''}{q} {payToken}
                    </button>
                  ))}
                </div>

                {/* Custom amount */}
                <div className="rounded-2xl p-4" style={glass.inner}>
                  <div className="flex items-center gap-2">
                    {isUsdcChain && <span className="text-lg font-semibold" style={{ color: 'var(--subtle)' }}>$</span>}
                    <input
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9.]/g, '')
                        if (v === '' || /^\d*\.?\d{0,6}$/.test(v)) setAmount(v)
                      }}
                      placeholder="0.00"
                      className="display w-full bg-transparent text-3xl font-bold tabular-nums outline-none placeholder:text-slate-300"
                      style={{ color: 'var(--ink)' }}
                    />
                    <span className="text-sm font-medium shrink-0" style={{ color: 'var(--subtle)' }}>{payToken}</span>
                  </div>
                </div>

                {/* Memo */}
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ background: 'var(--surface-muted)', color: 'var(--ink)', border: '1px solid var(--border)' }}
                />

                <button
                  onClick={generateQR}
                  disabled={!amount || parseFloat(amount) <= 0}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: 'var(--accent)' }}
                >
                  <QrCode className="h-4 w-4" />
                  Generate QR Code
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="qr"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="h-1 w-full rounded-full" style={{ background: 'linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899,#f59e0b,#10b981)' }} />

                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className={`inline-flex h-2 w-2 rounded-full ${selectedChain?.colorClass}`} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{selectedChain?.name}</span>
                  </div>
                  <div className="display text-3xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                    {Number(amount).toFixed(isUsdcChain ? 2 : 6)} {payToken}
                  </div>
                  {memo && <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{memo}</div>}
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <QRCodeSVG value={buildPaymentUri()} size={200} level="M" includeMargin={false} />
                </div>

                <p className="text-center text-xs" style={{ color: 'var(--muted)' }}>
                  Customer scans to pay on {selectedChain?.name}
                </p>

                <div className="w-full rounded-xl px-3 py-2" style={glass.inner}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="mono text-xs truncate" style={{ color: 'var(--muted)' }}>{address}</span>
                    <button onClick={copyAddress}>
                      <Copy className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--subtle)' }} />
                    </button>
                  </div>
                </div>

                <div className="flex w-full gap-2">
                  <button
                    onClick={() => { void shareQR() }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-all hover:scale-[1.01]"
                    style={{ background: 'var(--surface-muted)', color: 'var(--ink-2)' }}
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>
                  <button
                    onClick={resetQR}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white transition-all hover:scale-[1.01]"
                    style={{ background: 'var(--accent)' }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    New Payment
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recent payments */}
        {payments.length > 0 && (
          <div className="rounded-3xl p-5" style={glass.card}>
            <h2 className="display mb-3 text-base font-semibold" style={{ color: 'var(--ink)' }}>
              Recent Payments
            </h2>
            <div className="space-y-2">
              {payments.slice(0, 8).map((p, i) => {
                const chain = getChainInfo(p.chainId)
                const decimals = p.isNative ? 18 : (chain?.usdcDecimals ?? 6)
                const symbol = p.isNative ? (chain?.nativeSymbol ?? 'ETH') : 'USDC'
                return (
                  <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={glass.inner}>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(26,128,71,0.10)' }}>
                        <ArrowDownLeft className="h-4 w-4" style={{ color: 'var(--success)' }} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                          {Number(formatUnits(p.amount, decimals)).toFixed(decimals === 6 ? 2 : 6)} {symbol}
                        </div>
                        <div className="flex items-center gap-1">
                          {chain && <span className={`inline-flex h-1.5 w-1.5 rounded-full ${chain.colorClass}`} />}
                          <span className="mono text-xs" style={{ color: 'var(--muted)' }}>{formatAddr(p.from)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-xs" style={{ color: 'var(--subtle)' }}>
                        {new Date(p.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {p.txHash && (
                        <a
                          href={buildTxUrl(p.chainId, p.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-0.5 text-xs"
                          style={{ color: 'var(--accent-hover)' }}
                        >
                          Tx <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
