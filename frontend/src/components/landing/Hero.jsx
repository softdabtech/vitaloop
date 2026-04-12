import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Play, Shield } from 'lucide-react'

const BIOMARKERS = [
  { name: 'Vitamin D',  value: '18.5 ng/mL', status: 'DEFICIENT',  pct: 15, color: '#e53935' },
  { name: 'Ferritin',   value: '12 ng/mL',   status: 'BORDERLINE', pct: 40, color: '#f5a623' },
  { name: 'B12',        value: '520 pg/mL',  status: 'OPTIMAL',    pct: 82, color: '#1D9E75' },
  { name: 'Magnesium',  value: '1.4 mg/dL',  status: 'DEFICIENT',  pct: 20, color: '#e53935' },
]

const HERO_WORDS_L1 = ['Know', 'your', 'body.']
const HERO_WORDS_L2 = ['Upgrade', 'your', 'life.']

export default function Hero() {
  const navigate = useNavigate()
  const [vis, setVis] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVis(true), 80)
    return () => clearTimeout(t)
  }, [])

  const tx = (delay) => ({
    opacity: vis ? 1 : 0,
    transform: vis ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity 650ms cubic-bezier(0.25,0.46,0.45,0.94) ${delay}ms,
                 transform 650ms cubic-bezier(0.25,0.46,0.45,0.94) ${delay}ms`,
  })

  return (
    <section
      id="hero"
      style={{
        minHeight: '100svh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--white)',
        padding: '80px 24px 60px',
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

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 860, width: '100%', textAlign: 'center' }}>

        {/* Eyebrow */}
        <div style={{ ...tx(0), display: 'inline-flex', marginBottom: 32 }}>
          <span style={{
            display: 'inline-block',
            background: 'var(--teal-50)', border: '0.5px solid var(--teal-300)',
            borderRadius: 980, padding: '6px 18px',
            fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--teal-600)',
          }}>
            Biohacking · as · a · service
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(52px, 7vw, 84px)',
          fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05,
          marginBottom: 24,
        }}>
          <div>
            {HERO_WORDS_L1.map((w, i) => (
              <span
                key={w}
                style={{
                  display: 'inline-block', marginRight: '0.22em',
                  color: 'var(--gray-900)',
                  opacity: vis ? 1 : 0,
                  transform: vis ? 'translateY(0)' : 'translateY(30px)',
                  transition: `opacity 650ms ease ${120 + i * 35}ms,
                               transform 650ms cubic-bezier(0.25,0.46,0.45,0.94) ${120 + i * 35}ms`,
                }}
              >
                {w}
              </span>
            ))}
          </div>
          <div>
            {HERO_WORDS_L2.map((w, i) => (
              <span
                key={w}
                style={{
                  display: 'inline-block', marginRight: '0.22em',
                  color: 'var(--teal-500)',
                  opacity: vis ? 1 : 0,
                  transform: vis ? 'translateY(0)' : 'translateY(30px)',
                  transition: `opacity 650ms ease ${240 + i * 35}ms,
                               transform 650ms cubic-bezier(0.25,0.46,0.45,0.94) ${240 + i * 35}ms`,
                }}
              >
                {w}
              </span>
            ))}
          </div>
        </h1>

        {/* Subheadline */}
        <p style={{
          ...tx(400),
          fontSize: 19, color: 'var(--gray-500)',
          maxWidth: 560, margin: '0 auto 40px',
          lineHeight: 1.6,
        }}>
          Upload any blood test. AI extracts your biomarkers, identifies deficiencies,
          and builds a personalized supplement protocol — in 60 seconds.
        </p>

        {/* CTA row */}
        <div style={{
          ...tx(560),
          display: 'flex', gap: 16, justifyContent: 'center',
          flexWrap: 'wrap', marginBottom: 32,
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
            aria-label="Watch 60 second demo"
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
            <Play size={12} fill="currentColor" aria-hidden="true" /> Watch 60s demo
          </button>
        </div>

        {/* Social proof */}
        <div style={{
          ...tx(720),
          display: 'flex', gap: 20, justifyContent: 'center',
          alignItems: 'center', flexWrap: 'wrap', marginBottom: 64,
        }}>
          <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>
            <span style={{ color: 'var(--teal-500)' }}>★★★★★</span> 4.9 · 2,400+ users
          </span>
          <span aria-hidden="true" style={{ width: '0.5px', height: 16, background: 'var(--gray-100)', display: 'inline-block' }} />
          <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Quest · LabCorp · Any lab</span>
          <span aria-hidden="true" style={{ width: '0.5px', height: 16, background: 'var(--gray-100)', display: 'inline-block' }} />
          <span style={{ fontSize: 13, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Shield size={12} aria-hidden="true" /> HIPAA-ready architecture
          </span>
        </div>

        {/* Hero Visual — Dashboard Mockup */}
        <div
          style={{
            ...tx(900),
            background: 'var(--gray-50)', borderRadius: 20,
            border: '0.5px solid var(--gray-100)', padding: '24px 28px',
            maxWidth: 600, margin: '0 auto',
          }}
          className="floating"
        >
          {/* Browser chrome dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
            {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
              <div key={c} aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
            ))}
            <div style={{
              flex: 1, height: 20, background: 'var(--gray-100)',
              borderRadius: 6, marginLeft: 10, opacity: 0.6,
            }} />
          </div>

          {/* Biomarker cards */}
          <div className="grid grid-cols-2 gap-3">
            {BIOMARKERS.map(({ name, value, status, pct, color }) => (
              <div
                key={name}
                style={{
                  background: 'white', borderRadius: 12, padding: '14px 16px',
                  border: '0.5px solid var(--gray-100)',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  {name}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray-900)', marginBottom: 8 }}>
                  {value}
                </div>
                <div style={{ height: 4, background: 'var(--gray-100)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color, marginTop: 4 }}>{status}</div>
              </div>
            ))}
          </div>

          {/* Protocol badge */}
          <div style={{
            marginTop: 16,
            background: 'var(--teal-50)', border: '0.5px solid var(--teal-300)',
            borderRadius: 8, padding: '10px 16px', textAlign: 'center',
            fontSize: 13, fontWeight: 600, color: 'var(--teal-600)',
          }}>
            Protocol generated ✓ — 6 supplements recommended
          </div>
        </div>
      </div>
    </section>
  )
}
