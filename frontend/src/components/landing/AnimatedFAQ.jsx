import { motion, AnimatePresence } from 'framer-motion'
import { useState, useMemo } from 'react'
import { Search, ChevronDown } from 'lucide-react'

const FAQ_ITEMS = [
  {
    question: 'Can I start with symptoms even without lab results?',
    answer: 'Yes. You can begin with symptom intake and guided follow-up questions. VITALOOP helps organize context and identify what may be useful to discuss and test next.',
  },
  {
    question: 'Which lab report formats does VITALOOP support?',
    answer: 'VITALOOP supports PDF and image uploads, manual biomarker entry, and structured spreadsheet-style inputs in the product flow. The analysis core normalizes names, units, reference ranges, and priority context.',
  },
  {
    question: 'Does VITALOOP diagnose conditions?',
    answer: 'No. VITALOOP is a wellness support platform for organizing context, interpreting lab patterns, and guiding execution. It does not provide medical diagnosis or treatment.',
  },
  {
    question: 'Will this replace my doctor?',
    answer: 'No. It is designed to improve collaboration with qualified clinicians by making your symptoms, labs, and next-step questions easier to review.',
  },
  {
    question: 'What is longitudinal biomarker tracking?',
    answer: 'Longitudinal tracking means reviewing the same biomarkers over repeated cycles so you can see trajectory, not just one snapshot.',
  },
  {
    question: 'How is VITALOOP different from generic AI chat?',
    answer: 'VITALOOP uses a shared analysis core with governed Knowledge Base rules, safety flags, trend context, and structured outputs. It is not a one-off prompt over pasted lab values.',
  },
  {
    question: 'Can practitioners use VITALOOP for client management?',
    answer: 'Yes. Practitioner workflows support client context review, progress monitoring, and clearer protocol communication.',
  },
  {
    question: 'How much does VITALOOP cost?',
    answer: 'VITALOOP includes a free plan and paid plans for ongoing tracking and practitioner workflows. See the Pricing section for current details.',
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
