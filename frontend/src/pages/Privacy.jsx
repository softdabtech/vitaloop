import { useNavigate } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Footer from '../components/landing/Footer.jsx'

function getLegalPagePadding() {
  if (typeof window === 'undefined') return '80px 24px'
  return window.innerWidth < 500 ? '40px 16px' : '80px 24px'
}

export default function Privacy() {
  const navigate = useNavigate()
  const h2Style = { color: 'var(--gray-900, #1d1d1f)', fontSize: 20, fontWeight: 600, marginBottom: 8 }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--white, #ffffff)',
      color: 'var(--gray-900, #1d1d1f)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Premium Display", sans-serif',
      padding: getLegalPagePadding(),
      maxWidth: 720,
      margin: '0 auto',
    }}>
      <Seo
        title="Privacy Policy | VITALOOP"
        description="Learn how VITALOOP collects, processes, stores, protects, exports, and deletes symptom data, blood test reports, biomarker results, and account information."
        path="/privacy-policy"
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
      <p style={{ color: 'var(--gray-500, #6e6e73)', fontSize: 14, marginBottom: 32 }}>Last updated: May 19, 2026</p>

      <section style={{ display: 'grid', gap: 24, fontSize: 15, lineHeight: 1.7, color: 'var(--gray-700, #424245)' }}>
        <div>
          <p>VITALOOP ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and protect your personal information when you use our AI-powered blood test analysis platform.</p>
        </div>

        <div>
          <h2 style={h2Style}>1. Information We Collect</h2>
          <p><strong>Health Data:</strong> Lab test PDFs you upload for analysis, biomarker values and status extracted from labs, personalized protocol information, and progress data such as weekly check-ins and biomarker trends.</p>
          <p><strong>Account Information:</strong> Email address, encrypted password, account creation and login dates, subscription plan, and billing status.</p>
          <p><strong>Usage Data:</strong> Pages visited, features used, time spent, device and browser details, and IP-based city/country-level location data.</p>
          <p><strong>Payment Information:</strong> Stripe processes all payments. We never store full credit card details on our servers.</p>
        </div>

        <div>
          <h2 style={h2Style}>2. How We Use Your Information</h2>
          <p>We use your data to analyze lab reports, generate personalized protocols, track biomarker progress, send service emails, provide support, and improve product quality and AI analysis accuracy.</p>
          <p><strong>We never:</strong> sell health data, share with advertisers/data brokers, use your data for AI model training without explicit consent, share with insurers/employers without permission, or use data beyond service delivery.</p>
        </div>

        <div>
          <h2 style={h2Style}>3. How We Store and Protect Your Data</h2>
          <p><strong>Data Storage:</strong> Data is hosted on secure US infrastructure, encrypted at rest, access-restricted, and backed up with encrypted disaster recovery copies.</p>
          <p><strong>PDF Handling:</strong> Lab PDFs are used for analysis and deleted after processing. You control re-uploads at any time.</p>
          <p><strong>Security Measures:</strong> HTTPS/TLS in transit, bcrypt password hashing, session controls, multi-factor authentication availability, firewall protections, monitoring, and regular security audits.</p>
        </div>

        <div>
          <h2 style={h2Style}>4. Data Sharing and Third Parties</h2>
          <p>We share only minimal required data with trusted providers to operate VITALOOP: Anthropic (AI processing), Stripe (payments), DigitalOcean (hosting), and Resend/SendGrid (transactional email).</p>
          <p>We may disclose information only when legally required, to protect rights and safety, prevent fraud, or during business transfers as allowed by law.</p>
        </div>

        <div>
          <h2 style={h2Style}>5. Your Rights and Control</h2>
          <p>You can access and export your data, request corrections, update account profile details, configure communication preferences, object to certain processing, and request deletion of account data.</p>
          <p>Deletion removes personal records within 30 days, with backup cleanup windows up to 90 days where applicable.</p>
        </div>

        <div>
          <h2 style={h2Style}>6. Data Retention</h2>
          <p>Data is retained while your account is active. Inactive accounts may be removed after notice. Deleted account data is permanently removed from primary systems within 30 days.</p>
        </div>

        <div>
          <h2 style={h2Style}>7. Compliance and Standards</h2>
          <p>We align operations with GDPR and CCPA principles and follow SOC 2-aligned security practices.</p>
          <p><strong>Medical Disclaimer:</strong> VITALOOP is a wellness tool, not a medical device. We follow healthcare-grade security practices but are not subject to HIPAA. Always consult qualified healthcare providers for medical decisions.</p>
        </div>

        <div>
          <h2 style={h2Style}>8. Cookies and Tracking</h2>
          <p>We use essential cookies for authentication and core functionality, product analytics, and conversion tracking tools (including Meta Pixel) to measure campaign performance.</p>
        </div>

        <div>
          <h2 style={h2Style}>9. Children's Privacy</h2>
          <p>VITALOOP is not intended for individuals under 18. If you believe a child submitted personal data, contact us immediately.</p>
        </div>

        <div>
          <h2 style={h2Style}>10. International Data Transfers</h2>
          <p>If you access VITALOOP outside the US, your data may be transferred to and processed in the United States with appropriate safeguards.</p>
        </div>

        <div>
          <h2 style={h2Style}>11. Changes to This Policy</h2>
          <p>We may update this policy as features evolve. Major updates are communicated via email; minor updates are reflected by the Last Updated date.</p>
          <p><strong>Current version:</strong> 1.0 (May 19, 2026).</p>
        </div>

        <div>
          <h2 style={h2Style}>12. Contact Us</h2>
          <p><strong>Privacy Questions:</strong> <a href="mailto:privacy@vitaloop.today" style={{ color: 'var(--teal-500)' }}>privacy@vitaloop.today</a></p>
          <p><strong>General Support:</strong> <a href="mailto:support@vitaloop.today" style={{ color: 'var(--teal-500)' }}>support@vitaloop.today</a></p>
          <p><strong>Founder:</strong> <a href="mailto:bombela@softdab.tech" style={{ color: 'var(--teal-500)' }}>bombela@softdab.tech</a></p>
          <p><strong>Mailing Address:</strong> VITALOOP TODAY, New York, WA, US</p>
        </div>

        <div>
          <h2 style={h2Style}>13. Your Consent</h2>
          <p>By creating an account and using VITALOOP, you acknowledge that you have read and understood this Privacy Policy and agree to its terms.</p>
        </div>

        <div>
          <h2 style={h2Style}>Related Documents</h2>
          <p><a href="/terms" style={{ color: 'var(--teal-500)' }}>Terms of Service</a></p>
          <p><a href="/privacy-policy" style={{ color: 'var(--teal-500)' }}>Privacy Policy</a></p>
          <p style={{ color: 'var(--gray-500, #6e6e73)', fontSize: 14 }}><em>This Privacy Policy is effective as of May 19, 2026.</em></p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
