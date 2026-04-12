import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const CHART_DATA = [
  { month: 'Jan', vitaminD: 18, ferritin: 12 },
  { month: 'Apr', vitaminD: 34, ferritin: 22 },
  { month: 'Jul', vitaminD: 51, ferritin: 34 },
  { month: 'Oct', vitaminD: 58, ferritin: 44 },
]

function SectionLabel({ n }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: 'var(--teal-500)', marginBottom: 12,
    }}>
      {String(n).padStart(2, '0')}
    </div>
  )
}

function BulletList({ items }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item) => (
        <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: 'var(--gray-500)' }}>
          <Check size={15} style={{ color: 'var(--teal-500)', flexShrink: 0 }} aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  )
}

/* ── Row 1 — Upload ── */
function UploadVisual() {
  return (
    <div style={{
      background: 'var(--gray-50)', borderRadius: 20,
      border: '0.5px solid var(--gray-100)', padding: 32,
    }}>
      {/* Drop zone */}
      <div style={{
        border: '2px dashed var(--teal-300)', borderRadius: 16,
        padding: '40px 24px', textAlign: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Pulse ring */}
        <div className="ring-pulse" style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 80, height: 80, marginLeft: -40, marginTop: -40,
          borderRadius: '50%', border: '2px solid var(--teal-300)',
          pointerEvents: 'none',
        }} />
        <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 6 }}>
          Drop your lab PDF here
        </div>
        <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
          PDF · JPG · PNG · any format
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Extracting biomarkers…</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal-600)' }}>94%</span>
        </div>
        <div style={{ height: 4, background: 'var(--gray-100)', borderRadius: 2, overflow: 'hidden' }}>
          <div className="fill-bar" style={{ height: '100%', width: '94%', background: 'var(--teal-500)', borderRadius: 2 }} />
        </div>
      </div>
    </div>
  )
}

/* ── Row 2 — AI Analysis ── */
function AIAnalysisVisual() {
  const lines = [
    { label: 'Vitamin D', value: '18.5 ng/mL', status: 'DEFICIENT', color: '#e53935' },
    { label: 'Ferritin',  value: '12 ng/mL',   status: 'DEFICIENT', color: '#e53935' },
    { label: 'B12',       value: '310 pg/mL',  status: 'OPTIMAL',   color: '#1D9E75' },
    { label: 'TSH',       value: '2.4 mIU/L',  status: 'OPTIMAL',   color: '#1D9E75' },
  ]
  return (
    <div style={{
      background: '#111', borderRadius: 20,
      border: '0.5px solid rgba(255,255,255,0.08)', padding: '28px 24px',
      fontFamily: '"SF Mono", "Fira Code", monospace',
    }}>
      <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 16 }}>
        {'// AI analysis output'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {lines.map(({ label, value, status, color }) => (
          <div key={label} className="typewriter-line" style={{
            fontSize: 13, color: 'rgba(255,255,255,0.8)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>
              <span style={{ color: 'var(--teal-300)' }}>"</span>
              {label}
              <span style={{ color: 'var(--teal-300)' }}>"</span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>: </span>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>"{value}"</span>
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
              color, background: `${color}20`, padding: '2px 8px', borderRadius: 4,
            }}>
              {status}
            </span>
          </div>
        ))}
      </div>
      <div className="typewriter-badge" style={{
        marginTop: 20, padding: '8px 14px', borderRadius: 8,
        background: '#1D9E7520', border: '0.5px solid var(--teal-500)',
        fontSize: 12, fontWeight: 700, color: 'var(--teal-300)', textAlign: 'center',
      }}>
        ✓ AI Analysis complete — 4 biomarkers classified
      </div>
    </div>
  )
}

/* ── Row 3 — Protocol ── */
const SUPPLEMENTS = [
  { name: 'Vitamin D3',         dose: '5000 IU',  timing: 'Morning',  priority: 'HIGH',   color: '#e53935' },
  { name: 'Iron Bisglycinate',  dose: '25 mg',    timing: 'Evening',  priority: 'HIGH',   color: '#e53935' },
  { name: 'Magnesium Glycinate',dose: '400 mg',   timing: 'Bedtime',  priority: 'MEDIUM', color: '#f5a623' },
]

function ProtocolVisual() {
  return (
    <div style={{
      background: 'var(--gray-50)', borderRadius: 20,
      border: '0.5px solid var(--gray-100)', padding: 28,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-900)' }}>Your protocol</div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>6 supplements · Est. $67/mo</div>
        </div>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'conic-gradient(var(--teal-500) 87%, var(--gray-100) 0)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'var(--gray-50)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: 'var(--teal-600)',
          }}>
            87%
          </div>
        </div>
      </div>
      {SUPPLEMENTS.map(({ name, dose, timing, priority, color }) => (
        <div key={name} style={{
          background: 'var(--teal-50)', border: '0.5px solid var(--teal-100)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 10,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-900)' }}>{name}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{dose} · {timing}</div>
          </div>
          <span style={{
            fontSize: 9, fontWeight: 700, color, background: `${color}15`,
            padding: '2px 7px', borderRadius: 4, letterSpacing: '0.06em',
          }}>
            {priority}
          </span>
        </div>
      ))}
      <a href="/login" style={{
        display: 'block', marginTop: 16, textAlign: 'center',
        color: 'var(--teal-600)', fontSize: 13, fontWeight: 600,
        textDecoration: 'none',
      }} onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline' }}
         onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none' }}>
        Order all on iHerb →
      </a>
    </div>
  )
}

function ProtocolText() {
  return (
    <div>
      <SectionLabel n={3} />
      <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--gray-900)', marginBottom: 16, lineHeight: 1.15 }}>
        Your personalized protocol
      </h2>
      <p style={{ fontSize: 17, color: 'var(--gray-500)', lineHeight: 1.65 }}>
        Not a generic supplement list. A precise, evidence-based protocol matching your exact deficiencies,
        symptoms, age, and sex. Every recommendation backed by clinical rationale.
      </p>
      <BulletList items={[
        'Dosage, timing, and form specified per supplement',
        'Priority-ranked by deficiency severity',
        'Clinical rationale for each recommendation',
        'One-click purchase via iHerb or Amazon',
      ]} />
    </div>
  )
}

/* ── Row 4 — Avatar mini preview ── */
function MiniAvatarSVG({ zoneColors }) {
  const { brain, heart, muscles, bones, gut } = zoneColors
  return (
    <svg viewBox="0 0 200 380" width="100%" style={{ maxHeight: 280, display: 'block' }} aria-label="Body health map">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Silhouette */}
      <g fill="#1a1a1e">
        <circle cx="100" cy="36" r="26" />
        <rect x="88" y="62" width="24" height="20" rx="5"/>
        <path d="M42,82 L158,82 L148,195 L52,195 Z" />
        <path d="M42,82 L18,90 L16,182 L40,182 L48,98 Z" />
        <path d="M158,82 L182,90 L184,182 L160,182 L152,98 Z" />
        <path d="M52,195 L148,195 L154,228 L46,228 Z" />
        <path d="M46,228 L93,228 L90,374 L49,374 Z" />
        <path d="M107,228 L154,228 L151,374 L110,374 Z" />
      </g>

      {/* Zone glows */}
      <circle cx="100" cy="36" r="26" fill={brain} opacity="0.45" filter="url(#glow)" className="zone-pulse" />
      <ellipse cx="94" cy="130" rx="22" ry="18" fill={heart} opacity="0.45" filter="url(#glow)" className="zone-pulse" style={{ animationDelay: '0.4s' }} />
      <g fill={muscles} opacity="0.4" filter="url(#glow)" className="zone-pulse" style={{ animationDelay: '0.8s' }}>
        <path d="M42,82 L18,90 L16,182 L40,182 L48,98 Z" />
        <path d="M158,82 L182,90 L184,182 L160,182 L152,98 Z" />
      </g>
      <g fill={bones} opacity="0.35" filter="url(#glow)" className="zone-pulse" style={{ animationDelay: '1.2s' }}>
        <path d="M46,228 L93,228 L90,374 L49,374 Z" />
        <path d="M107,228 L154,228 L151,374 L110,374 Z" />
      </g>
      <ellipse cx="100" cy="170" rx="38" ry="25" fill={gut} opacity="0.4" filter="url(#glow)" className="zone-pulse" style={{ animationDelay: '1.6s' }} />
    </svg>
  )
}

function AvatarRowVisual() {
  return (
    <div style={{
      background: '#111', borderRadius: 20,
      border: '0.5px solid rgba(255,255,255,0.08)', padding: 28,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <MiniAvatarSVG
        zoneColors={{
          brain:   '#f5a623',
          heart:   '#1D9E75',
          muscles: '#e53935',
          bones:   '#e53935',
          gut:     '#f5a623',
        }}
      />
      <div style={{
        marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center',
      }}>
        {[['Brain', '#f5a623', 'ATTENTION'], ['Heart', '#1D9E75', 'OPTIMAL'], ['Muscles', '#e53935', 'CRITICAL']].map(([z, c, s]) => (
          <div key={z} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'rgba(255,255,255,0.7)',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
            {z} — <span style={{ color: c }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Row 5 — Track & Progress chart ── */
function ProgressChartVisual() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <div style={{
      background: 'var(--gray-50)', borderRadius: 20,
      border: '0.5px solid var(--gray-100)', padding: 28,
    }}>
      {/* Timeline entries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {[
          { date: 'Jan 15', label: '4 deficiencies found',    color: '#e53935', bg: '#feecec' },
          { date: 'Apr 20', label: '2 deficiencies remaining', color: '#f5a623', bg: '#fff8ec' },
          { date: 'Jul 8',  label: '0 deficiencies ✓',        color: '#1D9E75', bg: 'var(--teal-50)' },
        ].map(({ date, label, color, bg }, i) => (
          <div key={date} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: i === 2 ? 'var(--teal-50)' : 'white',
            borderRadius: 12, padding: '12px 16px',
            border: `0.5px solid ${i === 2 ? 'var(--teal-300)' : 'var(--gray-100)'}`,
          }}>
            <span style={{ fontSize: 12, color: 'var(--gray-500)', minWidth: 44 }}>{date}</span>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: i === 2 ? 600 : 400, color: i === 2 ? 'var(--teal-700)' : 'var(--gray-700)' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Chart */}
      {mounted && (
        <>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>Biomarker trend</div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={CHART_DATA} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'white', border: '0.5px solid var(--gray-100)', borderRadius: 8, fontSize: 12 }}
              />
              <Line type="monotone" dataKey="vitaminD" stroke="var(--teal-500)" strokeWidth={2} dot={false} name="Vitamin D" />
              <Line type="monotone" dataKey="ferritin"  stroke="var(--teal-300)" strokeWidth={2} dot={false} name="Ferritin" strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--teal-500)' }}>— Vitamin D +89%</span>
            <span style={{ fontSize: 11, color: 'var(--teal-300)' }}>- - Ferritin +267%</span>
          </div>
        </>
      )}
    </div>
  )
}

/* ── ROWS CONFIG ── */
const ROWS = [
  {
    reversed: false,
    text: (
      <div>
        <SectionLabel n={1} />
        <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--gray-900)', marginBottom: 16, lineHeight: 1.15 }}>
          Upload any lab result
        </h2>
        <p style={{ fontSize: 17, color: 'var(--gray-500)', lineHeight: 1.65 }}>
          Drag and drop a PDF or photo from Quest, LabCorp, or any private lab worldwide.
          Our browser-based OCR reads it instantly — your file never touches our servers.
        </p>
        <BulletList items={[
          'PDF, JPG, PNG supported',
          'Quest · LabCorp · SonoHealth · 50+ labs',
          'Works with foreign-language labs (EU, UAE, LATAM)',
          'Manual text paste fallback',
        ]} />
      </div>
    ),
    visual: <UploadVisual />,
  },
  {
    reversed: true,
    text: (
      <div>
        <SectionLabel n={2} />
        <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--gray-900)', marginBottom: 16, lineHeight: 1.15 }}>
          AI reads every biomarker
        </h2>
        <p style={{ fontSize: 17, color: 'var(--gray-500)', lineHeight: 1.65 }}>
          Claude AI extracts all values, units, and reference ranges — then classifies each as OPTIMAL,
          BORDERLINE, DEFICIENT, or ELEVATED. Correlated with your reported symptoms for deeper insight.
        </p>
        <BulletList items={[
          '50+ biomarkers recognized',
          'Symptom correlation (fatigue, insomnia, brain fog...)',
          'Powered by Anthropic Claude',
          'Results in under 60 seconds',
        ]} />
      </div>
    ),
    visual: <AIAnalysisVisual />,
  },
  {
    reversed: false,
    text: <ProtocolText />,
    visual: <ProtocolVisual />,
  },
  {
    reversed: true,
    text: (
      <div>
        <SectionLabel n={4} />
        <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--gray-900)', marginBottom: 16, lineHeight: 1.15 }}>
          Meet your Digital Health Avatar
        </h2>
        <p style={{ fontSize: 17, color: 'var(--gray-500)', lineHeight: 1.65 }}>
          A living visual map of your biology. Every biomarker deficiency lights up on your personal avatar —
          showing exactly which body systems need attention. Updated with every new lab upload.
        </p>
        <BulletList items={[
          '5 body systems tracked',
          'Color-coded by severity',
          'Linked to supplement protocol',
          'See changes over time',
        ]} />
      </div>
    ),
    visual: <AvatarRowVisual />,
  },
  {
    reversed: false,
    text: (
      <div>
        <SectionLabel n={5} />
        <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--gray-900)', marginBottom: 16, lineHeight: 1.15 }}>
          Track your progress for years
        </h2>
        <p style={{ fontSize: 17, color: 'var(--gray-500)', lineHeight: 1.65 }}>
          Re-upload your labs every 90 days. Watch your biomarkers improve. VITALOOP remembers every result
          you've ever uploaded — your complete health history in one place, forever.
        </p>
        <BulletList items={[
          'Unlimited upload history',
          'Visual trend charts per biomarker',
          'Improvement score tracking',
          '90-day re-test reminders',
        ]} />
      </div>
    ),
    visual: <ProgressChartVisual />,
  },
]

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" style={{ padding: '160px 24px', background: 'var(--white)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* Header */}
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 100 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--teal-500)', marginBottom: 16,
          }}>
            The VITALOOP Method
          </div>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--gray-900)', marginBottom: 20,
          }}>
            Your complete health intelligence loop
          </h2>
          <p style={{ fontSize: 17, color: 'var(--gray-500)', maxWidth: 560, margin: '0 auto', lineHeight: 1.65 }}>
            From first blood draw to years of optimized living — every step guided by AI.
          </p>
        </div>

        {/* 5 alternating rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 100 }}>
          {ROWS.map(({ reversed, text, visual }, i) => (
            <div key={i} className={`reveal grid md:grid-cols-2 gap-16 items-center`}>
              <div className={reversed ? 'md:order-2' : ''}>{text}</div>
              <div className={reversed ? 'md:order-1' : ''}>{visual}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
