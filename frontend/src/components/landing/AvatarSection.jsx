import { useNavigate } from 'react-router-dom'
import BodyAvatar from './BodyAvatar.jsx'
import AvatarExamples from './AvatarExamples.jsx'

export default function AvatarSection() {
  const navigate = useNavigate()

  return (
    <section
      id="avatar"
      style={{ padding: '160px 24px', background: 'var(--gray-950)' }}
    >
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* Header */}
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--teal-400)', marginBottom: 16,
          }}>
            Digital Health Avatar
          </div>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700,
            letterSpacing: '-0.02em', color: 'white', marginBottom: 20,
          }}>
            Your body, mapped in detail.
          </h2>
          <p style={{ fontSize: 17, color: 'var(--gray-300)', maxWidth: 520, margin: '0 auto', lineHeight: 1.65 }}>
            A living visual representation of your health status — updated with every test.
          </p>
        </div>

        {/* Interactive Avatar */}
        <div className="reveal" style={{ marginBottom: 0 }}>
          <BodyAvatar />
        </div>

        <div className="reveal" style={{ textAlign: 'center', margin: '80px 0 48px' }}>
          <h3 style={{
            fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 700,
            color: 'white', letterSpacing: '-0.02em', marginBottom: 12,
          }}>
            Real users. Real results.
          </h3>
          <p style={{ fontSize: 16, color: 'var(--gray-300)', maxWidth: 480, margin: '0 auto' }}>
            See how different health profiles look on the Avatar.
          </p>
        </div>

        {/* Avatar examples */}
        <AvatarExamples />

        {/* Bottom CTA */}
        <div className="reveal" style={{ textAlign: 'center', marginTop: 80 }}>
          <h3 style={{
            fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 700,
            color: 'white', letterSpacing: '-0.02em', marginBottom: 16,
          }}>
            Your avatar is waiting.
          </h3>
          <p style={{ fontSize: 17, color: 'var(--gray-300)', maxWidth: 480, margin: '0 auto 36px', lineHeight: 1.65 }}>
            Upload your first lab result and see your health mapped in real time.
          </p>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'var(--teal-500)', color: 'white',
              border: 'none', borderRadius: 980, padding: '16px 40px',
              fontSize: 17, fontWeight: 600, cursor: 'pointer',
              transition: 'background 200ms, transform 200ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--teal-300)'; e.currentTarget.style.transform = 'scale(1.02)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--teal-500)'; e.currentTarget.style.transform = 'scale(1)' }}
          >
            Create my avatar free
          </button>
        </div>
      </div>
    </section>
  )
}
