import { TrendingUp, DollarSign, Clock, BarChart2, ShieldCheck } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { stagger, staggerChild, fadeUp, viewport } from '../../lib/motion.js'

const CARDS = [
  {
    Icon: BarChart2,
    title: 'Deeper insights',
    body: 'More actionable than any generic AI tool — 50+ biomarkers with context, flags, and personalized protocols.',
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

  return (
    <section
      id="why-vitaloop"
      style={{
        backgroundColor: 'var(--white)',
        padding: 'var(--py-md) 24px',
      }}
    >
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        {/* Header */}
        <motion.div
          variants={reduced ? {} : stagger(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={viewport('-60px')}
          style={{ textAlign: 'center', marginBottom: 56 }}
        >
          <motion.div variants={reduced ? {} : staggerChild} style={{
            fontSize: 12, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--teal-500)', marginBottom: 16,
          }}>
            Why VITALOOP
          </motion.div>
          <motion.h2
            variants={reduced ? {} : staggerChild}
            style={{
              fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700,
              color: 'var(--gray-900)', letterSpacing: '-0.5px', lineHeight: 1.2, margin: 0,
            }}
          >
            Why practitioners and biohackers choose VITALOOP
          </motion.h2>
        </motion.div>

        {/* Cards grid */}
        <motion.div
          variants={reduced ? {} : stagger(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={viewport('-40px')}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 20,
          }}
        >
          {CARDS.map(({ Icon, title, body }) => (
            <motion.div
              key={title}
              variants={reduced ? {} : staggerChild}
              whileHover={reduced ? {} : { scale: 1.025, boxShadow: '0 8px 28px rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.25)' }}
              transition={{ type: 'spring', stiffness: 340, damping: 22 }}
              style={{
                background: 'var(--gray-50, #f9fafb)',
                border: '0.5px solid rgba(0,0,0,0.07)',
                borderRadius: 16,
                padding: '28px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                cursor: 'default',
              }}
            >
              <motion.div
                whileHover={reduced ? {} : { rotate: [0, -8, 8, 0] }}
                transition={{ duration: 0.35 }}
                style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(16,185,129,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <Icon size={20} color="var(--teal-500)" strokeWidth={1.8} />
              </motion.div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 6 }}>
                  {title}
                </div>
                <div style={{ fontSize: 14, color: 'var(--gray-500)', lineHeight: 1.6 }}>
                  {body}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom tagline */}
        <motion.div
          variants={reduced ? {} : fadeUp}
          custom={0}
          initial="hidden"
          whileInView="visible"
          viewport={viewport('-40px')}
          style={{ marginTop: 56, textAlign: 'center', borderTop: '0.5px solid rgba(0,0,0,0.07)', paddingTop: 40 }}
        >
          <p
            style={{
              fontSize: 'clamp(18px, 2.5vw, 24px)',
              fontWeight: 500,
              color: 'var(--gray-500)',
              margin: '0 0 8px',
            }}
          >
            Most people don't lack data — they lack clarity.
          </p>
          <p
            style={{
              fontSize: 'clamp(18px, 2.5vw, 24px)',
              fontWeight: 700,
              color: 'var(--gray-900)',
              margin: 0,
            }}
          >
            VITALOOP gives you both.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
