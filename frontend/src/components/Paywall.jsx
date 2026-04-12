import { useState } from 'react'
import api from '../lib/api.js'
import toast from 'react-hot-toast'

export default function Paywall() {
  const [loading, setLoading] = useState(false)

  async function handleCheckout() {
    setLoading(true)
    try {
      const { data } = await api.post('/stripe/checkout')
      window.location.href = data.checkout_url
    } catch {
      toast.error('Could not start checkout. Please try again.')
      setLoading(false)
    }
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
        <p className="text-white font-bold text-lg mb-1">Unlock Your Protocol</p>
        <p className="text-gray-400 text-sm mb-4">Subscribe to see your personalized supplement stack</p>
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold px-8 py-3 rounded-xl transition"
        >
          {loading ? 'Redirecting…' : 'Start — $49/month'}
        </button>
      </div>
    </div>
  )
}
