import api from '../lib/api.js'
import toast from 'react-hot-toast'
import { useAppStore } from '../lib/store.js'
import { PREMIUM_PRICE_LABEL } from '../lib/pricing.js'
import { gaBeginCheckout } from '../lib/analytics.js'

const FEATURES = [
  '📈 Full biomarker progress charts',
  '💊 Detailed supplement protocol',
  '🛒 Personalized iHerb links',
  '📅 90-day retest reminders',
  '🔬 Unlimited lab uploads',
]

export default function LockedFeatureOverlay({ children, locked = true }) {
  const setShowPaywall = useAppStore((s) => s.setShowPaywall)

  if (!locked) return <>{children}</>

  async function handleCheckout() {
    const toastId = toast.loading('Opening checkout…')
    try {
      gaBeginCheckout()
      const { data } = await api.post('/stripe/checkout', { plan_id: 'personal' })
      toast.dismiss(toastId)
      window.location.href = data.checkout_url
    } catch (error) {
      toast.dismiss(toastId)
      const message = error?.response?.data?.detail || 'Could not start checkout. Please try again.'
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
          Subscribe for a complete AI-powered supplement protocol.
        </p>
        <ul className="text-sm text-gray-300 space-y-1.5 mb-5 text-left">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <span className="text-green-400">✓</span> {f}
            </li>
          ))}
        </ul>
        <button
          onClick={handleCheckout}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition"
        >
          Start — {PREMIUM_PRICE_LABEL}
        </button>
        <p className="text-gray-600 text-xs mt-3">Cancel anytime · Secure checkout via Stripe</p>
      </div>
    </div>
  )
}
