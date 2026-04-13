import { useState, useEffect, useRef } from 'react'
import { GitMerge, Sliders, BookOpen, Lock } from 'lucide-react'

const STATS = [
  { value: 50,  suffix: '+', label: 'biomarkers tracked' },
  { value: 60,  suffix: 's', label: 'average analysis time' },
  { value: 100, suffix: '+', label: 'users optimized' },
  { value: 90,  suffix: ' days', label: 'average re-test cycle' },
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
    Icon: GitMerge,
    label: 'Pattern-based approach',
    title: 'We don\'t just read your labs — we connect the dots',
    body: 'Your results, symptoms, and lifestyle are analyzed together to reveal patterns most systems miss.',
  },
  {
    Icon: Sliders,
    label: 'Deep personalization',
    title: 'Your protocol adapts to you',
    body: 'Every recommendation is refined using your answers, habits, and real-world feedback — not generic templates.',
  },
  {
    Icon: BookOpen,
    label: 'Built from real practice',
    title: 'Built from years of real-world experience',
    body: 'Our methodology is based on years of work by nutrition specialists, combining lab data, symptoms, and behavioral patterns.',
  },
]

export default function ScienceSection() {
  return (
    <section id="science" style={{ padding: 'var(--py-lg) 24px', background: 'var(--white)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* Header */}
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 80 }}>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--gray-900)', marginBottom: 20,
          }}>
            Why VITALOOP works differently
          </h2>
        </div>

        {/* 3-column differentiation cards */}
        <div className="grid md:grid-cols-3 gap-6 stagger-children reveal" style={{ marginBottom: 48 }}>
          {CARDS.map(({ Icon, label, title, body }) => (
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
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(16,185,129,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20,
              }}>
                <Icon size={22} color="var(--teal-500)" strokeWidth={1.8} />
              </div>
              <div style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'var(--teal-500)', marginBottom: 10,
              }}>
                {label}
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 12, lineHeight: 1.35 }}>
                {title}
              </h3>
              <p style={{ fontSize: 15, color: 'var(--gray-500)', lineHeight: 1.65, margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>

        {/* Bottom 2-up trust cards */}
        <div className="grid md:grid-cols-2 gap-6 reveal" style={{ marginBottom: 80 }}>
          {/* Privacy */}
          <div style={{
            borderRadius: 20, padding: '28px 32px',
            background: 'var(--gray-50)', border: '0.5px solid var(--gray-100)',
            display: 'flex', gap: 16, alignItems: 'flex-start',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: 'rgba(16,185,129,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Lock size={20} color="var(--teal-500)" strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 6 }}>
                Privacy-first by design
              </div>
              <p style={{ fontSize: 14, color: 'var(--gray-500)', lineHeight: 1.65, margin: 0 }}>
                Your lab data is processed securely, and your personal information is protected at every step.
              </p>
            </div>
          </div>

          {/* Science-informed */}
          <div style={{
            borderRadius: 20, padding: '28px 32px',
            background: 'var(--gray-50)', border: '0.5px solid var(--gray-100)',
            display: 'flex', gap: 16, alignItems: 'flex-start',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: 'rgba(16,185,129,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BookOpen size={20} color="var(--teal-500)" strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 6 }}>
                Science-informed recommendations
              </div>
              <p style={{ fontSize: 14, color: 'var(--gray-500)', lineHeight: 1.65, margin: 0 }}>
                Our suggestions are based on established research, reference ranges, and practitioner knowledge.
              </p>
            </div>
          </div>
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
