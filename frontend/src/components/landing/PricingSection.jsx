import { useNavigate } from 'react-router-dom'
import { Check, Minus } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { stagger, staggerChild, cardHoverProps, viewport } from '../../lib/motion.js'

const PLANS = [
  {
    id: 'free',
    name: 'Free / Starter',
    price: '$0',
    period: null,
    desc: 'Try the platform — no card required.',
    badge: null,
    dark: false,
    cta: 'Start free',
    features: [
      { text: '1–2 analyses per month',        ok: true  },
      { text: 'Basic flags & summary',          ok: true  },
      { text: 'Full biomarker protocols',       ok: false },
      { text: 'Progress timeline',              ok: false },
      { text: 'Exports',                        ok: false },
    ],
  },
  {
    id: 'personal',
    name: 'Personal Pro',
    price: '$9.99',
    period: '/month',
    annualNote: 'or $99 / year — save 17%',
    desc: 'Full optimization system for biohackers & individuals.',
    badge: 'MOST POPULAR',
    dark: true,
    cta: 'Start free analysis',
    features: [
      { text: 'Unlimited analyses',             ok: true },
      { text: 'Full biomarker analysis',        ok: true },
      { text: 'Personalized protocols',         ok: true },
      { text: 'Progress timeline tracking',     ok: true },
      { text: 'Exports',                        ok: true },
    ],
  },
  {
    id: 'practitioner',
    name: 'Practitioner Pro',
    price: '$29',
    period: '/month',
    annualNote: 'or $299 / year',
    desc: 'Everything in Personal · built for doctors, nutritionists & coaches.',
    badge: 'FOR PROFESSIONALS',
    dark: false,
    premium: true,
    cta: 'Get Practitioner Pro',
    features: [
      { text: 'Everything in Personal Pro',          ok: true },
      { text: 'CRM with patient assignment',         ok: true },
      { text: 'White-label reports',                 ok: true },
      { text: 'Up to 10 patients',                   ok: true },
      { text: 'Priority support',                    ok: true },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'From $99',
    period: '/month',
    annualNote: '5 seats included',
    desc: 'Full multi-tenancy for clinics & organizations.',
    badge: null,
    dark: false,
    cta: 'Contact us',
    features: [
      { text: 'Full multi-tenancy',             ok: true },
      { text: 'API access',                     ok: true },
      { text: 'Bulk analysis',                  ok: true },
      { text: 'Dedicated support',              ok: true },
      { text: 'Custom integrations',            ok: true },
    ],
  },
]

export default function PricingSection() {
  const navigate = useNavigate()
  const reduced = useReducedMotion()

  return (
    <section id="pricing" style={{ padding: 'var(--py-lg) 24px', background: 'var(--gray-50)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* Header */}
        <motion.div
          variants={reduced ? {} : stagger(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={viewport('-60px')}
          style={{ textAlign: 'center', marginBottom: 64 }}
        >
          <motion.div variants={reduced ? {} : staggerChild} style={{
            fontSize: 12, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--teal-500)', marginBottom: 16,
          }}>
            Pricing
          </motion.div>
          <motion.h2 variants={reduced ? {} : staggerChild} style={{
            fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--gray-900)', marginBottom: 16,
          }}>
            Simple, transparent pricing. Cancel anytime.
          </motion.h2>
          <motion.p variants={reduced ? {} : staggerChild} style={{ fontSize: 17, color: 'var(--gray-500)', maxWidth: 460, margin: '0 auto', lineHeight: 1.65 }}>
            Start free. Upgrade when you need unlimited access and advanced tools.
          </motion.p>
        </motion.div>

        {/* Cards */}
        <motion.div
          variants={reduced ? {} : stagger(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={viewport('-40px')}
          className="pricing-scroll-wrapper grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6"
          style={{ marginBottom: 36 }}
        >
          {PLANS.map(({ id, name, price, period, annualNote, desc, badge, dark, premium, cta, features }) => (
            <motion.div
              key={id}
              variants={reduced ? {} : staggerChild}
            >
              <motion.div
                style={{
                  borderRadius: 28,
                  padding: '44px 36px',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                  background: dark
                    ? 'var(--teal-800)'
                    : premium
                    ? 'var(--white)'
                    : 'var(--white)',
                  border: dark
                    ? 'none'
                    : premium
                    ? '1px solid rgba(16,185,129,0.35)'
                    : '0.5px solid var(--gray-100)',
                  boxShadow: dark
                    ? '0 12px 40px rgba(16,185,129,0.18)'
                    : premium
                    ? '0 4px 20px rgba(16,185,129,0.08)'
                    : 'none',
                  transition: 'transform 220ms ease, box-shadow 220ms ease',
                }}
                {...(reduced ? {} : cardHoverProps)}
              >
              {/* Badge */}
              {badge && (
                <div style={{
                  position: 'absolute', top: 24, right: 24,
                  background: dark ? 'var(--teal-500)' : 'rgba(16,185,129,0.1)',
                  color: dark ? 'white' : 'var(--teal-600)',
                  border: dark ? 'none' : '0.5px solid var(--teal-300)',
                  borderRadius: 6, padding: '3px 10px',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                }}>
                  {badge}
                </div>
              )}

              {/* Plan name */}
              <div style={{
                fontSize: 13, fontWeight: 600, marginBottom: 12,
                color: dark ? 'var(--teal-100)' : 'var(--gray-500)',
              }}>
                {name}
              </div>

              {/* Price */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 4 }}>
                <span style={{
                  fontSize: 48, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1,
                  color: dark ? 'white' : 'var(--gray-900)',
                }}>
                  {price}
                </span>
                {period && (
                  <span style={{
                    fontSize: 16,
                    color: dark ? 'var(--teal-300)' : 'var(--gray-400)',
                    marginBottom: 2,
                  }}>
                    {period}
                  </span>
                )}
              </div>
              {annualNote && (
                <div style={{ fontSize: 12, color: dark ? 'var(--teal-200)' : 'var(--teal-600)', marginBottom: 16 }}>
                  {annualNote}
                </div>
              )}

              {/* Description */}
              <p style={{
                fontSize: 14, lineHeight: 1.65, marginBottom: 32,
                color: dark ? 'var(--teal-100)' : 'var(--gray-500)',
              }}>
                {desc}
              </p>

              {/* Features */}
              <ul style={{ listStyle: 'none', padding: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 36 }}>
                {features.map(({ text, ok }) => (
                  <li key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                    {ok
                      ? <Check size={14} style={{ color: dark ? 'var(--teal-300)' : 'var(--teal-500)', flexShrink: 0 }} aria-hidden="true" />
                      : <Minus size={14} style={{ color: dark ? 'rgba(255,255,255,0.2)' : 'var(--gray-300)', flexShrink: 0 }} aria-hidden="true" />
                    }
                    <span style={{ color: ok ? (dark ? 'var(--teal-100)' : 'var(--gray-700)') : (dark ? 'rgba(255,255,255,0.3)' : 'var(--gray-300)') }}>
                      {text}
                    </span>
                  </li>
                ))}
              </ul>

                {/* CTA */}
                <button
                  onClick={() => {
                    if (id === 'enterprise') {
                      const subject = encodeURIComponent('Enterprise Plan Inquiry')
                      window.location.href = `mailto:info@softdab.tech?subject=${subject}`
                      return
                    }
                    if (id === 'practitioner') {
                      const subject = encodeURIComponent('Practitioner Pro Application')
                      const body = encodeURIComponent(
                        'Hi VITALOOP team,\n\nI am interested in the Practitioner Pro plan.\n\n' +
                        'Name:\nSpecialty:\nNumber of patients:\n\nPlease contact me.'
                      )
                      window.location.href = `mailto:info@softdab.tech?subject=${subject}&body=${body}`
                      return
                    }
                    navigate('/login?signup=true')
                  }}
                  style={{
                    borderRadius: 980,
                    padding: '14px 24px',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
                    transition: 'opacity 200ms, transform 200ms',
                    background: dark
                      ? 'white'
                      : premium
                      ? 'var(--teal-500)'
                      : 'var(--gray-100)',
                    color: dark
                      ? 'var(--teal-800)'
                      : premium
                      ? 'white'
                      : 'var(--gray-700)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'scale(1.02)' }}
                >
                  {cta}
                </button>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>

        {/* Footer note */}
        <motion.div
          variants={reduced ? {} : staggerChild}
          initial="hidden"
          whileInView="visible"
          viewport={viewport('-40px')}
          style={{ textAlign: 'center', fontSize: 13, color: 'var(--gray-500)' }}
        >
          All paid plans include secure data storage, priority support, and regular protocol updates.
        </motion.div>

      </div>
    </section>
  )
}
