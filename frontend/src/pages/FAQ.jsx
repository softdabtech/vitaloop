import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { useState } from 'react'
import Seo from '../components/Seo.jsx'
import { PageHeader } from '../components/landing/PageHeader.jsx'

const FAQ_ITEMS = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'Can I start without lab results?',
        a: 'Yes. You can begin with symptom intake and guided follow-up questions, then decide what to discuss and test next with your clinician.',
      },
      {
        q: 'How do I upload my first lab report?',
        a: 'After signing up, click "Upload" in your dashboard and select your lab PDF. VITALOOP then normalizes biomarkers and maps findings into a structured plan.',
      },
      {
        q: 'Do I need a credit card to start?',
        a: 'No. The Free plan is completely free — upload one report, see your dashboard, and explore the platform. No credit card required.',
      },
      {
        q: 'How long does analysis take?',
        a: 'Most analyses complete quickly after upload. Timing depends on report complexity and current processing load.',
      },
    ],
  },
  {
    category: 'Data & Privacy',
    questions: [
      {
        q: 'Is my health data secure?',
        a: 'Yes. We use encryption, access controls, and privacy-focused processing practices. Your data is not sold to advertisers or data marketplaces.',
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
        a: 'We apply healthcare-aligned data protection practices and continue evolving our compliance posture based on customer and regional requirements.',
      },
    ],
  },
  {
    category: 'Features & Plans',
    questions: [
      {
        q: 'What\'s the difference between Free and Premium?',
        a: 'Free includes one active upload, a starter structured report, and the core dashboard. Premium adds unlimited uploads, full evidence-aware reports, action plans, weekly check-ins, progress tracking, and retest planning.',
      },
      {
        q: 'Can I cancel my subscription anytime?',
        a: 'Yes. Cancel anytime with no penalties. You keep access through the end of your billing period. Unused credits are non-refundable but can be applied to future months.',
      },
      {
        q: 'What\'s included in the protocol recommendations?',
        a: 'Your action plan can organize nutrition, supplement, lifestyle, training/recovery, adherence, safety, and retest discussion points around your available symptom and biomarker context. Review major changes with a qualified clinician.',
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
        a: 'Use your structured results and progress summaries to prepare for a clinician conversation. Practitioner collaboration features depend on your plan and workspace setup.',
      },
      {
        q: 'Can my doctor add comments to my results?',
        a: 'Practitioner workspaces can review client context and follow-up progress. VITALOOP does not replace your clinician\'s own medical record or communication system.',
      },
      {
        q: 'What\'s the Practitioner plan?',
        a: 'The Practitioner plan starts at $29/month and adds client workspaces, practitioner CRM workflows, assignments, progress review, and structured reporting tools.',
      },
      {
        q: 'Do you integrate with EMR systems?',
        a: 'Direct EMR integrations are not part of the standard self-service product today. Organizations can contact us to discuss integration requirements and available options.',
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
        a: 'As far back as you upload. The longitudinal engine is designed to compare repeated uploads over time, so one result becomes a baseline and later results can show direction.',
      },
      {
        q: 'Can you import data from wearables?',
        a: 'Not yet, but integrations with Apple Health, Oura, and Whoop are planned. For now, log your data manually via weekly check-ins.',
      },
      {
        q: 'What biomarkers do you track?',
        a: 'VITALOOP normalizes and evaluates common markers across metabolic health, iron and nutrient status, inflammation, thyroid context, hormones, kidney/liver function, and more. Coverage continues to expand through the governed biomarker registry.',
      },
    ],
  },
  {
    category: 'AI & Recommendations',
    questions: [
      {
        q: 'How accurate are your recommendations?',
        a: 'VITALOOP provides educational decision support based on the information available to it and may make mistakes. It does not diagnose conditions or replace professional medical judgment.',
      },
      {
        q: 'Can I chat with an AI about my results?',
        a: 'VITALOOP focuses on structured educational explanations inside your report and protocol. Where AI support is available, it is constrained by your biomarkers, symptoms, Knowledge Base context, evidence gaps, and safety limits.',
      },
      {
        q: 'How does the protocol engine work?',
        a: 'The VITALOOP Health Intelligence Engine organizes extracted biomarkers, confidence signals, related patterns, symptoms, safety context, missing evidence, and available history into prioritized educational actions, protocol sections, retest suggestions, and follow-up questions. Clinical decisions remain with you and your qualified practitioner.',
      },
      {
        q: 'Does the protocol adapt over time?',
        a: 'Weekly check-ins keep sleep, energy, symptoms, and adherence connected to your plan. New labs and follow-up context can then inform the next review cycle.',
      },
    ],
  },
  {
    category: 'Support & Billing',
    questions: [
      {
        q: 'How do I contact support?',
        a: 'Email info@softdab.tech or use the chat widget in the app. We typically respond within 24 hours.',
      },
      {
        q: 'What payment methods do you accept?',
        a: 'Premium access is currently activated manually while we configure payment processing. VITALOOP does not send symptoms, lab files, biomarker values, or health reports to billing tools.',
      },
      {
        q: 'When do you bill?',
        a: 'Premium is available as $9.99 monthly billing or $99.99 yearly billing. The cabinet shows your current Free or Premium status.',
      },
      {
        q: 'What\'s your refund policy?',
        a: 'Contact info@softdab.tech for cancellation or refund questions. We review requests based on the active access arrangement.',
      },
    ],
  },
]

export default function FAQ() {
  const [expandedId, setExpandedId] = useState(null)

  const toggleExpanded = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <>
      <Seo
        title="VITALOOP Health Intelligence FAQ | Symptoms, Labs, Safety & Retests"
        description="Answers about symptom intake, blood test uploads, biomarker explanations, the VITALOOP Health Intelligence Engine, privacy, pricing, practitioner workflows, and VITALOOP safety limits."
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
        <PageHeader />

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
              Everything you need to know about VITALOOP. Can't find what you're looking for? Email us at info@softdab.tech
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
              href="mailto:info@softdab.tech"
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
