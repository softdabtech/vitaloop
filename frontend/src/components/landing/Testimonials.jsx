import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const TESTIMONIALS = [
  {
    quote: 'I finally understood the root cause of persistent fatigue. The protocol was clear and practical.',
    name: 'Alex', age: 34, tag: 'Energy · Vitamin D',
    initials: 'AL',
  },
  {
    quote: 'I stopped guessing with supplements. Now every action is tied to my actual markers.',
    name: 'Nina', age: 29, tag: 'Iron · Focus',
    initials: 'NI',
  },
  {
    quote: 'VITALOOP highlighted low ferritin early. I corrected it before it became a larger issue.',
    name: 'James', age: 41, tag: 'Ferritin · Sleep',
    initials: 'JA',
  },
  {
    quote: 'The context questions were highly relevant and improved the quality of recommendations.',
    name: 'Maria', age: 36, tag: 'Brain fog · Magnesium',
    initials: 'MA',
  },
  {
    quote: 'I had recurring afternoon crashes. The analysis identified a B12 pattern quickly.',
    name: 'Tom', age: 27, tag: 'Energy · B12',
    initials: 'TO',
  },
  {
    quote: 'Sleep improved once my labs and habits were reviewed together, not in isolation.',
    name: 'Sarah', age: 38, tag: 'Sleep · Cortisol',
    initials: 'SA',
  },
  {
    quote: 'What looked like stress was a biomarker imbalance. The protocol made progress visible within weeks.',
    name: 'Dmitri', age: 33, tag: 'Stress · Iron',
    initials: 'DM',
  },
  {
    quote: 'No generic advice. Recommendations were tied directly to my data.',
    name: 'Yuki', age: 31, tag: 'Personalization · Omega-3',
    initials: 'YU',
  },
  {
    quote: 'The platform explained exactly what needed attention and in what order.',
    name: 'Priya', age: 45, tag: 'Thyroid · Vitamin D',
    initials: 'PR',
  },
  {
    quote: 'I uploaded a lab PDF and had a structured action plan in minutes.',
    name: 'Lucas', age: 30, tag: 'Brain fog · Zinc',
    initials: 'LU',
  },
]

const VISIBLE = 3
const METRIC_TILES = [
  { label: 'Energy score', before: '54', after: '78', unit: '%' },
  { label: 'Sleep quality', before: '61', after: '82', unit: '%' },
  { label: 'Focus stability', before: '48', after: '73', unit: '%' },
  { label: 'Stress load', before: '71', after: '49', unit: '%' },
]

export default function Testimonials() {
  const [index, setIndex] = useState(0)
  const timerRef = useRef(null)
  const total = TESTIMONIALS.length

  const next = useCallback(() => setIndex((i) => (i + 1) % total), [total])
  const prev = useCallback(() => setIndex((i) => (i - 1 + total) % total), [total])

  // Auto-advance every 5 s
  useEffect(() => {
    timerRef.current = setInterval(next, 5000)
    return () => clearInterval(timerRef.current)
  }, [next])

  const resetTimer = () => {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(next, 5000)
  }

  const handleNext = () => { next(); resetTimer() }
  const handlePrev = () => { prev(); resetTimer() }

  // Build visible window (cyclic)
  const visible = Array.from({ length: VISIBLE }, (_, i) => TESTIMONIALS[(index + i) % total])

  return (
    <section id="stories" style={{ padding: 'var(--py-lg) 24px', backgroundColor: 'var(--white)', overflow: 'hidden' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* Header */}
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--teal-500)',
            marginBottom: 16,
          }}>
            User stories
          </div>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--gray-900)', marginBottom: 16,
          }}>
            Early users are already seeing measurable gains
          </h2>
          <p style={{ fontSize: 17, color: 'var(--gray-500)', maxWidth: 620, margin: '0 auto', lineHeight: 1.65 }}>
            Individuals gain clarity faster, while practitioners deliver higher-quality protocols in less time.
          </p>
        </div>

        {/* Slider */}
        <div style={{ position: 'relative' }}>
          {/* Cards row */}
          <div
            className="testimonial-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 20,
            }}
          >
            {visible.map(({ quote, name, age, tag, initials }, i) => {
              const isCenter = i === 1
              const metric = METRIC_TILES[(index + i) % METRIC_TILES.length]
              return (
                <div
                  key={`${name}-${index}-${i}`}
                  style={{
                    background: 'var(--white)',
                    borderRadius: 24,
                    border: isCenter
                      ? '1px solid var(--teal-300)'
                      : '0.5px solid var(--gray-100)',
                    padding: '32px 28px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: isCenter
                      ? '0 8px 32px rgba(16,185,129,0.12)'
                      : '0 2px 8px rgba(0,0,0,0.04)',
                    transform: isCenter ? 'translateY(-6px)' : 'translateY(0)',
                    opacity: isCenter ? 1 : 0.72,
                    transition: 'transform 400ms ease, opacity 400ms ease, box-shadow 400ms ease',
                  }}
                >
                  {/* Quote mark */}
                  <div style={{
                    fontSize: 40, lineHeight: 1, color: 'var(--teal-300)',
                    marginBottom: 6, fontFamily: 'Georgia, serif',
                  }}>"</div>

                  {/* Quote */}
                  <blockquote style={{
                    flex: 1,
                    fontSize: 15, color: 'var(--gray-700)',
                    lineHeight: 1.7, margin: '0 0 24px',
                    fontStyle: 'italic',
                  }}>
                    {quote}
                  </blockquote>

                  <div style={{
                    background: 'var(--teal-50)',
                    border: '0.5px solid var(--teal-300)',
                    borderRadius: 12, padding: '14px 16px', marginBottom: 20,
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--teal-600)' }}>
                      {metric.label}
                      <span style={{
                        color: 'var(--teal-600)', marginLeft: 4,
                        fontWeight: 700, fontSize: 11,
                      }}>↑</span>
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal-600)' }}>
                      {metric.before !== '—' ? `${metric.before} → ` : ''}{metric.after} {metric.unit}
                    </span>
                  </div>

                  {/* Tag */}
                  <div style={{
                    display: 'inline-block',
                    background: 'rgba(16,185,129,0.08)',
                    border: '0.5px solid var(--teal-300)',
                    borderRadius: 8, padding: '4px 10px',
                    fontSize: 11, fontWeight: 600,
                    color: 'var(--teal-600)',
                    letterSpacing: '0.04em',
                    marginBottom: 20,
                    alignSelf: 'flex-start',
                  }}>
                    {tag}
                  </div>

                  {/* Stars */}
                  <div style={{ color: 'var(--teal-500)', fontSize: 13, marginBottom: 14 }}>★★★★★</div>

                  {/* Author */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--teal-800)', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700,
                    }}>
                      {initials}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-900)' }}>{name}, {age}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Arrows */}
          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            gap: 16, marginTop: 40,
          }}>
            <button
              onClick={handlePrev}
              aria-label="Previous"
              style={{
                width: 44, height: 44, borderRadius: '50%',
                border: '0.5px solid var(--gray-100)',
                background: 'var(--white)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                transition: 'border-color 200ms, background 200ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--teal-300)'; e.currentTarget.style.background = 'var(--teal-50)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--gray-100)'; e.currentTarget.style.background = 'var(--white)' }}
            >
              <ChevronLeft size={18} color="var(--gray-500)" />
            </button>

            {/* Dots */}
            <div style={{ display: 'flex', gap: 6 }}>
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setIndex(i); resetTimer() }}
                  aria-label={`Go to testimonial ${i + 1}`}
                  className="inline-icon"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: i === index ? 'var(--teal-500)' : 'var(--gray-200)',
                    border: 'none', padding: 0, cursor: 'pointer',
                    transition: 'background 300ms ease, transform 300ms ease',
                    transform: i === index ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              aria-label="Next"
              style={{
                width: 44, height: 44, borderRadius: '50%',
                border: '0.5px solid var(--gray-100)',
                background: 'var(--white)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                transition: 'border-color 200ms, background 200ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--teal-300)'; e.currentTarget.style.background = 'var(--teal-50)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--gray-100)'; e.currentTarget.style.background = 'var(--white)' }}
            >
              <ChevronRight size={18} color="var(--gray-500)" />
            </button>
          </div>
        </div>

      </div>
    </section>
  )
}
