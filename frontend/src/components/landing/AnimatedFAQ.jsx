import { motion, AnimatePresence } from 'framer-motion'
import { useState, useMemo } from 'react'
import { Search, ChevronDown } from 'lucide-react'

const FAQ_ITEMS = [
  {
    question: 'What is AI lab analysis and how does VITALOOP use it?',
    answer: 'AI lab analysis in VITALOOP means structured interpretation of blood test PDFs: marker normalization, priority ranking, and trend context across cycles. The output is an execution-ready plan rather than raw values.',
  },
  {
    question: 'Which blood test formats does VITALOOP support?',
    answer: 'VITALOOP currently supports PDF uploads from major laboratories. Our AI analysis engine normalizes units and reference ranges across 85+ biomarkers including CBC, metabolic panels, thyroid, hormones, vitamins, and inflammation markers.',
  },
  {
    question: 'How accurate is AI blood test interpretation?',
    answer: 'VITALOOP compares biomarkers against reference ranges and your historical trends. It also highlights relevant marker combinations (for example ferritin with CRP and transferrin saturation) to support clearer prioritization.',
  },
  {
    question: 'Is VITALOOP a medical device or replacement for a doctor?',
    answer: 'No. VITALOOP is a health intelligence platform, not a licensed medical device. It provides educational insights and protocol suggestions based on your lab data. Always consult a qualified healthcare professional for medical decisions.',
  },
  {
    question: 'What is longitudinal biomarker tracking?',
    answer: 'Longitudinal biomarker tracking means analyzing the same health markers across multiple lab draws over time — weeks, months, or years. VITALOOP visualizes trend lines, detects recovery patterns, and alerts you when trajectories worsen, giving you a health timeline instead of a one-off snapshot.',
  },
  {
    question: 'How is VITALOOP different from asking ChatGPT about my labs?',
    answer: 'Chat tools are session-based and usually provide generic guidance. VITALOOP keeps your longitudinal lab history, applies a consistent normalization flow, and ties protocol recommendations to your specific biomarker patterns.',
  },
  {
    question: 'How does VITALOOP compare with LabCorp MyChart, Everlywell, Levels, and Function Health?',
    answer: 'Those platforms focus on record delivery, diagnostics access, or single-domain tracking. VITALOOP focuses on longitudinal decision-making and execution: prioritized protocol actions, weekly adherence loops, and practitioner workflows in one operating system.',
  },
  {
    question: 'Can practitioners use VITALOOP for client management?',
    answer: 'Yes. The Enterprise plan includes a full Practitioner CRM with multi-client dashboards, assignment workflows, protocol templates, and trend visibility — enabling functional medicine practitioners and health coaches to manage dozens of clients efficiently.',
  },
  {
    question: 'How much does VITALOOP cost?',
    answer: 'VITALOOP offers a free plan with 1 active upload and a core dashboard. Premium is $19.99/month (or $199/year) and includes unlimited uploads, personalized AI protocols, and weekly check-ins. Enterprise plans start at $99/month for practitioner teams.',
  },
]

export function AnimatedFAQ() {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)

  const filtered = useMemo(
    () =>
      FAQ_ITEMS.filter(
        (item) =>
          item.question.toLowerCase().includes(search.toLowerCase()) ||
          item.answer.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  )

  return (
    <section id="faq" className="relative py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">Frequently asked questions</h2>
          <p className="text-lg text-slate-600">Everything you need to know about VITALOOP</p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search questions..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setExpanded(null)
              }}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
            />
          </div>
        </motion.div>

        {/* FAQ Items */}
        <AnimatePresence mode="wait">
          {filtered.length > 0 ? (
            <motion.div
              key="faq-items"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {filtered.map((item, i) => (
                <FAQItem
                  key={item.question}
                  item={item}
                  index={i}
                  isExpanded={expanded === item.question}
                  onToggle={() =>
                    setExpanded(expanded === item.question ? null : item.question)
                  }
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="no-results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center py-12"
            >
              <p className="text-slate-600">No questions found. Try a different search.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results count */}
        {search && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center mt-8 text-sm text-slate-500"
          >
            Found {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </motion.div>
        )}
      </div>
    </section>
  )
}

function FAQItem({ item, index, isExpanded, onToggle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group"
    >
      <motion.button
        onClick={onToggle}
        whileHover={{ scale: 1.01 }}
        className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-300 rounded-lg p-5 transition-all"
      >
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-slate-900 pr-4">{item.question}</h3>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            className="flex-shrink-0"
          >
            <ChevronDown className="w-5 h-5 text-emerald-600" />
          </motion.div>
        </div>
      </motion.button>

      {/* Answer */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="bg-slate-50 border-l border-r border-b border-slate-200 border-t-0 rounded-b-lg p-5">
              <p className="text-slate-700 leading-relaxed">{item.answer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
