import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const TESTIMONIALS = [
  {
    quote: "I finally understood why I felt constantly tired. The protocol was simple and actually worked.",
    name: 'Alex', age: 34, tag: 'Energy · Vitamin D',
    initials: 'AL',
  },
  {
    quote: "Stopped wasting money on random supplements. Now I know exactly what I need.",
    name: 'Nina', age: 29, tag: 'Iron · Focus',
    initials: 'NI',
  },
  {
    quote: "Discovered low ferritin I didn't even think about. Fixed it in a few weeks.",
    name: 'James', age: 41, tag: 'Ferritin · Sleep',
    initials: 'JA',
  },
  {
    quote: "The questionnaire was surprisingly accurate — it caught things my tests didn't.",
    name: 'Maria', age: 36, tag: 'Brain fog · Magnesium',
    initials: 'MA',
  },
  {
    quote: "I'd been dealing with afternoon crashes forever. Turns out it was a B12 issue. Simple fix.",
    name: 'Tom', age: 27, tag: 'Energy · B12',
    initials: 'TO',
  },
  {
    quote: "My sleep was terrible for two years. VITALOOP connected the dots between my labs and lifestyle.",
    name: 'Sarah', age: 38, tag: 'Sleep · Cortisol',
    initials: 'SA',
  },
  {
    quote: "I thought I was just stressed. Turned out my iron was borderline low. One month in and I feel different.",
    name: 'Dmitri', age: 33, tag: 'Stress · Iron',
    initials: 'DM',
  },
  {
    quote: "What I liked most: no generic advice. Every suggestion matched my actual numbers.",
    name: 'Yuki', age: 31, tag: 'Personalization · Omega-3',
    initials: 'YU',
  },
  {
    quote: "Finally a tool that doesn't tell me to 'eat more vegetables.' It told me exactly what was off.",
    name: 'Priya', age: 45, tag: 'Thyroid · Vitamin D',
    initials: 'PR',
  },
  {
    quote: "Uploaded my lab PDF and had a clear picture in under 5 minutes. That alone was worth it.",
    name: 'Lucas', age: 30, tag: 'Brain fog · Zinc',
    initials: 'LU',
  },
]

const VISIBLE = 3

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
    <section style={{ padding: 'var(--py-lg) 24px', background: 'var(--white)', overflow: 'hidden' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* Header */}
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 64 }}>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--gray-900)',
          }}>
            Real experiences from early users
          </h2>
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
                  style={{
                    width: i === index ? 20 : 6,
                    height: 6, borderRadius: 3,
                    background: i === index ? 'var(--teal-500)' : 'var(--gray-200)',
                    border: 'none', padding: 0, cursor: 'pointer',
                    transition: 'width 300ms ease, background 300ms ease',
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
