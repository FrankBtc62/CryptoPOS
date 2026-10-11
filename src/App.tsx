import { useState } from 'react'
import { QrCode, TrendingUp } from 'lucide-react'
import PaymentPOS from './components/PaymentPOS'
import EarningsDashboard from './components/EarningsDashboard'
import type { PaymentRecord } from './components/PaymentPOS'

type Tab = 'pos' | 'earnings'

export default function App() {
  const [tab, setTab] = useState<Tab>('pos')
  const [payments, setPayments] = useState<PaymentRecord[]>([])

  const handlePaymentReceived = (record: PaymentRecord) => {
    setPayments((prev) => [record, ...prev])
  }

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
      {/* Tab content */}
      {tab === 'pos' ? (
        <PaymentPOS
          payments={payments}
          onPaymentReceived={handlePaymentReceived}
        />
      ) : (
        <div className="min-h-dvh pt-8">
          <div className="mx-auto max-w-md px-4">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'var(--accent)' }}>
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <span className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>Earnings Analytics</span>
            </div>
          </div>
          <EarningsDashboard payments={payments} />
        </div>
      )}

      {/* Bottom tab bar */}
      <div
        className="fixed bottom-0 left-0 right-0 flex items-center justify-center pb-safe"
        style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderTop: '1px solid rgba(18,45,69,0.10)',
        }}
      >
        <div className="flex w-full max-w-md">
          <TabButton
            icon={<QrCode className="h-5 w-5" />}
            label="POS"
            active={tab === 'pos'}
            onClick={() => setTab('pos')}
          />
          <TabButton
            icon={<TrendingUp className="h-5 w-5" />}
            label="Earnings"
            active={tab === 'earnings'}
            onClick={() => setTab('earnings')}
          />
        </div>
      </div>

      {/* Spacer so content doesn't hide behind tab bar */}
      <div className="h-20" />
    </div>
  )
}

function TabButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors"
      style={{ color: active ? 'var(--accent)' : 'var(--subtle)' }}
    >
      {icon}
      {label}
    </button>
  )
}
