const TIMELINE = [
  {
    period: 'Month 1',
    title: 'Baseline established',
    desc: 'First lab upload. AI identifies your starting deficiencies. Protocol begins.',
    status: 'start',
  },
  {
    period: 'Month 3',
    title: 'First re-test',
    desc: 'Most users see 40-60% improvement in key markers. Protocol adjusted.',
    status: 'progress',
  },
  {
    period: 'Month 6',
    title: 'Optimization phase',
    desc: 'Critical deficiencies resolved. Shifting to maintenance and performance.',
    status: 'progress',
  },
  {
    period: 'Year 1',
    title: 'Full health picture',
    desc: '4 complete tests. Seasonal patterns visible. Avatar fully calibrated.',
    status: 'milestone',
  },
  {
    period: 'Year 2+',
    title: 'Lifelong companion',
    desc: 'VITALOOP tracks every change - aging, lifestyle shifts, new goals.',
    status: 'future',
  },
]

export default function LongevitySection() {
  return (
    <section style={{ padding: '120px 24px', background: 'var(--white)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 80 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--teal-500)', marginBottom: 16,
          }}>
            Long-term health
          </div>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--gray-900)', marginBottom: 20,
          }}>
            Not a one-time fix.<br />A lifelong companion.
          </h2>
          <p style={{ fontSize: 17, color: 'var(--gray-500)', maxWidth: 520, margin: '0 auto', lineHeight: 1.65 }}>
            VITALOOP remembers every lab result you have ever uploaded.
            Your health history, tracked and optimized for years.
          </p>
        </div>

        <div className="reveal" style={{ position: 'relative', maxWidth: 680, margin: '0 auto 80px' }}>
          <div style={{
            position: 'absolute', left: 20, top: 16, bottom: 16,
            width: '0.5px', background: 'var(--gray-100)',
          }} />

          {TIMELINE.map(({ period, title, desc, status }, i) => {
            const dotColor = status === 'start' ? 'var(--teal-500)'
              : status === 'milestone' ? 'var(--teal-800)'
              : status === 'future' ? 'var(--gray-300)'
              : 'var(--teal-500)'
            const isLast = i === TIMELINE.length - 1

            return (
              <div key={period} style={{
                display: 'flex', gap: 24, marginBottom: isLast ? 0 : 32,
                opacity: status === 'future' ? 0.5 : 1,
              }}>
                <div style={{
                  width: 40, flexShrink: 0, display: 'flex',
                  justifyContent: 'center', paddingTop: 4, position: 'relative', zIndex: 1,
                }}>
                  <div style={{
                    width: status === 'milestone' ? 16 : 10,
                    height: status === 'milestone' ? 16 : 10,
                    borderRadius: '50%', background: dotColor,
                    border: `2px solid ${dotColor}`,
                    marginTop: status === 'milestone' ? -3 : 0,
                  }} />
                </div>

                <div style={{
                  flex: 1, background: 'var(--gray-50)',
                  borderRadius: 16, padding: '20px 24px',
                  border: status === 'milestone' ? '1px solid var(--teal-300)' : '0.5px solid var(--gray-100)',
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                    color: 'var(--teal-500)', textTransform: 'uppercase', marginBottom: 6,
                  }}>
                    {period}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 6 }}>
                    {title}
                  </div>
                  <div style={{ fontSize: 15, color: 'var(--gray-500)', lineHeight: 1.6 }}>
                    {desc}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="reveal grid md:grid-cols-3 gap-6">
          {[
            { num: '89%', label: 'of users re-test within 90 days' },
            { num: '3.4x', label: 'average biomarker improvement by year 1' },
            { num: '∞', label: 'your health history stored securely' },
          ].map(({ num, label }) => (
            <div key={num} style={{
              background: 'var(--gray-50)', borderRadius: 20,
              border: '0.5px solid var(--gray-100)', padding: '32px 28px',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: 48, fontWeight: 700, color: 'var(--teal-500)',
                letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 10,
              }}>
                {num}
              </div>
              <div style={{ fontSize: 15, color: 'var(--gray-500)', lineHeight: 1.5 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
