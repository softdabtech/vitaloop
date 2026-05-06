import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ChevronDown, HelpCircle } from 'lucide-react'
import { useState } from 'react'
import Seo from '../components/Seo.jsx'

const FAQ_ITEMS = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'What file formats do you accept?',
        a: 'We accept PDF lab reports, PNG/JPG images of lab results, and HL7/FHIR data from EMR systems. Our OCR engine handles most standard lab formats automatically.',
      },
      {
        q: 'How do I upload my first lab report?',
        a: 'After signing up, click "Upload" in your dashboard. Select your lab PDF or image, and our AI will automatically extract biomarkers. You\'ll see results in seconds.',
      },
      {
        q: 'Do I need a credit card to start?',
        a: 'No. The Free plan is completely free — upload one report, see your dashboard, and explore the platform. No credit card required.',
      },
      {
        q: 'How long does analysis take?',
        a: 'Usually 5-15 seconds. Our AI processes OCR, biomarker extraction, normalization, and protocol ranking in real-time. Complex uploads may take up to 1 minute.',
      },
    ],
  },
  {
    category: 'Data & Privacy',
    questions: [
      {
        q: 'Is my health data secure?',
        a: 'Yes. All data is encrypted end-to-end with AES-256. We\'re HIPAA-compliant and SOC 2 certified. Your data is never sold or shared without explicit consent.',
      },
      {
        q: 'Can I delete my account and data?',
        a: 'Absolutely. You can request a full data export anytime, or permanently delete your account. All associated data is purged within 30 days.',
      },
      {
        q: 'Who can see my results?',
        a: 'Only you by default. You can optionally share with practitioners via secure token links, which you can revoke anytime. Practitioners can never see your data without active sharing.',
      },
      {
        q: 'Do you comply with regulations?',
        a: 'Yes. We comply with HIPAA (US), GDPR (EU), and LGPD (Brazil). Enterprise plans include BAA agreements and additional compliance certifications.',
      },
    ],
  },
  {
    category: 'Features & Plans',
    questions: [
      {
        q: 'What\'s the difference between Free and Premium?',
        a: 'Free plan: 3 uploads/year, basic analysis. Premium plan: unlimited uploads, longitudinal tracking, AI health coaching, weekly check-ins, doctor sharing, and trend analytics.',
      },
      {
        q: 'Can I cancel my subscription anytime?',
        a: 'Yes. Cancel anytime with no penalties. You keep access through the end of your billing period. Unused credits are non-refundable but can be applied to future months.',
      },
      {
        q: 'What\'s included in the protocol recommendations?',
        a: 'Personalized supplement rankings (with links to buy), nutrition changes tied to your biomarkers, lifestyle adjustments, retest timing, and expected timelines for improvement.',
      },
      {
        q: 'Do you have a team/family plan?',
        a: 'Not yet, but it\'s on our roadmap. Currently, each person needs their own account. Enterprise accounts can manage multiple patients.',
      },
    ],
  },
  {
    category: 'Doctor Collaboration',
    questions: [
      {
        q: 'How do I share with my doctor?',
        a: 'Generate a secure share link from your dashboard, set an expiration date, and choose the access level (view, comment, or export). Send the link to your doctor — no account needed.',
      },
      {
        q: 'Can my doctor add comments to my results?',
        a: 'Yes, if you grant "comment" access. They can add annotations, recommendations, and flag priority items. You\'ll get notifications when they comment.',
      },
      {
        q: 'What\'s the Practitioner plan?',
        a: 'The Practitioner plan is $29/month and lets doctors manage up to 50 patients, batch-send recommendations, track adherence, and generate clinical reports automatically.',
      },
      {
        q: 'Do you integrate with EMR systems?',
        a: 'Yes. We support HL7 v2.x and FHIR APIs for modern EMR systems like Epic, Cerner, and Allscripts. Enterprise plans include custom integrations.',
      },
    ],
  },
  {
    category: 'Technical & Data',
    questions: [
      {
        q: 'How often should I upload new labs?',
        a: 'That depends on your goals and protocol. Most users retest every 8-12 weeks. Some markers improve faster; others need 3-6 months. We\'ll recommend retest timing in your protocol.',
      },
      {
        q: 'How far back do you track history?',
        a: 'As far back as you upload. Some users have 5+ years of data in the system. The longitudinal engine lets you see multi-year trends and patterns.',
      },
      {
        q: 'Can you import data from wearables?',
        a: 'Not yet, but integrations with Apple Health, Oura, and Whoop are planned. For now, log your data manually via weekly check-ins.',
      },
      {
        q: 'What biomarkers do you track?',
        a: 'We analyze 85+ common markers: glucose, insulin, lipids, thyroid, iron, B vitamins, inflammation, hormones, kidney/liver function, and more. Custom markers available on request.',
      },
    ],
  },
  {
    category: 'AI & Recommendations',
    questions: [
      {
        q: 'How accurate are your recommendations?',
        a: 'Recommendations are evidence-based and personalized to your specific biomarkers and history. However, they\'re not medical advice. Always discuss major changes with your practitioner.',
      },
      {
        q: 'Can I chat with an AI about my results?',
        a: 'Yes. The AI Health Coach lets you ask questions about your biomarkers, supplements, nutrition, and protocol. Answers are personalized to your test results.',
      },
      {
        q: 'How does the protocol engine work?',
        a: 'It analyzes your abnormal markers, cross-biomarker correlations, and your history to recommend the most impactful interventions. Supplements are ranked by expected impact.',
      },
      {
        q: 'Does the protocol adapt over time?',
        a: 'Yes. Your weekly check-ins (sleep, energy, mood) feed back into the system. The AI adjusts recommendations between lab tests, not just after them.',
      },
    ],
  },
  {
    category: 'Support & Billing',
    questions: [
      {
        q: 'How do I contact support?',
        a: 'Email support@vitaloop.today or use the chat widget in the app. We typically respond within 24 hours.',
      },
      {
        q: 'What payment methods do you accept?',
        a: 'We accept all major credit cards (Visa, Mastercard, Amex), Apple Pay, and Google Pay. Enterprise customers can arrange invoicing.',
      },
      {
        q: 'When do you bill?',
        a: 'Monthly subscriptions are billed on the same date each month. You\'ll get a reminder 7 days before renewal.',
      },
      {
        q: 'What\'s your refund policy?',
        a: 'We offer a 30-day money-back guarantee for annual plans. Monthly plans can be cancelled anytime before the next billing date.',
      },
    ],
  },
]

export default function FAQ() {
  const navigate = useNavigate()
  const [expandedId, setExpandedId] = useState(null)

  const toggleExpanded = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <>
      <Seo
        title="Blood Test Analysis FAQ | VITALOOP"
        description="Answers to common questions about VITALOOP: AI lab analysis, blood test uploads, biomarker protocols, privacy, plans, and practitioner collaboration."
        path="/faq"
        schemas={[
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ_ITEMS.flatMap((section) =>
              section.questions.map((item) => ({
                '@type': 'Question',
                name: item.q,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: item.a,
                },
              }))
            ),
          },
        ]}
      />

      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 py-6">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              <ArrowLeft size={16} />
              Back to home
            </button>
          </div>
        </div>

        {/* Hero Section */}
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 py-16 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
              <HelpCircle size={16} className="text-emerald-600" />
              <span className="text-sm font-semibold text-slate-900">Common Questions</span>
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 mb-6 leading-tight">
              Frequently Asked Questions
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Everything you need to know about VITALOOP. Can't find what you're looking for? Email us at support@vitaloop.today
            </p>
          </motion.div>
        </div>

        {/* FAQ Sections */}
        <div className="mx-auto max-w-[900px] px-4 sm:px-6 pb-24">
          {FAQ_ITEMS.map((section, sectionIdx) => (
            <motion.div
              key={section.category}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: sectionIdx * 0.05 }}
              viewport={{ once: true }}
              className="mb-12"
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-6">{section.category}</h2>
              <div className="space-y-4">
                {section.questions.map((item, qIdx) => {
                  const itemId = `${sectionIdx}-${qIdx}`
                  const isExpanded = expandedId === itemId

                  return (
                    <motion.div
                      key={itemId}
                      className="rounded-[20px] border border-slate-200 bg-white overflow-hidden hover:border-slate-300 transition"
                    >
                      <button
                        onClick={() => toggleExpanded(itemId)}
                        className="w-full px-6 py-5 sm:py-6 flex items-start justify-between gap-4 hover:bg-slate-50 transition text-left"
                      >
                        <span className="text-lg font-semibold text-slate-900 flex-1 pr-4">
                          {item.q}
                        </span>
                        <ChevronDown
                          size={20}
                          className={`text-emerald-600 flex-shrink-0 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-slate-200 px-6 py-5 bg-slate-50"
                          >
                            <p className="text-slate-600 leading-relaxed">{item.a}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 py-16 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="rounded-[34px] bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 p-12 sm:p-16 text-center"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
              Still have questions?
            </h2>
            <p className="text-lg text-slate-600 mb-8">
              Our support team is here to help. Reach out anytime.
            </p>
            <a
              href="mailto:support@vitaloop.today"
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-4 text-lg font-bold text-white hover:bg-emerald-700 transition shadow-lg"
            >
              Contact Support
            </a>
          </motion.div>
        </div>
      </div>
    </>
  )
}
