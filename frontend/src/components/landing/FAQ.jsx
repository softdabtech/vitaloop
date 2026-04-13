import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'

const ITEMS = [
  {
    q: 'How does VITALOOP work?',
    a: 'You upload your lab results, answer a few personalized questions, and receive a clear protocol based on your data, symptoms, and lifestyle.',
  },
  {
    q: 'Is this medical advice?',
    a: 'No. VITALOOP provides wellness recommendations based on data and patterns. It does not replace professional medical advice.',
  },
  {
    q: 'What kind of lab tests can I upload?',
    a: 'You can upload results from any lab. Our system supports most standard blood panels and expands over time.',
  },
  {
    q: 'How is this different from other health apps?',
    a: 'Most apps show data. VITALOOP helps you understand it, prioritize issues, and take action with a clear protocol.',
  },
  {
    q: 'How personalized is it?',
    a: 'Your protocol is based on your lab data, symptoms, lifestyle, and answers from an adaptive questionnaire — not generic templates.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. Your data is processed securely and never sold. Privacy is a core part of the system design.',
  },
  {
    q: 'Do I need to take supplements?',
    a: 'Not necessarily. Recommendations may include nutrition, lifestyle adjustments, and supplements when relevant.',
  },
  {
    q: 'How quickly will I see results?',
    a: 'It depends on the issue, but many users start noticing improvements within a few weeks when following the protocol consistently.',
  },
]

export default function FAQ() {
  const [open, setOpen] = useState(null)

  return (
    <section style={{ padding: 'var(--py-lg) 24px', background: 'var(--white)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 64 }}>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--gray-900)',
          }}>
            Questions before you start?
          </h2>
        </div>

        {/* Accordion */}
        <div className="reveal">
          {ITEMS.map(({ q, a }, i) => {
            const isOpen = open === i
            return (
              <div key={q}>
                <div style={{ borderTop: '0.5px solid var(--gray-100)' }} />
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', padding: '20px 0',
                    background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', gap: 16,
                  }}
                >
                  <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--gray-900)', lineHeight: 1.4 }}>
                    {q}
                  </span>
                  <span style={{
                    color: 'var(--teal-500)', flexShrink: 0,
                    transform: isOpen ? 'rotate(0deg)' : 'rotate(0deg)',
                    transition: 'transform 300ms',
                  }}>
                    {isOpen
                      ? <Minus size={20} aria-hidden="true" />
                      : <Plus  size={20} aria-hidden="true" />
                    }
                  </span>
                </button>
                <div
                  style={{
                    maxHeight: isOpen ? 400 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  }}
                >
                  <p style={{
                    fontSize: 16, color: 'var(--gray-500)', lineHeight: 1.65,
                    paddingBottom: 20, margin: 0,
                  }}>
                    {a}
                  </p>
                </div>
              </div>
            )
          })}
          <div style={{ borderTop: '0.5px solid var(--gray-100)' }} />
        </div>
      </div>
    </section>
  )
}
