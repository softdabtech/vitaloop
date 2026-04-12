import { useNavigate } from 'react-router-dom'

export default function Privacy() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-gray-950 text-gray-300 px-4 py-12 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="text-green-400 text-sm mb-8 hover:underline">← Back</button>
      <h1 className="text-2xl font-bold text-white mb-6">Privacy Policy</h1>
      <p className="text-gray-500 text-sm mb-8">Last updated: April 2026</p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="text-white font-semibold mb-2">1. What we collect</h2>
          <p>We collect your email address (for authentication) and the <strong>extracted text</strong> from lab results you upload. We do <strong>not</strong> store original PDF files or images.</p>
        </div>
        <div>
          <h2 className="text-white font-semibold mb-2">2. How we use your data</h2>
          <p>Your lab data is used solely to generate biomarker analysis and supplement protocols using AI. We never sell, rent, or share your personal data with third parties, except as required by law.</p>
        </div>
        <div>
          <h2 className="text-white font-semibold mb-2">3. Data storage & security</h2>
          <p>Data is stored in Supabase (PostgreSQL) with row-level security — only you can access your records. All data is encrypted in transit (TLS 1.2+) and at rest.</p>
        </div>
        <div>
          <h2 className="text-white font-semibold mb-2">4. AI processing</h2>
          <p>Lab text is sent to Anthropic's Claude API for analysis. Prompts are designed to minimize personal identifiers. We do not use your data to train AI models.</p>
        </div>
        <div>
          <h2 className="text-white font-semibold mb-2">5. Payments</h2>
          <p>Payment processing is handled by Stripe. We do not store credit card information. Stripe's privacy policy applies to payment data.</p>
        </div>
        <div>
          <h2 className="text-white font-semibold mb-2">6. Your rights</h2>
          <p>You can request deletion of your account and all associated data at any time by contacting us at privacy@vitaloop.com.</p>
        </div>
        <div>
          <h2 className="text-white font-semibold mb-2">7. Contact</h2>
          <p>Questions? Email us at <a href="mailto:privacy@vitaloop.com" className="text-green-400 hover:underline">privacy@vitaloop.com</a>.</p>
        </div>
      </section>
    </div>
  )
}
