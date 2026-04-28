import { useNavigate } from 'react-router-dom'
import Seo from '../components/Seo.jsx'

export default function Privacy() {
  const navigate = useNavigate()
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--white, #ffffff)',
      color: 'var(--gray-900, #1d1d1f)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Premium Display", sans-serif',
      padding: window.innerWidth < 500 ? '40px 16px' : '80px 24px',
      maxWidth: 720,
      margin: '0 auto',
    }}>
      <Seo
        title="Privacy Policy | VITALOOP"
        description="Read how VITALOOP stores, processes, and protects your blood test data, including AI processing, security controls, and deletion rights."
        path="/privacy"
      />
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 14, color: 'var(--teal-600, #0F6E56)',
          marginBottom: 48, padding: 0,
        }}
      >
        ← Back to VITALOOP
      </button>
      <h1 style={{ fontSize: 34, lineHeight: 1.2, fontWeight: 700, color: 'var(--gray-900, #1d1d1f)', marginBottom: 12 }}>Privacy Policy</h1>
      <p style={{ color: 'var(--gray-500, #6e6e73)', fontSize: 14, marginBottom: 32 }}>Last updated: April 2026</p>

      <section style={{ display: 'grid', gap: 24, fontSize: 15, lineHeight: 1.7, color: 'var(--gray-700, #424245)' }}>
        <div>
          <h2 style={{ color: 'var(--gray-900, #1d1d1f)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>1. What we collect</h2>
          <p>We collect your email address (for authentication) and the <strong>extracted text</strong> from lab results you upload. We do <strong>not</strong> store original PDF files or images.</p>
        </div>
        <div>
          <h2 style={{ color: 'var(--gray-900, #1d1d1f)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>2. How we use your data</h2>
          <p>Your lab data is used solely to generate biomarker analysis and supplement protocols using AI. We never sell, rent, or share your personal data with third parties, except as required by law.</p>
        </div>
        <div>
          <h2 style={{ color: 'var(--gray-900, #1d1d1f)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>3. Data storage & security</h2>
          <p>Data is stored in Supabase (PostgreSQL) with row-level security — only you can access your records. All data is encrypted in transit (TLS 1.2+) and at rest.</p>
        </div>
        <div>
          <h2 style={{ color: 'var(--gray-900, #1d1d1f)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>4. AI processing</h2>
          <p>Lab text is sent to Anthropic's Claude API for analysis. Prompts are designed to minimize personal identifiers. We do not use your data to train AI models.</p>
        </div>
        <div>
          <h2 style={{ color: 'var(--gray-900, #1d1d1f)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>5. Payments</h2>
          <p>Payment processing is handled by Stripe. We do not store credit card information. Stripe's privacy policy applies to payment data.</p>
        </div>
        <div>
          <h2 style={{ color: 'var(--gray-900, #1d1d1f)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>6. Your rights</h2>
          <p>You can request deletion of your account and all associated data at any time by contacting us at privacy@vitaloop.com.</p>
        </div>
        <div>
          <h2 style={{ color: 'var(--gray-900, #1d1d1f)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>7. Contact</h2>
          <p>Questions? Email us at <a href="mailto:privacy@vitaloop.com" style={{ color: 'var(--teal-500)' }}>privacy@vitaloop.com</a>.</p>
        </div>
      </section>
    </div>
  )
}
