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
          <p><strong>Payment Information:</strong> Premium subscription charges and status are handled by Stripe. We do not store full credit card details on our servers.</p>
        </div>

        <div>
          <h2 style={h2Style}>2. How We Use Your Information</h2>
          <p>We use your data to analyze lab reports, generate personalized protocols, track biomarker progress, send service emails, provide support, and improve product quality and AI analysis accuracy.</p>
          <p><strong>We do not:</strong> sell health data, share with advertisers/data brokers, share with insurers/employers without permission, or use data beyond service delivery and platform improvement.</p>
          <p><em>Note: AI model training practices are governed by our agreements with AI providers (see Section 4). Contact privacy@vitaloop.today for details on model training policies.</em></p>
        </div>

        <div>
          <h2 style={h2Style}>3. How We Store and Protect Your Data</h2>
          <p><strong>Data Storage:</strong> Data is hosted on secure US infrastructure, encrypted at rest, access-restricted, and backed up with encrypted disaster recovery copies.</p>
          <p><strong>PDF Handling:</strong> Lab PDFs are used for analysis and deleted after processing. You control re-uploads at any time.</p>
          <p><strong>Security Measures:</strong> HTTPS/TLS in transit, bcrypt password hashing, session controls, multi-factor authentication availability, firewall protections, monitoring, and regular security audits.</p>
        </div>

        <div>
          <h2 style={h2Style}>4. Data Sharing and Third Parties</h2>
          <p>We share only minimal required data with trusted providers to operate VITALOOP: Anthropic and OpenAI (AI-assisted analysis), Stripe (payment processing and subscription management), DigitalOcean (hosting), and Resend (transactional email).</p>
          <p>When you use AI-powered features, your lab data and health information may be sent to our AI providers (Anthropic/OpenAI) for analysis. See our AI Disclosure section for details.</p>
          <p>We may disclose information only when legally required, to protect rights and safety, prevent fraud, or during business transfers as allowed by law.</p>
        </div>

        <div>
          <h2 style={h2Style}>5. Your Rights and Control</h2>
          <p>You can access and export your data, request corrections, update account profile details, configure communication preferences, object to certain processing, and request deletion of account data.</p>
          <p><strong>Account Deletion:</strong> When you delete your account, your authentication identity and associated personal records (profile, symptoms, biomarkers, lab uploads with extracted text, protocols, check-ins, health scores) are removed from our active database systems. Some information related to billing, fraud prevention, or legal compliance may be retained or anonymized. Backup and disaster recovery copies may persist temporarily.</p>
          <p><strong>Uploaded Lab Documents:</strong> When you upload a lab document (PDF), VITALOOP extracts the text content for analysis. The original PDF file is processed through our analysis provider (OpenAI) and is not persisted in our systems. The extracted text is stored in your account record and is deleted when you delete the upload or your account.</p>
        </div>

        <div>
          <h2 style={h2Style}>6. Data Retention</h2>
          <p>Data is retained while your account is active. When you delete your account, core personal data is removed from our primary systems via automatic cascade deletion.</p>
          <p><strong>Extracted Lab Text:</strong> Raw extracted text from lab documents is retained for up to 180 days to support longitudinal health analysis and protocol refinement. After this period, raw text is de-identified or removed.</p>
          <p><strong>Clinical Biomarker Data:</strong> Extracted biomarkers, their interpreted status, and derived clinical insights are retained as long as they support your health analysis and are not explicitly deleted. Deleting an individual lab upload removes biomarkers extracted from that specific upload.</p>
          <p><strong>Billing and Legal Records:</strong> Subscription, payment, and security records required for billing, tax compliance, fraud prevention, or legal obligations are retained as required by applicable law.</p>
          <p><strong>Backup Retention:</strong> Automated backup and disaster recovery systems may contain historical data beyond primary deletion timelines. These backups are subject to our operational backup retention policy. Contact privacy@vitaloop.today for specific backup retention questions.</p>
        </div>

        <div>
          <h2 style={h2Style}>7. Medical Disclaimer and AI Processing</h2>
          <p><strong>Not Medical Advice:</strong> VITALOOP is an educational wellness and health-intelligence tool, not a medical device or healthcare provider. The analysis, protocols, and insights generated by our AI are for informational purposes only and do not constitute medical diagnosis, treatment, prescription, or professional medical advice.</p>
          <p><strong>AI-Powered Processing:</strong> VITALOOP uses AI (Anthropic and OpenAI) to assist with analysis of your lab data and health information. AI-generated outputs may be incomplete or inaccurate. Always confirm clinical decisions with qualified healthcare providers.</p>
          <p><strong>Security Practices:</strong> We follow healthcare-grade security practices but are not subject to HIPAA. We align operations with GDPR and CCPA privacy principles where applicable.</p>
          <p><strong>Emergencies:</strong> If you experience a medical emergency, immediate danger, or thoughts of self-harm, do not rely on VITALOOP. Contact your local emergency services or crisis line immediately.</p>
        </div>

        <div>
          <h2 style={h2Style}>8. Cookies and Tracking</h2>
          <p>We use essential cookies for authentication and core functionality, product analytics, and conversion tracking tools (including Meta Pixel) to measure campaign performance.</p>
        </div>

        <div>
          <h2 style={h2Style}>9. Children's Privacy and Parent-Managed Health Data</h2>
          <p>VITALOOP is intended for use by adults and parents/guardians managing health data for minors under their authority. When a parent or guardian submits lab results or health information for a child, that adult is responsible for ensuring they have authority to do so.</p>
          <p>For pediatric health data: Parents and guardians should review these terms and our medical disclaimer before entering a child's lab results or health information. Pediatric lab interpretation may require specialized medical review by a qualified clinician familiar with pediatric reference ranges and age-appropriate clinical context.</p>
          <p>If you believe a child has created an account or submitted personal data without appropriate adult supervision, contact us immediately at privacy@vitaloop.today.</p>
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
          <p><a href="/terms/" style={{ color: 'var(--teal-500)' }}>Terms of Service</a></p>
          <p><a href="/privacy-policy/" style={{ color: 'var(--teal-500)' }}>Privacy Policy</a></p>
          <p style={{ color: 'var(--gray-500, #6e6e73)', fontSize: 14 }}><em>This Privacy Policy is effective as of May 19, 2026.</em></p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
