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

  if (!Array.isArray(hints) || total === 0) return null

  function next() {
    if (step < total - 1) {
      setStep((s) => s + 1)
    } else {
      onDone()
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-label="Page tips">
      <button
        type="button"
        onClick={onDone}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]"
        aria-label="Close tips"
      />

      <div className="relative z-[91] w-full max-w-xl rounded-3xl border border-emerald-200 bg-white p-5 shadow-2xl sm:p-6">
        <button
          onClick={onDone}
          aria-label="Dismiss hints"
          className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={16} />
        </button>

        <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
          <Lightbulb size={16} color="#10b981" />
        </div>

        <div className="mb-2 flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-700">
            Tip {step + 1} of {total}
          </span>
          <div className="flex gap-1">
            {hints.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-emerald-500' : i < step ? 'w-2 bg-emerald-400' : 'w-2 bg-slate-200'}`}
              />
            ))}
          </div>
        </div>

        <p className="text-base leading-7 text-slate-800">{hints[step]}</p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={next}
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            {step < total - 1 ? 'Next tip' : 'Got it'}
            {step < total - 1 && <ChevronRight size={14} />}
          </button>

          {step < total - 1 && (
            <button
              onClick={onDone}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Skip walkthrough
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
