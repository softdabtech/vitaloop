import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Check, Minus } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { stagger, staggerChild, cardHoverProps, viewport } from '../../lib/motion.js'

const PLANS = [
  {
    id: 'free',
    name: 'Free / Starter',
    monthly: '$0',
    yearly: '$0',
    period: '',
    desc: 'Start with core insights and evaluate your first reports.',
    badge: null,
    dark: false,
    cta: 'Start Free',
    features: [
      { text: '1-2 analyses per month',       ok: true  },
      { text: 'Basic flags and summary',      ok: true  },
      { text: 'Full protocols',               ok: false },
      { text: 'Timeline tracking',            ok: false },
      { text: 'Practitioner CRM tools',       ok: false },
    ],
  },
  {
    id: 'personal',
    name: 'Personal Pro',
    monthly: '$9.99',
    yearly: '$99',
    period: '/mo',
    annualNote: 'Save 17% on yearly billing',
    desc: 'Unlimited analysis with complete biomarker protocols and personal timeline.',
    badge: 'MOST POPULAR',
    dark: true,
    cta: 'Get Personal Pro',
    features: [
      { text: 'Unlimited analyses',            ok: true },
      { text: 'Full biomarker protocols',      ok: true },
      { text: 'Personalized recommendations',  ok: true },
      { text: 'Timeline tracking',             ok: true },
      { text: 'Priority product updates',      ok: true },
    ],
  },
  {
    id: 'practitioner',
    name: 'Practitioner Pro',
    monthly: '$29',
    yearly: '$299',
    period: '/mo',
    annualNote: 'Annual option available',
    desc: 'Everything in Personal plus CRM workflows and white-label reporting for practice use.',
    badge: 'FOR PROFESSIONALS',
    dark: false,
    premium: true,
    cta: 'Get Practitioner Pro',
    features: [
      { text: 'Everything in Personal Pro',      ok: true },
      { text: 'Built-in practitioner CRM',       ok: true },
      { text: 'White-label reports',             ok: true },
      { text: 'Up to 10 patients',               ok: true },
      { text: 'Team collaboration workflows',    ok: true },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthly: 'From $99',
    yearly: 'Custom',
    period: '/mo',
    annualNote: '5 seats included in entry plan',
    desc: 'Multi-tenancy CRM, API access, and security controls for organizations.',
    badge: null,
    dark: false,
    cta: 'Contact Sales',
    features: [
      { text: 'Full multi-tenancy CRM',         ok: true },
      { text: 'API access',                     ok: true },
      { text: 'Role-based organization control',ok: true },
      { text: 'Dedicated support',              ok: true },
      { text: 'Custom integrations',            ok: true },
    ],
  },
]

export default function PricingSection() {
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [billing, setBilling] = useState('monthly')

  const getPlanPrice = (plan) => {
    if (plan.id === 'enterprise' && billing === 'yearly') {
      return { value: plan.yearly, period: '' }
    }
    if (billing === 'yearly' && plan.id !== 'free') {
      return { value: plan.yearly, period: '/year' }
    }
    return { value: plan.monthly, period: plan.period }
  }

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
            Freemium pricing built for users and practitioners
          </motion.h2>
          <motion.p variants={reduced ? {} : staggerChild} style={{ fontSize: 17, color: 'var(--gray-500)', maxWidth: 460, margin: '0 auto', lineHeight: 1.65 }}>
            Start on Free, grow into Pro, and scale with multi-tenancy CRM when your organization is ready.
          </motion.p>
          <motion.div variants={reduced ? {} : staggerChild} style={{ marginTop: 20 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--teal-600)',
              background: 'rgba(16,185,129,0.08)',
              border: '0.5px solid var(--teal-300)',
              borderRadius: 980,
              padding: '6px 14px',
              fontWeight: 600,
            }}>
              80% ready - launching soon
            </span>
          </motion.div>
          <motion.div variants={reduced ? {} : staggerChild} style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
            <div style={{
              display: 'inline-flex',
              background: 'white',
              borderRadius: 980,
              border: '0.5px solid var(--gray-100)',
              padding: 4,
              gap: 4,
            }}>
              <button
                onClick={() => setBilling('monthly')}
                style={{
                  border: 'none',
                  borderRadius: 980,
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: billing === 'monthly' ? 'var(--teal-500)' : 'transparent',
                  color: billing === 'monthly' ? 'white' : 'var(--gray-600)',
                }}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('yearly')}
                style={{
                  border: 'none',
                  borderRadius: 980,
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: billing === 'yearly' ? 'var(--teal-500)' : 'transparent',
                  color: billing === 'yearly' ? 'white' : 'var(--gray-600)',
                }}
              >
                Yearly (save up to 17%)
              </button>
            </div>
          </motion.div>
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
          {PLANS.map((plan) => {
            const { id, name, annualNote, desc, badge, dark, premium, cta, features } = plan
            const display = getPlanPrice(plan)
            return (
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
                  {display.value}
                </span>
                {display.period && (
                  <span style={{
                    fontSize: 16,
                    color: dark ? 'var(--teal-300)' : 'var(--gray-400)',
                    marginBottom: 2,
                  }}>
                    {display.period}
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
                  className="btn-primary"
                  style={{
                    borderRadius: 980,
                    padding: '14px 24px',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
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
                >
                  {cta}
                </button>
              </motion.div>
            </motion.div>
          )})}
        </motion.div>

        {/* Footer note */}
        <motion.div
          variants={reduced ? {} : staggerChild}
          initial="hidden"
          whileInView="visible"
          viewport={viewport('-40px')}
          style={{ textAlign: 'center', fontSize: 13, color: 'var(--gray-500)' }}
        >
          All paid plans include secure storage, regular protocol updates, and onboarding support.
        </motion.div>

      </div>
    </section>
  )
}
