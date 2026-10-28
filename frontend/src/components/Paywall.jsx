import { useNavigate } from 'react-router-dom'
import { PREMIUM_PRICE_LABEL } from '../lib/pricing.js'

export default function Paywall() {
  const navigate = useNavigate()

  function handlePremiumRequest() {
    navigate('/subscription')
  }

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm opacity-40">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-gray-700 rounded-xl p-4 bg-gray-800 h-24" />
          ))}
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/80 rounded-xl">
        <p className="text-white font-bold text-lg mb-1">Unlock Your Action Plan</p>
        <p className="text-gray-400 text-sm mb-4">Subscribe to see priorities, trends, and follow-up guidance.</p>
        <button
          onClick={handlePremiumRequest}
          className="bg-green-500 hover:bg-green-600 text-white font-semibold px-8 py-3 rounded-xl transition"
        >
          {`Choose Premium — ${PREMIUM_PRICE_LABEL}`}
        </button>
      </div>
    </div>
  )
}
