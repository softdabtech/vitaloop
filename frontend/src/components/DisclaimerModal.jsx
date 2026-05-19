import { useEffect } from 'react'
import { useAppStore } from '../lib/store.js'
import { trackFunnelEvent } from '../lib/funnel.js'

export default function DisclaimerModal() {
  const { disclaimerAccepted, acceptDisclaimer } = useAppStore()

  // Also listen for paywall events from api.js interceptor
  useEffect(() => {
    const handler = () => {
      useAppStore.getState().setShowPaywall(true)
      trackFunnelEvent('funnel_paywall_shown', 'Paywall shown after protected action', {}, { oncePerSession: true })
    }
    window.addEventListener('vitaloop:paywall', handler)
    return () => window.removeEventListener('vitaloop:paywall', handler)
  }, [])

  if (disclaimerAccepted) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="text-3xl mb-3">⚕️</div>
        <h2 className="text-lg font-bold text-white mb-2">Medical Disclaimer</h2>
        <p className="text-gray-400 text-sm leading-relaxed mb-5">
          <strong className="text-gray-200">VITALOOP is not a medical organization.</strong> This app uses AI
          to interpret lab results for <em>informational purposes only</em> — not as a diagnosis or
          treatment recommendation. Always consult a licensed healthcare professional before making
          decisions about your health or supplements.
        </p>
        <p className="text-gray-500 text-xs mb-5">
          By continuing, you agree to our{' '}
          <a href="/terms" className="text-green-400 hover:underline" target="_blank" rel="noreferrer">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy-policy" className="text-green-400 hover:underline" target="_blank" rel="noreferrer">Privacy Policy</a>.
        </p>
        <button
          onClick={acceptDisclaimer}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition"
        >
          I understand — Continue
        </button>
      </div>
    </div>
  )
}
