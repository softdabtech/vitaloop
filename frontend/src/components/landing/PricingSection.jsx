import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'

const FREE_FEATURES = [
  { text: 'Upload 1 lab result',      included: true },
  { text: '3 biomarkers revealed',    included: true },
  { text: '1 deficiency flagged',     included: true },
  { text: 'Full protocol locked',     included: false },
  { text: 'Health Avatar locked',     included: false },
  { text: 'Progress tracking locked', included: false },
]

const CORE_FEATURES = [
  'Unlimited lab uploads',
  'All 50+ biomarkers',
  'Full AI supplement protocol',
  'Digital Health Avatar',
  'Progress tracking (unlimited history)',
  'iHerb & partner 1-click buy',
  '90-day re-test reminders',
  'Priority AI analysis (<60s)',
]

export default function PricingSection() {
  const navigate = useNavigate()
  const [isAnnual, setAnnual] = useState(false)

  const monthlyPrice = isAnnual ? 39 : 49

  return (
    <section id="pricing" style={{ padding: '120px 24px', background: 'var(--gray-50)' }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>

        {/* Header */}
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--teal-500)', marginBottom: 16,
          }}>
            Pricing
          </div>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--gray-900)', marginBottom: 20,
          }}>
            Simple. Transparent. Cancellable anytime.
          </h2>

          {/* Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <span style={{ fontSize: 15, color: !isAnnual ? 'var(--gray-900)' : 'var(--gray-500)', fontWeight: !isAnnual ? 600 : 400 }}>
              Monthly
            </span>
            <button
              role="switch"
              aria-checked={isAnnual}
              onClick={() => setAnnual((v) => !v)}
              style={{
                width: 48, height: 28, borderRadius: 980,
                background: isAnnual ? 'var(--teal-800)' : 'var(--gray-300)',
                border: 'none', cursor: 'pointer',
                position: 'relative', transition: 'background 200ms',
                flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: isAnnual ? 23 : 3,
                width: 22, height: 22, borderRadius: '50%',
                background: 'white', transition: 'left 200ms cubic-bezier(0.25,0.46,0.45,0.94)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              }} />
            </button>
            <span style={{ fontSize: 15, color: isAnnual ? 'var(--gray-900)' : 'var(--gray-500)', fontWeight: isAnnual ? 600 : 400 }}>
              Annual
              <span style={{
                marginLeft: 6, background: 'var(--teal-50)', color: 'var(--teal-600)',
                border: '0.5px solid var(--teal-300)', borderRadius: 6,
                fontSize: 11, fontWeight: 700, padding: '2px 7px',
              }}>
                save 20%
              </span>
            </span>
          </div>
        </div>

        {/* Cards */}
        <div className="reveal grid md:grid-cols-2 gap-6" style={{ marginBottom: 24 }}>

          {/* FREE card */}
          <div style={{
            background: 'white', borderRadius: 28,
            border: '0.5px solid var(--gray-100)', padding: '44px 36px',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', fontWeight: 500, marginBottom: 12 }}>Free</div>
            <div style={{ fontSize: 64, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 6 }}>
              $0
            </div>
            <div style={{ fontSize: 15, color: 'var(--gray-500)', marginBottom: 32 }}>See if VITALOOP is right for you</div>
            <ul style={{ listStyle: 'none', padding: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
              {FREE_FEATURES.map(({ text, included }) => (
                <li key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}>
                  {included
                    ? <Check size={15} style={{ color: 'var(--teal-500)', flexShrink: 0 }} aria-hidden="true" />
                    : <span aria-hidden="true" style={{ width: 15, height: 15, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-300)', fontSize: 14, fontWeight: 300 }}>–</span>
                  }
                  <span style={{ color: included ? 'var(--gray-700)' : 'var(--gray-300)' }}>{text}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'transparent',
                border: '1.5px solid var(--teal-500)',
                borderRadius: 980, padding: '14px',
                fontSize: 16, fontWeight: 600, color: 'var(--teal-600)',
                cursor: 'pointer', transition: 'background 200ms, color 200ms',
                width: '100%',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--teal-50)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              Start free
            </button>
          </div>

          {/* CORE card */}
          <div style={{
            background: 'var(--teal-800)', borderRadius: 28, padding: '44px 36px',
            display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
          }}>
            {/* Badge */}
            <div style={{
              position: 'absolute', top: 24, right: 24,
              background: 'var(--teal-500)', color: 'white',
              borderRadius: 6, padding: '3px 10px',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            }}>
              MOST POPULAR
            </div>

            <div style={{ fontSize: 13, color: 'var(--teal-100)', fontWeight: 500, marginBottom: 12 }}>Core</div>

            {/* Animated price */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
              <div
                key={monthlyPrice}
                style={{
                  fontSize: 64, fontWeight: 700, color: 'white', letterSpacing: '-0.04em', lineHeight: 1,
                  animation: 'countUp 0.3s ease',
                }}
              >
                ${monthlyPrice}
              </div>
              <div style={{ fontSize: 18, color: 'var(--teal-300)', marginBottom: 2 }}>/month</div>
            </div>
            {isAnnual && (
              <div style={{ fontSize: 12, color: 'var(--teal-100)', marginBottom: 4 }}>
                Billed ${monthlyPrice * 12}/year
              </div>
            )}
            <div style={{ fontSize: 15, color: 'white', marginBottom: 32 }}>
              Everything you need to optimize your biology
            </div>

            <ul style={{ listStyle: 'none', padding: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
              {CORE_FEATURES.map((text) => (
                <li key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: 'var(--teal-100)' }}>
                  <Check size={15} style={{ color: 'var(--teal-300)', flexShrink: 0 }} aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>

            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'white', color: 'var(--teal-800)',
                border: 'none', borderRadius: 980, padding: '14px',
                fontSize: 16, fontWeight: 700, cursor: 'pointer',
                transition: 'opacity 200ms, transform 200ms', width: '100%',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.92'; e.currentTarget.style.transform = 'scale(1.01)' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)' }}
            >
              Get started
            </button>
            <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: 'var(--teal-300)' }}>
              Cancel anytime · No commitment
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="reveal" style={{ textAlign: 'center', fontSize: 13, color: 'var(--gray-500)' }}>
          All plans include: HIPAA-ready data handling · No ads · No data selling
        </div>
      </div>
    </section>
  )
}
