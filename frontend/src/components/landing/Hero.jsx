import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Shield, Activity, Zap, FlaskConical, BarChart2, Heart, Droplets, ScanLine, ClipboardList } from 'lucide-react'

const HERO_WORDS_L1 = ['Know', 'your', 'body.']
const HERO_WORDS_L2 = ['Upgrade', 'your', 'life.']

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

function HeroSlideshow() {
  const SLIDES = [
    {
      label: '01 - Upload',
      caption: 'Upload your latest lab report in seconds.',
      bg: 'var(--gray-50)',
      content: (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{
            border: '2px dashed var(--teal-300)', borderRadius: 16,
            padding: '28px 20px', marginBottom: 16,
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                   stroke="var(--teal-500)" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 7a2 2 0 012-2h3.5L10 7h9a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
              </svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-700)' }}>
              Drop your lab PDF here
            </div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
              Quest - LabCorp - Any lab worldwide
            </div>
          </div>
          <div style={{ height: 4, background: 'var(--gray-100)', borderRadius: 2, overflow: 'hidden' }}>
            <div className="fill-bar" style={{ height: '100%', width: '94%', background: 'var(--teal-500)', borderRadius: 2 }}/>
          </div>
          <div style={{ fontSize: 12, color: 'var(--teal-600)', marginTop: 6, fontWeight: 600 }}>
            Extracting biomarkers... 94%
          </div>
        </div>
      ),
    },
    {
      label: '02 - AI Analysis',
      caption: 'AI extracts and classifies your biomarkers.',
      bg: '#111',
      content: (
        <div style={{ fontFamily: '"SF Mono", monospace', padding: '4px 0' }}>
          <div style={{ fontSize: 10, color: '#666', marginBottom: 10 }}>{'// AI analysis output'}</div>
          {[
            { k: 'Vitamin D', v: '18.5 ng/mL', s: 'DEFICIENT', c: '#e53935' },
            { k: 'Ferritin',  v: '12 ng/mL',   s: 'DEFICIENT', c: '#e53935' },
            { k: 'B12',       v: '310 pg/mL',  s: 'OPTIMAL',   c: '#1D9E75' },
            { k: 'TSH',       v: '2.4 mIU/L',  s: 'OPTIMAL',   c: '#1D9E75' },
          ].map(({ k, v, s, c }, i) => (
            <div key={k} className="typewriter-line" style={{
              fontSize: 12, color: 'rgba(255,255,255,0.8)',
              display: 'flex', justifyContent: 'space-between',
              marginBottom: 10, animationDelay: `${i * 0.5}s`,
            }}>
              <span style={{ color: 'var(--teal-300)' }}>"{k}"</span>
              <span style={{ color: c, fontSize: 10, fontWeight: 700,
                background: c + '20', padding: '2px 7px', borderRadius: 4 }}>{s}</span>
            </div>
          ))}
          <div className="typewriter-badge" style={{
            marginTop: 12, padding: '7px 12px', borderRadius: 8,
            background: '#1D9E7520', border: '0.5px solid var(--teal-500)',
            fontSize: 11, fontWeight: 700, color: 'var(--teal-300)', textAlign: 'center',
          }}>
            {'\u2713'} AI Analysis complete - 4 biomarkers classified
          </div>
        </div>
      ),
    },
    {
      label: '03 - Your Protocol',
      caption: 'Get supplement guidance with timing and priority.',
      bg: 'var(--gray-50)',
      content: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-900)' }}>Your protocol</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>6 supplements - $67/mo</div>
          </div>
          {[
            { name: 'Vitamin D3',   dose: '5000 IU', timing: 'Morning', p: 'HIGH',   c: '#e53935' },
            { name: 'Iron Bisgly.', dose: '25 mg',   timing: 'Evening', p: 'HIGH',   c: '#e53935' },
            { name: 'Magnesium',    dose: '400 mg',  timing: 'Bedtime', p: 'MEDIUM', c: '#f5a623' },
          ].map(({ name, dose, timing, p, c }) => (
            <div key={name} style={{
              background: 'var(--teal-50)', border: '0.5px solid var(--teal-100)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0 }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-900)' }}>{name}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{dose} - {timing}</div>
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: c, background: c + '15',
                padding: '2px 6px', borderRadius: 4 }}>{p}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      label: '05 - Progress',
      caption: 'Track improvements week by week over time.',
      bg: 'var(--gray-50)',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { date: 'Jan 15', label: '4 deficiencies found',    dot: '#e53935', highlight: false },
            { date: 'Apr 20', label: '2 deficiencies remaining', dot: '#f5a623', highlight: false },
            { date: 'Jul 8',  label: '0 deficiencies \u2713',        dot: '#1D9E75', highlight: true },
          ].map(({ date, label, dot, highlight }) => (
            <div key={date} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: highlight ? 'var(--teal-50)' : 'white',
              borderRadius: 10, padding: '10px 14px',
              border: `0.5px solid ${highlight ? 'var(--teal-300)' : 'var(--gray-100)'}`,
            }}>
              <span style={{ fontSize: 11, color: 'var(--gray-500)', minWidth: 42 }}>{date}</span>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }}/>
              <span style={{ fontSize: 12, fontWeight: highlight ? 600 : 400,
                color: highlight ? 'var(--teal-700)' : 'var(--gray-700)' }}>{label}</span>
            </div>
          ))}
        </div>
      ),
    },
  ]

  const [active, setActive] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setActive((s) => (s + 1) % SLIDES.length), 3000)
    return () => clearInterval(t)
  }, [SLIDES.length])

  const slide = SLIDES[active]

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }} className="floating">
      <style>{`
        @keyframes heroFillPulse {
          0% { transform: translateX(-8%); }
          100% { transform: translateX(0); }
        }
        @keyframes heroTypeIn {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .fill-bar { animation: heroFillPulse 900ms ease; }
        .typewriter-line { animation: heroTypeIn 480ms ease both; }
        .typewriter-badge { animation: heroTypeIn 500ms ease both; animation-delay: 0.8s; }
      `}</style>

      {/* Slide card */}
      <div style={{
        background: slide.bg, borderRadius: 20,
        border: `0.5px solid ${slide.bg === '#111' ? 'rgba(255,255,255,0.08)' : 'var(--gray-100)'}`,
        padding: '24px 28px', minHeight: 220,
        transition: 'background 400ms ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal-500)', letterSpacing: '0.08em' }}>{slide.label}</span>
          <span style={{ fontSize: 11, color: slide.bg === '#111' ? 'rgba(255,255,255,0.45)' : 'var(--gray-500)' }}>{active + 1}/{SLIDES.length}</span>
        </div>
        <p style={{
          fontSize: 12,
          lineHeight: 1.5,
          marginBottom: 14,
          color: slide.bg === '#111' ? 'rgba(255,255,255,0.68)' : 'var(--gray-500)',
        }}>
          {slide.caption}
        </p>
        {/* Browser dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }}/>
          ))}
        </div>
        {slide.content}
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
        minHeight: 'auto',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--white)',
        padding: '120px 24px 80px',
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
          { Icon: Activity,      top: '14%', left: '18%', rotate: -15, size: 28 },
          { Icon: FlaskConical,  top: '32%', left: '6%',  rotate: 10,  size: 22 },
          { Icon: Heart,         top: '52%', left: '22%', rotate: -8,  size: 24 },
          { Icon: BarChart2,     top: '70%', left: '10%', rotate: 12,  size: 26 },
          { Icon: Droplets,      top: '84%', left: '28%', rotate: -6,  size: 20 },
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

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 860, width: '100%', textAlign: 'center' }}>

        {/* Eyebrow */}
        <div style={{ ...tx(80), display: 'inline-flex', marginBottom: 32 }}>
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
                  transition: `opacity 650ms ease ${200 + i * 35}ms,
                               transform 650ms cubic-bezier(0.25,0.46,0.45,0.94) ${200 + i * 35}ms`,
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
                  transition: `opacity 650ms ease ${320 + i * 35}ms,
                               transform 650ms cubic-bezier(0.25,0.46,0.45,0.94) ${320 + i * 35}ms`,
                }}
              >
                {w}
              </span>
            ))}
          </div>
        </h1>

        {/* Subheadline */}
        <p style={{
          ...tx(480),
          fontSize: 19, color: 'var(--gray-500)',
          maxWidth: 560, margin: '0 auto 40px',
          lineHeight: 1.6,
        }}>
          Upload your lab results, get AI analysis, and follow a personalized protocol.
          Track your progress weekly — not just one-time results.
        </p>

        {/* CTA row */}
        <div className="flex flex-wrap justify-center gap-4 sm:flex-row flex-col items-center" style={{
          ...tx(640),
          display: 'flex', gap: 16, justifyContent: 'center',
          marginBottom: 32,
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
            aria-label="See how it works"
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 8 8 12 12 16"/>
              <line x1="16" y1="12" x2="8" y2="12"/>
            </svg>
            See how it works
          </button>
        </div>

        {/* Social proof */}
        <div style={{
          ...tx(800),
          display: 'flex', gap: 20, justifyContent: 'center',
          alignItems: 'center', flexWrap: 'wrap', marginBottom: 64,
        }}>
          <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>
            <span style={{ color: 'var(--teal-500)' }}>★★★★★</span> 4.9 · 100+ users
          </span>
          <span aria-hidden="true" style={{ width: '0.5px', height: 16, background: 'var(--gray-100)', display: 'inline-block' }} />
          <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Works with any lab worldwide</span>
          <span aria-hidden="true" style={{ width: '0.5px', height: 16, background: 'var(--gray-100)', display: 'inline-block' }} />
          <span style={{ fontSize: 13, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Shield size={12} aria-hidden="true" /> Secure & privacy-first
          </span>
        </div>

        {/* Hero Visual */}
        <div style={{ ...tx(980) }}>
          <HeroSlideshow />
        </div>
      </div>

      {showDemo && <DemoModal onClose={() => setShowDemo(false)} />}
    </section>
  )
}
