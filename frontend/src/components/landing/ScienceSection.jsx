import { useState, useEffect, useRef } from 'react'

const STATS = [
  { value: 50,    suffix: '+', label: 'biomarkers tracked' },
  { value: 60,    suffix: 's', label: 'average analysis time' },
  { value: 2400,  suffix: '+', label: 'users optimized' },
  { value: 90,    suffix: ' days', label: 'average re-test cycle' },
]

function useCountUp(target, duration = 1600, trigger) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!trigger) return
    let start = null
    const step = (ts) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      setCount(Math.floor(progress * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [trigger, target, duration])
  return count
}

function StatCounter({ value, suffix, label }) {
  const ref = useRef(null)
  const [triggered, setTriggered] = useState(false)
  const count = useCountUp(value, 1400, triggered)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setTriggered(true); obs.disconnect() } },
      { threshold: 0.5 }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ textAlign: 'center', padding: '0 24px' }}>
      <div style={{
        fontSize: 'clamp(40px, 5vw, 56px)', fontWeight: 700,
        color: 'var(--teal-500)', letterSpacing: '-0.03em', lineHeight: 1,
      }}>
        {count.toLocaleString()}{suffix}
      </div>
      <div style={{ fontSize: 15, color: 'var(--gray-500)', marginTop: 8 }}>{label}</div>
    </div>
  )
}

const CARDS = [
  {
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <circle cx="20" cy="20" r="19" stroke="var(--teal-300)" strokeWidth="0.5"/>
        <path d="M8 20 Q12 10 16 20 Q20 30 24 15 Q28 5 32 20" stroke="var(--teal-500)" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
        <circle cx="20" cy="12" r="3" fill="var(--teal-300)" opacity="0.6"/>
        <circle cx="28" cy="18" r="2" fill="var(--teal-500)" opacity="0.8"/>
        <circle cx="13" cy="24" r="2" fill="var(--teal-300)" opacity="0.6"/>
      </svg>
    ),
    title: 'Powered by Anthropic Claude',
    body: 'The same AI trusted by Fortune 500 companies interprets your lab data with clinical-grade precision. Structured prompts validated against 50+ biomarker reference databases.',
  },
  {
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M20 4 L6 10 L6 22 C6 30 13 36 20 38 C27 36 34 30 34 22 L34 10 Z" stroke="var(--teal-500)" strokeWidth="1.8" fill="var(--teal-50)"/>
        <path d="M13 20 L17 24 L27 14" stroke="var(--teal-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Your data never leaves your device',
    body: 'OCR processing runs entirely in your browser using Tesseract.js. Your PDF is never uploaded to our servers. Only extracted text is analyzed — never your personal health file.',
    badge: 'HIPAA-ready architecture',
  },
  {
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect x="6" y="4" width="28" height="32" rx="4" stroke="var(--teal-500)" strokeWidth="1.8" fill="var(--teal-50)"/>
        <line x1="12" y1="13" x2="28" y2="13" stroke="var(--teal-300)" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="12" y1="19" x2="28" y2="19" stroke="var(--teal-300)" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="12" y1="25" x2="22" y2="25" stroke="var(--teal-300)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Clinical evidence, not opinions',
    body: 'Supplement recommendations are derived from published clinical trials in PubMed, Cochrane reviews, and established laboratory reference ranges. No affiliate bias in protocol generation.',
  },
]

export default function ScienceSection() {
  return (
    <section id="science" style={{ padding: '120px 24px', background: 'var(--white)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* Header */}
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 80 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--teal-500)', marginBottom: 16,
          }}>
            The Science Behind It
          </div>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--gray-900)', marginBottom: 20,
          }}>
            Evidence-based. Not guesswork.
          </h2>
          <p style={{ fontSize: 17, color: 'var(--gray-500)', maxWidth: 560, margin: '0 auto', lineHeight: 1.65 }}>
            Every protocol recommendation cites peer-reviewed clinical research.
          </p>
        </div>

        {/* 3-column cards */}
        <div className="grid md:grid-cols-3 gap-6 stagger-children reveal" style={{ marginBottom: 80 }}>
          {CARDS.map(({ icon, title, body, badge }) => (
            <div
              key={title}
              style={{
                background: 'var(--white)', borderRadius: 24,
                border: '0.5px solid var(--gray-100)', padding: '36px 32px',
                transition: 'transform 300ms ease, border-color 300ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.borderColor = 'var(--teal-300)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.borderColor = 'var(--gray-100)'
              }}
            >
              <div style={{ marginBottom: 20 }}>{icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 12 }}>{title}</h3>
              <p style={{ fontSize: 15, color: 'var(--gray-500)', lineHeight: 1.65 }}>{body}</p>
              {badge && (
                <div style={{
                  marginTop: 16, display: 'inline-block',
                  background: 'var(--teal-50)', border: '0.5px solid var(--teal-300)',
                  borderRadius: 8, padding: '4px 10px',
                  fontSize: 11, fontWeight: 600, color: 'var(--teal-600)', letterSpacing: '0.06em',
                }}>
                  {badge}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div
          className="reveal"
          style={{
            display: 'flex', justifyContent: 'center', flexWrap: 'wrap',
            gap: 0,
            background: 'var(--gray-50)', borderRadius: 24,
            border: '0.5px solid var(--gray-100)', padding: '48px 0',
          }}
        >
          {STATS.map(({ value, suffix, label }, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'stretch' }}>
              <StatCounter value={value} suffix={suffix} label={label} />
              {i < STATS.length - 1 && (
                <div style={{ width: '0.5px', background: 'var(--gray-100)', margin: '8px 0' }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
