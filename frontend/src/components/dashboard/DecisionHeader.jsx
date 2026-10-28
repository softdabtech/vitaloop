export function decisionRetestSummary(items, fallback) {
  const first = Array.isArray(items) ? items[0] : null
  if (!first) return fallback
  if (typeof first === 'string') return first

  return first.timing
    || first.retest_window
    || first.window
    || first.label
    || first.marker
    || fallback
}

export default function DecisionHeader({ title, summary, why, nextAction, retest, labels = {} }) {
  return (
    <section
      aria-label={title}
      className="mt-5 rounded-[var(--vtl-radius-card)] border border-[var(--vtl-color-border)] bg-[var(--vtl-color-surface)] p-4 shadow-[var(--vtl-shadow-card)]"
    >
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--vtl-color-brand-700)]">{title}</p>
      <p className="mt-2 text-base font-bold leading-6 text-[var(--vtl-color-ink)]">{summary}</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--vtl-color-text-muted)]">{labels.why || 'Why'}</dt>
          <dd className="mt-1 text-sm leading-5 text-[var(--vtl-color-ink-secondary)]">{why}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--vtl-color-text-muted)]">{labels.nextAction || 'Next action'}</dt>
          <dd className="mt-1 text-sm leading-5 text-[var(--vtl-color-ink-secondary)]">{nextAction}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--vtl-color-text-muted)]">{labels.retest || 'Retest'}</dt>
          <dd className="mt-1 text-sm leading-5 text-[var(--vtl-color-ink-secondary)]">{retest}</dd>
        </div>
      </dl>
    </section>
  )
}
