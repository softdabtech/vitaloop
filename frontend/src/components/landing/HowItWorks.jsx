import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import NeonBody from './NeonBody.jsx'

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
        <div style={{ marginBottom: 12 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--teal-500)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h3.5L10 7h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
          </svg>
        </div>
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
          <div className="fill-bar" style={{ height: '100%', width: '94%', background: 'var(--teal-500)', borderRadius: 2, willChange: 'width' }} />
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
        Get personalized weekly guidance
      </h2>
      <p style={{ fontSize: 17, color: 'var(--gray-500)', lineHeight: 1.65 }}>
        Your plan is updated from both biomarkers and symptoms, then reinforced through weekly follow-ups.
        Clear priorities help you focus on the most impactful next action.
      </p>
      <BulletList items={[
        'Actionable protocol with dosage and timing',
        'Priority-ranked by deficiency and symptom severity',
        'Weekly check-in loop for adherence and response',
        'Educational guidance, not a medical diagnosis',
      ]} />
    </div>
  )
}

function AvatarRowVisual() {
  return (
    <div style={{
      background: '#111', borderRadius: 20,
      border: '0.5px solid rgba(255,255,255,0.08)', padding: 28,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <NeonBody
        zones={{
          brain: '#f5a623',
          heart: '#1D9E75',
          muscles: '#e53935',
          bones: '#e53935',
          gut: '#f5a623',
        }}
        size={200}
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
          Upload your latest lab results
        </h2>
        <p style={{ fontSize: 17, color: 'var(--gray-500)', lineHeight: 1.65 }}>
          Start with what you already have: a PDF from Quest, LabCorp, or your local clinic.
          We parse biomarkers and build your baseline so future trends are easy to track.
        </p>
        <BulletList items={[
          'PDF, JPG, PNG supported',
          'Quest, LabCorp, and international lab formats',
          'Structured biomarker extraction with reference ranges',
          'Your first timeline event is created automatically',
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
          Add symptoms and recurring complaints
        </h2>
        <p style={{ fontSize: 17, color: 'var(--gray-500)', lineHeight: 1.65 }}>
          Lab values alone are not enough. VITALOOP combines biomarkers with your energy,
          sleep, mood, and recurring complaints to personalize interpretation.
        </p>
        <BulletList items={[
          'Onboarding captures goals and health context',
          'Recurring symptoms become part of your baseline',
          'Context-aware interpretation for better prioritization',
          'Built for longitudinal health management',
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
          Spot red flags early and escalate safely
        </h2>
        <p style={{ fontSize: 17, color: 'var(--gray-500)', lineHeight: 1.65 }}>
          Weekly signals from sleep, mood, and energy can reveal risk before it becomes a bigger issue.
          Severe patterns trigger alerts so you can seek physician care in time.
        </p>
        <BulletList items={[
          'Automatic red-flag detection from low check-in scores',
          'In-app alerts for high-priority issues',
          'Acknowledge and monitor critical events',
          'Escalation path to licensed medical professionals',
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
          See your health trends over time
        </h2>
        <p style={{ fontSize: 17, color: 'var(--gray-500)', lineHeight: 1.65 }}>
          Your timeline combines labs, complaints, check-ins, insights, and interventions into one longitudinal record.
          This makes progress visible and future decisions smarter.
        </p>
        <BulletList items={[
          'Unified timeline across all health signals',
          'Trend charts for biomarkers and symptoms',
          'Weekly insight generation and health score updates',
          'Structured history for your next physician visit',
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
            A weekly health loop, not a one-time report
          </h2>
          <p style={{ fontSize: 17, color: 'var(--gray-500)', maxWidth: 560, margin: '0 auto', lineHeight: 1.65 }}>
            Start with labs, add symptoms, get guidance, check in weekly, and watch trends evolve over time.
          </p>
        </div>

        {/* 5 alternating rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 72 }}>
          {ROWS.map(({ reversed, text, visual }, i) => (
            <div key={i} className="reveal grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
              <div className={reversed ? 'md:order-2' : ''}>{text}</div>
              <div className={reversed ? 'md:order-1' : ''}>{visual}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
