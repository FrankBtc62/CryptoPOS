import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { TrendingUp, Calendar, CalendarDays, CalendarRange } from 'lucide-react'
import { getChainInfo, SUPPORTED_CHAINS } from '@/chains'
import type { PaymentRecord } from './PaymentPOS'

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

function sumUsdc(payments: PaymentRecord[], from: number): number {
  return payments
    .filter((p) => p.timestamp >= from && !p.isNative)
    .reduce((acc, p) => {
      const dec = getChainInfo(p.chainId)?.usdcDecimals ?? 6
      return acc + Number(formatUnits(p.amount, dec))
    }, 0)
}

function countPayments(payments: PaymentRecord[], from: number): number {
  return payments.filter((p) => p.timestamp >= from).length
}

function startOf(unit: 'day' | 'week' | 'month' | 'year'): number {
  const d = new Date()
  if (unit === 'day') {
    d.setHours(0, 0, 0, 0)
  } else if (unit === 'week') {
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
  } else if (unit === 'month') {
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
  } else {
    d.setMonth(0, 1)
    d.setHours(0, 0, 0, 0)
  }
  return d.getTime()
}

interface StatCardProps {
  label: string
  amount: string
  count: number
  icon: React.ReactNode
  accent?: boolean
}

function StatCard({ label, amount, count, icon, accent }: StatCardProps) {
  return (
    <div
      className="rounded-2xl p-4"
      style={accent ? { background: 'var(--accent)', border: '1px solid transparent' } : glass.inner}
    >
      <div className="mb-2 flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={accent ? { background: 'rgba(255,255,255,0.18)' } : { background: 'rgba(18,45,69,0.08)' }}
        >
          {icon}
        </div>
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: accent ? 'rgba(255,255,255,0.7)' : 'var(--muted)' }}
        >
          {label}
        </span>
      </div>
      <div
        className="display text-2xl font-bold tabular-nums"
        style={{ color: accent ? '#fff' : 'var(--ink)' }}
      >
        {amount}
        <span
          className="ml-1 text-sm font-medium"
          style={{ color: accent ? 'rgba(255,255,255,0.65)' : 'var(--subtle)' }}
        >
          USDC
        </span>
      </div>
      <div className="mt-1 text-xs" style={{ color: accent ? 'rgba(255,255,255,0.55)' : 'var(--subtle)' }}>
        {count} {count === 1 ? 'payment' : 'payments'}
      </div>
    </div>
  )
}

// Compute day boundaries outside components to avoid impure-function lint
function getDayBoundaries(): { start: number; end: number; label: string }[] {
  const now = Date.now()
  return Array.from({ length: 7 }, (_, idx) => {
    const offset = 6 - idx
    const base = new Date(now - offset * 86_400_000)
    base.setHours(0, 0, 0, 0)
    return { start: base.getTime(), end: base.getTime() + 86_400_000, label: base.toLocaleDateString('en-US', { weekday: 'short' }) }
  })
}

interface EarningsDashboardProps {
  payments: PaymentRecord[]
}

export default function EarningsDashboard({ payments }: EarningsDashboardProps) {
  const stats = useMemo(() => ({
    daily: { amount: sumUsdc(payments, startOf('day')).toFixed(2), count: countPayments(payments, startOf('day')) },
    weekly: { amount: sumUsdc(payments, startOf('week')).toFixed(2), count: countPayments(payments, startOf('week')) },
    monthly: { amount: sumUsdc(payments, startOf('month')).toFixed(2), count: countPayments(payments, startOf('month')) },
    yearly: { amount: sumUsdc(payments, startOf('year')).toFixed(2), count: countPayments(payments, startOf('year')) },
  }), [payments])

  const dayBoundaries = getDayBoundaries()

  const barData = useMemo(
    () =>
      dayBoundaries.map(({ start, end, label }) => {
        const total = payments
          .filter((p) => p.timestamp >= start && p.timestamp < end && !p.isNative)
          .reduce((acc, p) => {
            const dec = getChainInfo(p.chainId)?.usdcDecimals ?? 6
            return acc + Number(formatUnits(p.amount, dec))
          }, 0)
        return { label, amount: total }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments],
  )

  const maxBar = Math.max(...barData.map((d) => d.amount), 0.01)

  // Per-chain breakdown
  const chainBreakdown = useMemo(
    () =>
      SUPPORTED_CHAINS.map((chain) => {
        const chainPayments = payments.filter((p) => p.chainId === chain.id)
        const total = chainPayments.reduce((acc, p) => {
          const dec = p.isNative ? 18 : (chain.usdcDecimals ?? 6)
          return acc + Number(formatUnits(p.amount, dec))
        }, 0)
        return { chain, total, count: chainPayments.length }
      }).filter((x) => x.count > 0),
    [payments],
  )

  if (payments.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 pb-10">
        <div className="rounded-3xl p-8 text-center" style={glass.card}>
          <TrendingUp className="mx-auto mb-3 h-10 w-10 opacity-20" style={{ color: 'var(--ink)' }} />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            No payments yet. Create your first QR payment request.
          </p>
        </div>
      </div>
    )
  }

  const totalUsdc = payments
    .filter((p) => !p.isNative)
    .reduce((acc, p) => acc + Number(formatUnits(p.amount, getChainInfo(p.chainId)?.usdcDecimals ?? 6)), 0)

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 pb-10">
      <div className="flex items-center gap-2 px-1 pt-2">
        <TrendingUp className="h-4 w-4" style={{ color: 'var(--accent)' }} />
        <h2 className="display text-base font-bold" style={{ color: 'var(--ink)' }}>Earnings Overview</h2>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Today" amount={stats.daily.amount} count={stats.daily.count}
          icon={<TrendingUp className="h-3.5 w-3.5 text-white" />} accent />
        <StatCard label="This Week" amount={stats.weekly.amount} count={stats.weekly.count}
          icon={<CalendarDays className="h-3.5 w-3.5" style={{ color: 'var(--muted)' }} />} />
        <StatCard label="This Month" amount={stats.monthly.amount} count={stats.monthly.count}
          icon={<Calendar className="h-3.5 w-3.5" style={{ color: 'var(--muted)' }} />} />
        <StatCard label="This Year" amount={stats.yearly.amount} count={stats.yearly.count}
          icon={<CalendarRange className="h-3.5 w-3.5" style={{ color: 'var(--muted)' }} />} />
      </div>

      {/* 7-day bar chart */}
      <div className="rounded-3xl p-5" style={glass.card}>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Last 7 Days</span>
          <span className="text-xs" style={{ color: 'var(--subtle)' }}>USDC</span>
        </div>
        <div className="flex items-end gap-1.5" style={{ height: 80 }}>
          {barData.map((d, i) => {
            const h = (d.amount / maxBar) * 100
            const isToday = i === 6
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="relative w-full flex items-end" style={{ height: 64 }}>
                  <div
                    className="w-full rounded-t-lg transition-all duration-500"
                    style={{
                      height: `${Math.max(h, d.amount > 0 ? 6 : 0)}%`,
                      minHeight: d.amount > 0 ? 4 : 0,
                      background: isToday ? 'var(--accent)' : 'rgba(18,45,69,0.15)',
                    }}
                  />
                </div>
                <span className="text-xs" style={{ color: isToday ? 'var(--accent)' : 'var(--subtle)', fontWeight: isToday ? 700 : 400 }}>
                  {d.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Per-chain breakdown */}
      {chainBreakdown.length > 1 && (
        <div className="rounded-3xl p-5" style={glass.card}>
          <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--ink)' }}>By Network</h3>
          <div className="space-y-2">
            {chainBreakdown.map(({ chain, total, count }) => (
              <div key={chain.id} className="flex items-center justify-between rounded-xl px-3 py-2" style={glass.inner}>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${chain.colorClass}`} />
                  <span className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>{chain.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                    {total.toFixed(chain.usdcAddress ? 2 : 6)} {chain.usdcAddress ? 'USDC' : chain.nativeSymbol}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--subtle)' }}>{count} tx</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All-time total */}
      <div className="rounded-2xl px-5 py-4" style={{ background: 'rgba(18,45,69,0.04)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            All-Time Revenue
          </span>
          <div className="flex items-baseline gap-1">
            <span className="display text-xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {totalUsdc.toFixed(2)}
            </span>
            <span className="text-sm font-medium" style={{ color: 'var(--subtle)' }}>USDC</span>
            <span className="ml-1 text-xs" style={{ color: 'var(--subtle)' }}>· {payments.length} tx</span>
          </div>
        </div>
      </div>
    </div>
  )
}
