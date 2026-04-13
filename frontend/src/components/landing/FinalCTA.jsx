import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export default function FinalCTA() {
  const navigate = useNavigate()

  return (
    <section style={{
      background: 'var(--gray-950)',
      minHeight: 420,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center',
      padding: 'var(--py-sm) 24px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Radial glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'radial-gradient(ellipse 60% 60% at 50% 50%, #085041 0%, transparent 70%)',
          opacity: 0.4,
        }}
      />

      <div className="reveal" style={{ position: 'relative', zIndex: 1, maxWidth: 640 }}>
        <h2 style={{
          fontSize: 'clamp(44px, 5vw, 64px)', fontWeight: 700,
          color: 'white', letterSpacing: '-0.02em', lineHeight: 1.1,
          marginBottom: 16,
        }}>
          Your biology is telling you something.
        </h2>
        <p style={{
          fontSize: 22, color: 'var(--teal-300)',
          fontWeight: 500, letterSpacing: '-0.01em', marginBottom: 24,
        }}>
          Listen to it. For the first time.
        </p>
        <p style={{
          fontSize: 17, color: 'var(--gray-300)',
          maxWidth: 480, margin: '0 auto 40px',
          lineHeight: 1.65,
        }}>
          Upload your blood test today — free, instant, no card required.
        </p>
        <button
          onClick={() => navigate('/login')}
          style={{
            background: 'var(--teal-500)', color: 'white',
            border: 'none', borderRadius: 980,
            padding: '18px 52px', fontSize: 19, fontWeight: 700,
            cursor: 'pointer', transition: 'background 200ms, transform 200ms',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--teal-300)'; e.currentTarget.style.transform = 'scale(1.04)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--teal-500)'; e.currentTarget.style.transform = 'scale(1)' }}
        >
          Start free <ArrowRight size={18} aria-hidden="true" />
        </button>
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, color: 'var(--gray-500)',
              transition: 'color 200ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--gray-300)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--gray-500)' }}
          >
            Already have an account? Sign in →
          </button>
        </div>
      </div>
    </section>
  )
}
