import toast from 'react-hot-toast'
import { useAppStore } from '../lib/store.js'
import { PREMIUM_PRICE_LABEL } from '../lib/pricing.js'
import { useAuth } from '../hooks/useAuth.js'
import { requestPremiumAccess } from '../lib/premiumAccess.js'

const FEATURES = [
  '📈 Full biomarker progress charts',
  '📋 Personal action plans',
  '🔁 Follow-up check-ins',
  '📅 90-day retest reminders',
  '🔬 Unlimited lab uploads',
]

export default function LockedFeatureOverlay({ children, locked = true }) {
  const setShowPaywall = useAppStore((s) => s.setShowPaywall)
  const { user } = useAuth()

  if (!locked) return <>{children}</>

  async function handlePremiumRequest() {
    const toastId = toast.loading('Preparing Premium access email…')
    try {
      await requestPremiumAccess({ userEmail: user?.email, source: 'locked_feature' })
      toast.dismiss(toastId)
    } catch (error) {
      toast.dismiss(toastId)
      const message = 'Please contact info@softdab.tech to activate Premium.'
      toast.error(message)
    }
    setShowPaywall(false)
  }

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm opacity-30 saturate-0">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/85 rounded-2xl p-6 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h3 className="text-white font-bold text-lg mb-1">Unlock Full Access</h3>
        <p className="text-gray-400 text-sm mb-4">
          Subscribe for deeper tracking, action plans, and follow-up guidance.
        </p>
        <ul className="text-sm text-gray-300 space-y-1.5 mb-5 text-left">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <span className="text-green-400">✓</span> {f}
            </li>
          ))}
        </ul>
        <button
          onClick={handlePremiumRequest}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition"
        >
          Continue — {PREMIUM_PRICE_LABEL}
        </button>
        <p className="text-gray-600 text-xs mt-3">Premium access is activated manually.</p>
      </div>
    </div>
  )
}
