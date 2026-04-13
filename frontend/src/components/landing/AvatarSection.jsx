import { useNavigate } from 'react-router-dom'

const FEATURES = [
  '50+ adaptive questions tailored in real-time',
  'Covers symptoms, lifestyle, nutrition, and habits',
  'Detects hidden patterns behind your lab results',
  'Built on 5+ years of practitioner research',
]

export default function AvatarSection() {
  const navigate = useNavigate()

  return (
    <section id="avatar" style={{ padding: 'var(--py-xl) 24px', background: 'var(--gray-950)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--teal-400)',
            marginBottom: 16,
          }}>
            AI Health Assessment
          </div>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 52px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'white',
            marginBottom: 20,
          }}>
            Go deeper than your lab results
          </h2>
          <p style={{ fontSize: 17, color: 'var(--gray-300)', maxWidth: 660, margin: '0 auto', lineHeight: 1.65 }}>
            Answer a personalized set of questions designed to uncover hidden patterns your doctor might miss.
          </p>
        </div>

        <div className="reveal grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 items-center">
          <div>
            <h3 style={{
              fontSize: 'clamp(26px, 3vw, 38px)',
              fontWeight: 700,
              color: 'white',
              letterSpacing: '-0.02em',
              marginBottom: 16,
            }}>
              Not just data - context.
            </h3>
            <p style={{ fontSize: 17, color: 'var(--gray-300)', lineHeight: 1.65, marginBottom: 24 }}>
              Our adaptive questionnaire analyzes your symptoms, lifestyle, and habits to refine your results and build a truly personalized protocol.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {FEATURES.map((feature) => (
                <li key={feature} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: 'var(--gray-300)', fontSize: 15, lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--teal-300)', marginTop: 1 }}>•</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '0.5px solid rgba(255,255,255,0.1)',
            borderRadius: 20,
            padding: '24px 22px',
          }}>
            <div style={{
              display: 'inline-flex',
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(29,158,117,0.15)',
              border: '0.5px solid rgba(93,202,165,0.4)',
              color: 'var(--teal-100)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              marginBottom: 14,
            }}>
              AI ASSESSMENT
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 18, letterSpacing: '-0.01em' }}>
              How is your energy level during the day?
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {['Stable', 'Afternoon crash', 'Always low'].map((option, idx) => (
                <div key={option} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: idx === 1 ? '0.5px solid var(--teal-300)' : '0.5px solid rgba(255,255,255,0.12)',
                  background: idx === 1 ? 'rgba(29,158,117,0.1)' : 'rgba(255,255,255,0.02)',
                  color: idx === 1 ? 'white' : 'var(--gray-300)',
                  fontSize: 15,
                }}>
                  <span style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    border: idx === 1 ? '4px solid var(--teal-400)' : '1.5px solid rgba(255,255,255,0.35)',
                    boxSizing: 'border-box',
                    display: 'inline-block',
                  }} />
                  {option}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--gray-300)' }}>Step 12 of 48</span>
              <span style={{ fontSize: 12, color: 'var(--teal-100)' }}>Adaptive in real-time</span>
            </div>
          </div>
        </div>

        <div className="reveal" style={{
          marginTop: 52,
          background: 'rgba(255,255,255,0.03)',
          border: '0.5px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: '24px 22px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--teal-100)', textTransform: 'uppercase', marginBottom: 8 }}>
            Built from real-world practice
          </div>
          <p style={{ fontSize: 16, color: 'var(--gray-300)', lineHeight: 1.65, margin: 0 }}>
            Our methodology is based on years of work by experienced nutrition specialists, combining lab data, symptoms, and lifestyle patterns.
          </p>
        </div>

        <div className="reveal" style={{ textAlign: 'center', marginTop: 52 }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'var(--teal-500)',
              color: 'white',
              border: 'none',
              borderRadius: 980,
              padding: '16px 40px',
              fontSize: 17,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 200ms, transform 200ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--teal-300)'; e.currentTarget.style.transform = 'scale(1.02)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--teal-500)'; e.currentTarget.style.transform = 'scale(1)' }}
          >
            Start your assessment
          </button>
        </div>
      </div>
    </section>
  )
}
