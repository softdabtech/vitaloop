import { useNavigate } from 'react-router-dom'
import { ArrowRight, Shield, Activity, Zap, FlaskConical, BarChart2, Heart, Droplets, ScanLine, ClipboardList } from 'lucide-react'

export default function Hero() {
  const navigate = useNavigate()

  return (
    <section
      id="hero"
      style={{
        minHeight: 'auto',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--white)',
        padding: '120px 24px 96px',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Dot-grid background */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: 'radial-gradient(circle, var(--teal-500) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          opacity: 0.04,
          pointerEvents: 'none',
        }}
      />

      {/* Decorative side icons — left */}
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 200, zIndex: 0, pointerEvents: 'none' }}>
        {[
          { Icon: Activity,     top: '14%', left: '18%', rotate: -15, size: 28 },
          { Icon: FlaskConical, top: '32%', left: '6%',  rotate: 10,  size: 22 },
          { Icon: Heart,        top: '52%', left: '22%', rotate: -8,  size: 24 },
          { Icon: BarChart2,    top: '70%', left: '10%', rotate: 12,  size: 26 },
          { Icon: Droplets,     top: '84%', left: '28%', rotate: -6,  size: 20 },
        ].map(({ Icon, top, left, rotate, size }, i) => (
          <div key={i} style={{ position: 'absolute', top, left, transform: `rotate(${rotate}deg)`, opacity: 0.055 }}>
            <Icon size={size} color="var(--teal-500)" strokeWidth={1.2} />
          </div>
        ))}
      </div>

      {/* Decorative side icons — right */}
      <div aria-hidden="true" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 200, zIndex: 0, pointerEvents: 'none' }}>
        {[
          { Icon: ScanLine,      top: '12%', right: '14%', rotate: 8,   size: 26 },
          { Icon: Zap,           top: '30%', right: '24%', rotate: -12, size: 22 },
          { Icon: ClipboardList, top: '50%', right: '8%',  rotate: 6,   size: 28 },
          { Icon: Activity,      top: '66%', right: '20%', rotate: -10, size: 24 },
          { Icon: FlaskConical,  top: '82%', right: '30%', rotate: 14,  size: 20 },
        ].map(({ Icon, top, right, rotate, size }, i) => (
          <div key={i} style={{ position: 'absolute', top, right, transform: `rotate(${rotate}deg)`, opacity: 0.055 }}>
            <Icon size={size} color="var(--teal-500)" strokeWidth={1.2} />
          </div>
        ))}
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, width: '100%', textAlign: 'center' }}>

        {/* Eyebrow chip */}
        <div style={{ marginBottom: 32 }}>
          <span style={{
            display: 'inline-block',
            background: 'var(--teal-50)', border: '0.5px solid var(--teal-300)',
            borderRadius: 980, padding: '6px 18px',
            fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--teal-600)',
          }}>
            AI-powered health optimization
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(52px, 7vw, 84px)',
          fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05,
          color: 'var(--gray-900)',
          marginBottom: 24,
        }}>
          Know your body.<br />
          <span style={{ color: 'var(--teal-500)' }}>Upgrade your life.</span>
        </h1>

        {/* Subheadline */}
        <p style={{
          fontSize: 19, color: 'var(--gray-500)',
          maxWidth: 540, margin: '0 auto 40px',
          lineHeight: 1.6,
        }}>
          Upload your lab results, get AI analysis, and follow a personalized protocol.
          Track your progress weekly — not just one-time results.
        </p>

        {/* CTA row */}
        <div style={{
          display: 'flex', gap: 16, justifyContent: 'center',
          flexWrap: 'wrap', marginBottom: 40,
        }}>
          <button
            onClick={() => navigate('/login')}
            aria-label="Start free — no card needed"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--teal-800)', color: 'white',
              border: 'none', borderRadius: 980,
              padding: '16px 36px', fontSize: 17, fontWeight: 600,
              cursor: 'pointer', transition: 'background 200ms, transform 200ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--teal-600)'; e.currentTarget.style.transform = 'scale(1.02)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--teal-800)'; e.currentTarget.style.transform = 'scale(1)' }}
          >
            Start free — no card needed <ArrowRight size={16} aria-hidden="true" />
          </button>
          <button
            onClick={() => { const el = document.getElementById('how-it-works'); el?.scrollIntoView({ behavior: 'smooth' }) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'transparent',
              border: '1.5px solid var(--gray-300)',
              borderRadius: 980, padding: '16px 28px', fontSize: 17,
              color: 'var(--gray-700)', cursor: 'pointer',
              transition: 'border-color 200ms, color 200ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--teal-500)'; e.currentTarget.style.color = 'var(--teal-600)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--gray-300)'; e.currentTarget.style.color = 'var(--gray-700)' }}
          >
            See how it works
          </button>
        </div>

        {/* Social proof */}
        <div style={{
          display: 'flex', gap: 20, justifyContent: 'center',
          alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>
            <span style={{ color: 'var(--teal-500)' }}>★★★★★</span> 4.9 · 100+ users
          </span>
          <span aria-hidden="true" style={{ width: '0.5px', height: 16, background: 'var(--gray-100)', display: 'inline-block' }} />
          <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Works with any lab worldwide</span>
          <span aria-hidden="true" style={{ width: '0.5px', height: 16, background: 'var(--gray-100)', display: 'inline-block' }} />
          <span style={{ fontSize: 13, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Shield size={12} aria-hidden="true" /> Secure &amp; privacy-first
          </span>
        </div>

      </div>
    </section>
  )
}
