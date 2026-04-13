import { Shield, Clock, AlertTriangle, TrendingUp } from 'lucide-react'

const CARDS = [
  {
    Icon: Shield,
    title: 'Stop guessing',
    body: 'Understand exactly what\'s wrong with your body.',
  },
  {
    Icon: Clock,
    title: 'Save time and money',
    body: 'No more random supplements or unnecessary tests.',
  },
  {
    Icon: AlertTriangle,
    title: 'Catch issues early',
    body: 'Fix problems before they become serious.',
  },
  {
    Icon: TrendingUp,
    title: 'See real progress',
    body: 'Track changes over time — not just one-time results.',
  },
]

export default function ValueBlock() {
  return (
    <section
      id="why-vitaloop"
      style={{
        background: 'var(--white)',
        padding: 'var(--py-md) 24px',
      }}
    >
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2
            style={{
              fontSize: 'clamp(28px, 4vw, 44px)',
              fontWeight: 700,
              color: 'var(--gray-900)',
              letterSpacing: '-0.5px',
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            Take control of your health —{' '}
            <span style={{ color: 'var(--teal-500)' }}>finally</span>
          </h2>
        </div>

        {/* Cards grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 20,
          }}
        >
          {CARDS.map(({ Icon, title, body }) => (
            <div
              key={title}
              style={{
                background: 'var(--gray-50, #f9fafb)',
                border: '0.5px solid rgba(0,0,0,0.07)',
                borderRadius: 16,
                padding: '28px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'rgba(16,185,129,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={20} color="var(--teal-500)" strokeWidth={1.8} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--gray-900)',
                    marginBottom: 6,
                  }}
                >
                  {title}
                </div>
                <div style={{ fontSize: 14, color: 'var(--gray-500)', lineHeight: 1.6 }}>
                  {body}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom tagline */}
        <div
          style={{
            marginTop: 56,
            textAlign: 'center',
            borderTop: '0.5px solid rgba(0,0,0,0.07)',
            paddingTop: 40,
          }}
        >
          <p
            style={{
              fontSize: 'clamp(18px, 2.5vw, 24px)',
              fontWeight: 500,
              color: 'var(--gray-500)',
              margin: '0 0 8px',
            }}
          >
            Most people don't lack data — they lack clarity.
          </p>
          <p
            style={{
              fontSize: 'clamp(18px, 2.5vw, 24px)',
              fontWeight: 700,
              color: 'var(--gray-900)',
              margin: 0,
            }}
          >
            VITALOOP gives you both.
          </p>
        </div>
      </div>
    </section>
  )
}
