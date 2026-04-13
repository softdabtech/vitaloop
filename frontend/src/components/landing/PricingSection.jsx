import { useNavigate } from 'react-router-dom'
import { Check, Minus } from 'lucide-react'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: null,
    desc: 'Try VITALOOP and see how it works',
    badge: null,
    dark: false,
    cta: 'Get started free',
    features: [
      { text: 'Upload 1 lab result',       ok: true  },
      { text: 'Limited biomarker insights', ok: true  },
      { text: 'Basic issue detection',      ok: true  },
      { text: 'Full protocol',              ok: false },
      { text: 'Progress tracking',          ok: false },
      { text: 'Supplement recommendations', ok: false },
    ],
  },
  {
    id: 'core',
    name: 'Core',
    price: '$29',
    period: '/month',
    desc: 'Your complete health optimization system',
    badge: 'MOST POPULAR',
    dark: true,
    cta: 'Start free analysis',
    features: [
      { text: 'Unlimited lab uploads',        ok: true },
      { text: 'Full biomarker analysis',       ok: true },
      { text: 'Personalized protocol',         ok: true },
      { text: 'Adaptive questionnaire',        ok: true },
      { text: 'Progress tracking',             ok: true },
      { text: 'Supplement recommendations',    ok: true },
      { text: 'Re-test reminders',             ok: true },
    ],
  },
  {
    id: 'personal',
    name: 'Personal',
    price: '$99',
    period: '/month',
    desc: 'Work 1:1 with experienced nutrition specialists to refine and adjust your protocol over time.',
    badge: 'PREMIUM',
    dark: false,
    premium: true,
    cta: 'Apply for Personal',
    features: [
      { text: 'Everything in Core',                              ok: true },
      { text: '1:1 guidance from vetted specialists',            ok: true },
      { text: 'Protocol adjustments based on feedback',          ok: true },
      { text: 'Priority support',                                ok: true },
      { text: 'Deeper personalization',                          ok: true },
    ],
  },
]

export default function PricingSection() {
  const navigate = useNavigate()

  return (
    <section id="pricing" style={{ padding: '120px 24px', background: 'var(--gray-50)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* Header */}
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 64 }}>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--gray-900)', marginBottom: 16,
          }}>
            Simple. Transparent. Cancellable anytime.
          </h2>
          <p style={{ fontSize: 17, color: 'var(--gray-500)', maxWidth: 460, margin: '0 auto', lineHeight: 1.65 }}>
            Start free. Upgrade when you're ready.
          </p>
        </div>

        {/* Cards */}
        <div
          className="reveal"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
            alignItems: 'start',
            marginBottom: 36,
          }}
        >
          {PLANS.map(({ id, name, price, period, desc, badge, dark, premium, cta, features }) => (
            <div
              key={id}
              style={{
                borderRadius: 28,
                padding: '44px 36px',
                display: 'flex',
                flexDirection: 'column',
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
              }}
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
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 8 }}>
                <span style={{
                  fontSize: 56, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1,
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
                onClick={() => navigate('/login')}
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
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)' }}
              >
                {cta}
              </button>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="reveal" style={{ textAlign: 'center', fontSize: 13, color: 'var(--gray-500)' }}>
          Secure. Private. No data selling.
        </div>

      </div>
    </section>
  )
}
