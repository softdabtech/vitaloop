import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'

const ITEMS = [
  {
    q: 'How does VITALOOP read my lab results?',
    a: 'Our app uses Tesseract.js — an OCR engine running entirely in your browser. It reads your PDF or photo and extracts all biomarker names, values, and reference ranges. Your file is never uploaded to any server.',
  },
  {
    q: 'Which labs are supported?',
    a: 'Any lab worldwide. We officially test with Quest Diagnostics, LabCorp, SonoHealth, Synlab, and Eurofins. The AI handles any format, including non-English lab reports from EU, UAE, and Asian labs.',
  },
  {
    q: 'Is this a replacement for my doctor?',
    a: 'No. VITALOOP is a nutritional optimization tool, not medical software. We help you understand your existing lab results and suggest evidence-based supplement strategies. Always consult your physician for medical decisions.',
  },
  {
    q: 'How is my health data protected?',
    a: 'Your PDF never leaves your device — OCR runs client-side. We store only the extracted text values in encrypted Supabase databases with Row Level Security. No employee can access your data.',
  },
  {
    q: 'How often should I re-test?',
    a: 'We recommend every 90 days. This gives your body time to respond to the protocol. Most users see measurable improvement in 8–12 weeks.',
  },
  {
    q: 'Can I use results from multiple family members?',
    a: 'Each account tracks one individual. For family accounts, contact us — family plans are in development.',
  },
  {
    q: 'What if the AI misreads my lab?',
    a: 'You can always paste the text manually as a fallback, or correct individual biomarker values in the editor. The AI flags low-confidence readings for your review.',
  },
  {
    q: 'How do the iHerb partner links work?',
    a: 'When you click "Buy on iHerb" from your protocol, you\'re redirected with our affiliate code. You pay the same price — we earn a small commission that helps keep the app running. We never let affiliate relationships influence protocol recommendations.',
  },
]

export default function FAQ() {
  const [open, setOpen] = useState(null)

  return (
    <section style={{ padding: '120px 24px', background: 'var(--white)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--teal-500)', marginBottom: 16,
          }}>
            FAQ
          </div>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--gray-900)',
          }}>
            Common questions.
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
