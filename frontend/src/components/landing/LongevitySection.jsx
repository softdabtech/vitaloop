const LOOP_STEPS = [
  { id: '01', label: 'Test',       desc: 'Upload your lab results'              },
  { id: '02', label: 'Interpret',  desc: 'See red flags and priority biomarkers' },
  { id: '03', label: 'Act',        desc: 'Apply a personalized protocol'         },
  { id: '04', label: 'Re-test',    desc: 'Track trends and refine your plan'     },
]

const BLOCKS = [
  {
    title: 'Your data evolves',
    body: 'Each new report updates your baseline and priorities.',
  },
  {
    title: 'Your protocol adapts automatically',
    body: 'Recommendations adapt as biomarkers and symptoms change.',
  },
  {
    title: 'Your practitioner can collaborate',
    body: 'Built-in CRM workflows keep individual and team care aligned.',
  },
]

const TRACKING_MOCKUPS = [
  {
    title: 'Dashboard',
    alt: 'Dashboard with biomarker score, priority flags, and adherence trend.',
    image: '/mockups/dashboard.webp',
    device: 'desktop',
  },
  {
    title: 'Lab Upload',
    alt: 'Upload workspace with PDF intake, analysis status, and validation checks.',
    image: '/mockups/upload.webp',
    device: 'desktop',
  },
  {
    title: 'Lab Results',
    alt: 'Structured lab results with severity chips and high-risk markers.',
    image: '/mockups/lab-results.webp',
    device: 'desktop',
  },
  {
    title: 'Personalized Protocol',
    alt: 'Protocol plan with supplements, nutrition actions, and progress targets.',
    image: '/mockups/progress.webp',
    device: 'desktop',
  },
  {
    title: 'Timeline',
    alt: 'Longitudinal timeline with biomarker trajectories across multiple test cycles.',
    image: '/mockups/progress.webp',
    device: 'desktop',
  },
  {
    title: 'Practitioner CRM',
    alt: 'Practitioner CRM dashboard with client panels and assignment overview.',
    image: '/mockups/crm.webp',
    device: 'desktop',
  },
  {
    title: 'Weekly Check-in',
    alt: 'Mobile check-in flow with daily energy, sleep, and symptom entries.',
    image: '/mockups/check-in.webp',
    device: 'mobile',
  },
]

function TrackingMockupCard({ title, alt, image, device }) {
  const isMobile = device === 'mobile'

  return (
    <figure style={{
      borderRadius: 20,
      border: '0.5px solid var(--gray-100)',
      background: 'white',
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{
        borderRadius: 14,
        border: '0.5px solid var(--gray-100)',
        overflow: 'hidden',
        background: 'var(--gray-50)',
        minHeight: isMobile ? 260 : 190,
      }}>
        <img
          src={image}
          alt={alt}
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: isMobile ? 'top center' : 'center',
            aspectRatio: isMobile ? '9 / 16' : '16 / 10',
          }}
          onError={(event) => {
            // Keep layout stable when screenshots are not deployed yet.
            event.currentTarget.style.display = 'none'
            event.currentTarget.parentElement.style.background =
              'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(15,23,42,0.08))'
          }}
        />
      </div>
      <figcaption style={{
        fontSize: 13,
        color: 'var(--gray-500)',
        lineHeight: 1.5,
      }}>
        <strong style={{ color: 'var(--gray-900)', fontWeight: 700 }}>{title}</strong>
      </figcaption>
    </figure>
  )
}

export default function LongevitySection() {
  return (
    <section style={{ padding: 'var(--py-lg) 24px', backgroundColor: 'var(--white)' }}>
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
            Long-term health is a continuous loop
          </h2>
          <p style={{ fontSize: 17, color: 'var(--gray-500)', maxWidth: 540, margin: '0 auto', lineHeight: 1.65 }}>
            Your body changes over time. VITALOOP keeps decisions current with each test,
            symptom update, and protocol iteration.
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

        {/* Product screenshots */}
        <div className="reveal" style={{ marginBottom: 72 }}>
          <div style={{ marginBottom: 18 }}>
            <h3 style={{
              fontSize: 'clamp(24px, 3vw, 34px)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--gray-900)',
              marginBottom: 10,
            }}>
              Longitudinal Biomarker Tracking Across Every Health Dimension
            </h3>
            <p style={{ fontSize: 15, color: 'var(--gray-500)', lineHeight: 1.65, margin: 0 }}>
              Every cycle is captured as structured evidence: upload, interpret, adapt protocol, and follow progress over time.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {TRACKING_MOCKUPS.map((mockup) => (
              <TrackingMockupCard
                key={mockup.title}
                title={mockup.title}
                alt={mockup.alt}
                image={mockup.image}
                device={mockup.device}
              />
            ))}
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
