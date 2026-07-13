import { TrendingUp, DollarSign, Clock, BarChart2, ShieldCheck } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { stagger, staggerChild, fadeUp, viewport } from '../../lib/motion.js'

const CARDS = [
  {
    Icon: BarChart2,
    title: 'Deeper insights',
    body: 'More actionable than a generic AI reply: structured biomarkers, symptom context, Knowledge Base reasoning, safety flags, and personalized protocol sections.',
  },
  {
    Icon: Clock,
    title: 'Saves hours for practitioners',
    body: 'Built-in CRM removes manual work. Assign protocols, generate white-label reports, track clients — all in one place.',
  },
  {
    Icon: DollarSign,
    title: 'Significantly more affordable',
    body: 'Premium analysis at a fraction of the cost of competitors. Start free, upgrade when you need more.',
  },
  {
    Icon: TrendingUp,
    title: 'True longitudinal tracking',
    body: 'Not just one-time reports. Visual timeline across all your tests — see real improvements month over month.',
  },
  {
    Icon: ShieldCheck,
    title: 'Privacy and security by design',
    body: 'Your data is never sold. Supabase RLS and secure-by-default processing protect every record.',
  },
]

export default function ValueBlock() {
  const reduced = useReducedMotion()
  const primaryCards = CARDS.slice(0, 4)
  const privacyCard = CARDS[4]

  const cardClass = 'rounded-2xl border border-zinc-200 bg-white p-7 md:p-8 shadow-sm transition-shadow duration-200'
  const iconWrapClass = 'mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20'

  return (
    <section id="why-vitaloop" className="bg-white px-6 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          variants={reduced ? {} : stagger(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={viewport('-60px')}
          className="mb-12 text-center md:mb-14"
        >
          <motion.div variants={reduced ? {} : staggerChild} className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-600">
            Why VITALOOP
          </motion.div>
          <motion.h2
            variants={reduced ? {} : staggerChild}
            className="text-balance text-3xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl"
          >
            Why practitioners and biohackers choose VITALOOP
          </motion.h2>
        </motion.div>

        {/* Primary cards: 4-up on desktop, stacked below lg */}
        <motion.div
          variants={reduced ? {} : stagger(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={viewport('-40px')}
          className="grid grid-cols-1 gap-5 lg:grid-cols-4"
        >
          {primaryCards.map(({ Icon, title, body }) => (
            <motion.div
              key={title}
              variants={reduced ? {} : staggerChild}
              whileHover={reduced ? {} : { scale: 1.02, y: -2 }}
              transition={{ type: 'spring', stiffness: 340, damping: 22 }}
              className={cardClass}
            >
              <motion.div
                whileHover={reduced ? {} : { rotate: [0, -8, 8, 0] }}
                transition={{ duration: 0.35 }}
                className={iconWrapClass}
              >
                <Icon size={20} className="text-emerald-600" strokeWidth={1.8} />
              </motion.div>
              <div>
                <div className="mb-2 text-base font-semibold text-zinc-900">
                  {title}
                </div>
                <div className="text-sm leading-6 text-zinc-600">
                  {body}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Privacy card: full-width row on desktop, naturally stacked on tablet/mobile */}
        <motion.div
          variants={reduced ? {} : fadeUp}
          custom={0}
          initial="hidden"
          whileInView="visible"
          viewport={viewport('-40px')}
          className="mt-5"
        >
          <motion.div
            whileHover={reduced ? {} : { scale: 1.02, y: -2 }}
            transition={{ type: 'spring', stiffness: 340, damping: 22 }}
            className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-7 md:p-8"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <privacyCard.Icon size={20} className="text-emerald-600" strokeWidth={1.8} />
              </div>
              <div>
                <div className="mb-2 text-base font-semibold text-zinc-900">{privacyCard.title}</div>
                <div className="text-sm leading-6 text-zinc-700">{privacyCard.body}</div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Bottom tagline */}
        <motion.div
          variants={reduced ? {} : fadeUp}
          custom={0}
          initial="hidden"
          whileInView="visible"
          viewport={viewport('-40px')}
          className="mt-12 border-t border-zinc-200 pt-10 text-center"
        >
          <p className="mb-2 text-lg font-medium text-zinc-600 sm:text-xl md:text-2xl">
            Most people don't lack data — they lack clarity.
          </p>
          <p className="text-lg font-bold text-zinc-900 sm:text-xl md:text-2xl">
            VITALOOP gives you both.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
