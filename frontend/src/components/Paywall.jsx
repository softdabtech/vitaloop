import { useNavigate } from 'react-router-dom'
import { stripePromise } from '../lib/stripe.js'

export default function Paywall() {
  const navigate = useNavigate()

  async function handleCheckout() {
    // Redirect to Stripe Checkout — replace with your price ID and backend endpoint
    const stripe = await stripePromise
    // TODO: call backend to create Stripe Checkout session and redirect
    alert('Stripe Checkout integration — add your backend /create-checkout-session endpoint.')
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
          className="bg-green-500 hover:bg-green-600 text-white font-semibold px-8 py-3 rounded-xl"
        >
          Start — $49/month
        </button>
      </div>
    </div>
  )
}
