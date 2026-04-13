const LOOP_STEPS = [
  { id: '01', label: 'Test',       desc: 'Upload your lab results'              },
  { id: '02', label: 'Understand', desc: 'Get a clear picture of what\'s off'   },
  { id: '03', label: 'Act',        desc: 'Follow your personalized protocol'    },
  { id: '04', label: 'Re-test',    desc: 'Track progress and refine your plan'  },
]

const BLOCKS = [
  {
    title: 'Your data evolves',
    body: 'New lab results and feedback refine your insights over time.',
  },
  {
    title: 'Your protocol adapts',
    body: 'Recommendations update as your body improves or new issues appear.',
  },
  {
    title: 'You stay in control',
    body: 'Track changes and adjust before small issues become real problems.',
  },
]

export default function LongevitySection() {
  return (
    <section className="dna-bg" style={{ padding: 'var(--py-lg) 24px', backgroundColor: 'var(--white)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* Header */}
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 72 }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--teal-500)',
            marginBottom: 16,
          }}>
            Long-term health loop
          </div>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--gray-900)', marginBottom: 20,
          }}>
            Health is not a one-time fix
          </h2>
          <p style={{ fontSize: 17, color: 'var(--gray-500)', maxWidth: 540, margin: '0 auto', lineHeight: 1.65 }}>
            Your body changes over time. Your protocol should too.
            VITALOOP continuously updates your recommendations based on new data, symptoms, and progress.
          </p>
        </div>

        {/* Loop diagram */}
        <div className="reveal" style={{ marginBottom: 72 }}>
          <div className="longevity-loop" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 0,
            background: 'var(--gray-50)',
            borderRadius: 24,
            border: '0.5px solid var(--gray-100)',
            overflow: 'hidden',
          }}>
            {LOOP_STEPS.map(({ id, label, desc }, i) => {
              const isLast = i === LOOP_STEPS.length - 1
              return (
                <div
                  key={id}
                  style={{
                    padding: '36px 28px',
                    borderRight: isLast ? 'none' : '0.5px solid var(--gray-100)',
                    position: 'relative',
                  }}
                >
                  {/* Step number */}
                  <div style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: 'var(--teal-500)', marginBottom: 12,
                  }}>
                    {id}
                  </div>

                  {/* Label */}
                  <div style={{
                    fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 8,
                  }}>
                    {label}
                  </div>

                  {/* Description */}
                  <div style={{ fontSize: 14, color: 'var(--gray-500)', lineHeight: 1.6 }}>
                    {desc}
                  </div>

                  {/* Arrow connector (except last) */}
                  {!isLast && (
                    <div style={{
                      position: 'absolute', right: -12, top: '50%',
                      transform: 'translateY(-50%)',
                      width: 24, height: 24,
                      background: 'var(--gray-50)',
                      border: '0.5px solid var(--gray-100)',
                      borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      zIndex: 1,
                      fontSize: 11, color: 'var(--teal-500)', fontWeight: 700,
                    }}>
                      →
                    </div>
                  )}

                  {/* Loop-back indicator on last step */}
                  {isLast && (
                    <div style={{
                      marginTop: 16,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 600, color: 'var(--teal-500)',
                      background: 'rgba(16,185,129,0.08)',
                      border: '0.5px solid var(--teal-300)',
                      borderRadius: 6, padding: '3px 8px',
                    }}>
                      ↺ repeat
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 3 supporting blocks */}
        <div className="grid md:grid-cols-3 gap-6 reveal">
          {BLOCKS.map(({ title, body }) => (
            <div key={title} style={{
              background: 'var(--gray-50)', borderRadius: 20,
              border: '0.5px solid var(--gray-100)', padding: '32px 28px',
            }}>
              <div style={{
                fontSize: 16, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 10,
              }}>
                {title}
              </div>
              <div style={{ fontSize: 14, color: 'var(--gray-500)', lineHeight: 1.65 }}>
                {body}
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
