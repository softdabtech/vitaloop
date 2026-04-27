import { useState } from 'react'
import { ChevronRight, X, Lightbulb } from 'lucide-react'

/**
 * Dismissable multi-step hint banner for first-time visitors.
 *
 * Props:
 *   hints   — string[]  — list of hint texts (one per step)
 *   onDone  — () => void — called when user completes or skips all hints
 */
export default function HintBanner({ hints, onDone }) {
  const [step, setStep] = useState(0)
  const total = hints.length

  function next() {
    if (step < total - 1) {
      setStep((s) => s + 1)
    } else {
      onDone()
    }
  }

  return (
    <div
      style={{
        marginBottom: 20,
        borderRadius: 16,
        border: '1px solid rgba(16,185,129,0.28)',
        background: 'linear-gradient(135deg, rgba(16,185,129,0.07) 0%, rgba(255,255,255,0.92) 100%)',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        position: 'relative',
      }}
    >
      {/* Icon */}
      <div style={{
        flexShrink: 0, marginTop: 2,
        width: 30, height: 30, borderRadius: '50%',
        background: 'rgba(16,185,129,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Lightbulb size={15} color="#10b981" />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#059669' }}>
            Tip {step + 1} of {total}
          </span>
          {/* Dot progress */}
          <div style={{ display: 'flex', gap: 4 }}>
            {hints.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? 16 : 6, height: 6, borderRadius: 3,
                  background: i <= step ? '#10b981' : 'rgba(15,23,42,0.1)',
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: '#1e293b', lineHeight: 1.55 }}>
          {hints[step]}
        </p>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={next}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: '#10b981', color: '#fff',
              border: 'none', borderRadius: 8,
              padding: '7px 14px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {step < total - 1 ? 'Next' : 'Got it'}
            {step < total - 1 && <ChevronRight size={13} />}
          </button>
          {step === 0 && total > 1 && (
            <button
              onClick={onDone}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#94a3b8' }}
            >
              Skip all tips
            </button>
          )}
        </div>
      </div>

      {/* Close */}
      <button
        onClick={onDone}
        aria-label="Dismiss hints"
        style={{
          position: 'absolute', top: 10, right: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#94a3b8', padding: 4, lineHeight: 0,
        }}
      >
        <X size={15} />
      </button>
    </div>
  )
}
