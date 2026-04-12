import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Play, Shield } from 'lucide-react'

const BIOMARKERS = [
  { name: 'Vitamin D',  value: '18.5 ng/mL', status: 'DEFICIENT',  pct: 15, color: '#e53935' },
  { name: 'Ferritin',   value: '12 ng/mL',   status: 'BORDERLINE', pct: 40, color: '#f5a623' },
  { name: 'B12',        value: '520 pg/mL',  status: 'OPTIMAL',    pct: 82, color: '#1D9E75' },
  { name: 'Magnesium',  value: '1.4 mg/dL',  status: 'DEFICIENT',  pct: 20, color: '#e53935' },
]

const HERO_WORDS_L1 = ['Understand', 'your', 'labs.']
const HERO_WORDS_L2 = ['Track', 'your', 'health.']

function DemoModal({ onClose }) {
  const STEPS = [
    { label: 'Upload Labs', desc: 'Drop your Quest or LabCorp PDF', icon: '📂' },
    { label: 'Describe Symptoms', desc: 'Fatigue, brain fog, sleep issues…', icon: '📝' },
    { label: 'Get Guidance', desc: 'Personalized protocol + rationale', icon: '💊' },
    { label: 'Check In Weekly', desc: 'Energy, sleep, mood, adherence', icon: '📅' },
    { label: 'Track Progress', desc: 'Health trends over months & years', icon: '📈' },
  ]
  const [step, setStep] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 1800)
    return () => clearInterval(t)
  }, [STEPS.length])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          background: '#111', borderRadius: 24,
          border: '0.5px solid rgba(255,255,255,0.1)',
          padding: 48, maxWidth: 520, width: '100%',
          textAlign: 'center',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
            fontSize: 24, cursor: 'pointer',
          }}
          aria-label="Close demo"
        >
          ×
        </button>

        <div style={{ fontSize: 56, marginBottom: 20 }}>
          {STEPS[step].icon}
        </div>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
          color: 'var(--teal-500)', marginBottom: 8, textTransform: 'uppercase',
        }}>
          Step {step + 1} of {STEPS.length}
        </div>
        <h3 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 12 }}>
          {STEPS[step].label}
        </h3>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', marginBottom: 32 }}>
          {STEPS[step].desc}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              style={{
                width: i === step ? 24 : 8, height: 8, borderRadius: 4,
                background: i === step ? 'var(--teal-500)' : 'rgba(255,255,255,0.2)',
                border: 'none', cursor: 'pointer',
                transition: 'width 300ms ease, background 300ms ease',
              }}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'var(--teal-800)', color: 'white',
            border: 'none', borderRadius: 980,
            padding: '14px 36px', fontSize: 16, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Get started free →
        </button>
      </div>
    </div>
  )
}

export default function Hero() {
  const navigate = useNavigate()
  const [vis, setVis] = useState(false)
  const [showDemo, setShowDemo] = useState(false)

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
            Longitudinal · Health · Intelligence
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
          Upload your labs, describe your symptoms, and get a personalized protocol.
          Check in weekly — VITALOOP tracks your health trends over months, not just one-time results.
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
            onClick={() => setShowDemo(true)}
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

      {showDemo && <DemoModal onClose={() => setShowDemo(false)} />}
    </section>
  )
}
