import { Pill, UtensilsCrossed, Zap, Check, ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { stagger, staggerChild, fadeUp, viewport } from '../../lib/motion.js'

const FEATURES = [
  {
    icon: Pill,
    title: 'Supplement Protocol',
    desc: 'Exactly as in your cabinet: Supplement/Dosage, Rationale, Daily Schedule, and Priority in one table.',
  },
  {
    icon: UtensilsCrossed,
    title: 'Nutrition Plan',
    desc: 'Food groups are prioritised by flagged biomarkers, matching the same Nutrition Plan section in your protocol page.',
  },
  {
    icon: Zap,
    title: 'Lifestyle Recommendations',
    desc: 'Hydration, sleep, and exercise blocks with clear daily checklists — the same structure shown in the cabinet.',
  },
  {
    icon: ArrowRight,
    title: 'Export PDF',
    desc: 'Premium users can export the full 7-Day Health Protocol as PDF directly from the protocol view.',
  },
]

// Mock supplement rows shown in the visual preview
const MOCK_ROWS = [
  { name: 'Vitamin D3', dose: '2000 IU', rationale: 'Low Vitamin D support', time: '8:00 am', priority: 'HIGH', highlight: true },
  { name: 'Omega-3', dose: '1000 mg', rationale: 'Cardio-inflammatory balance', time: '12:00 pm · 6:00 pm', priority: 'HIGH', highlight: false },
  { name: 'Magnesium', dose: '400 mg', rationale: 'Sleep and recovery support', time: '9:00 pm', priority: 'MEDIUM', highlight: false },
]

const PRIORITY_COLORS = {
  HIGH: { bg: 'rgba(239,68,68,0.1)', text: '#b91c1c' },
  MEDIUM: { bg: 'rgba(245,158,11,0.1)', text: '#92400e' },
  LOW: { bg: 'rgba(100,116,139,0.1)', text: '#475569' },
}

export default function ProtocolFeatureSection() {
  const reduced = useReducedMotion()
  const navigate = useNavigate()

  const cardBase = {
    borderRadius: 16,
    border: '0.5px solid var(--gray-100)',
    background: 'var(--gray-50)',
    padding: '24px 20px',
  }

  return (
    <section
      id="protocol-feature"
      style={{ padding: 'var(--py-xl) 24px', backgroundColor: 'var(--white)', borderTop: '0.5px solid var(--gray-100)' }}
    >
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* Header */}
        <motion.div
          variants={reduced ? {} : stagger(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={viewport('-60px')}
          style={{ textAlign: 'center', marginBottom: 64 }}
        >
          <motion.div
            variants={reduced ? {} : staggerChild}
            style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--teal-500)', marginBottom: 12 }}
          >
            Your Personalized Protocol
          </motion.div>
          <motion.h2
            variants={reduced ? {} : staggerChild}
            style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--gray-900)', marginBottom: 16, lineHeight: 1.15 }}
          >
            Your 7-Day Health Plan — at a Glance
          </motion.h2>
          <motion.p
            variants={reduced ? {} : staggerChild}
            style={{ fontSize: 17, color: 'var(--gray-500)', maxWidth: 520, margin: '0 auto', lineHeight: 1.65 }}
          >
            After each lab upload, your cabinet shows a structured plan with Supplement Protocol, Nutrition Plan, Lifestyle Recommendations, and Export PDF.
          </motion.p>
        </motion.div>

        {/* Two-column layout: mock UI left, feature cards right */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}
          className="protocol-feature-grid">

          {/* ── Mock Protocol UI preview ── */}
          <motion.div
            variants={reduced ? {} : fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewport('-40px')}
            style={{
              borderRadius: 20,
              border: '0.5px solid var(--gray-200)',
              background: 'var(--white)',
              overflow: 'hidden',
              boxShadow: '0 4px 32px rgba(0,0,0,0.07)',
            }}
          >
            {/* Mock top bar */}
            <div style={{ background: 'linear-gradient(135deg, #10b981, #0d9488)', padding: '20px 20px 16px', color: 'white' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.75, marginBottom: 4 }}>
                Personalized Protocol
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Your 7-Day Health Plan</div>
              <div style={{ display: 'flex', gap: 20 }}>
                {[['3', 'Supplements'], ['3', 'Food Groups'], ['3', 'Lifestyle Areas']].map(([n, l]) => (
                  <div key={l}>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{n}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mock Nutrition cards */}
            <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--gray-100)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                Nutrition Plan
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { name: 'Leafy Greens', color: '#10b981', light: false },
                  { name: 'Lean Proteins', color: '#0d9488', light: false },
                  { name: 'Healthy Fats', color: null, light: true },
                ].map(({ name, color, light }) => (
                  <div key={name} style={{
                    borderRadius: 10,
                    padding: '8px 10px',
                    background: light ? 'var(--gray-50)' : color,
                    border: light ? '0.5px solid var(--gray-200)' : 'none',
                    fontSize: 11,
                    fontWeight: 600,
                    color: light ? 'var(--gray-700)' : 'white',
                  }}>
                    {name}
                    <div style={{ fontSize: 9, opacity: light ? 0.5 : 0.7, marginTop: 2, fontWeight: 400 }}>
                      {light ? 'Avocado, salmon, nuts' : 'Personalised foods'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mock Supplement table */}
            <div style={{ padding: '0 0 4px' }}>
              <div style={{ padding: '10px 16px 6px', fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Supplement Protocol
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: 'var(--gray-50)', borderBottom: '0.5px solid var(--gray-100)' }}>
                    {['Supplement / Dosage', 'Rationale', 'Daily Schedule', 'Priority'].map((h) => (
                      <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontSize: 9, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MOCK_ROWS.map((row) => {
                    const pc = PRIORITY_COLORS[row.priority]
                    return (
                      <tr key={row.name} style={{ background: row.highlight ? 'rgba(16,185,129,0.06)' : 'transparent', borderBottom: '0.5px solid var(--gray-100)' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{row.name}</div>
                          <div style={{ fontSize: 9, color: 'var(--gray-400)' }}>{row.dose}</div>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--gray-600)' }}>{row.rationale}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>{row.time}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ background: pc.bg, color: pc.text, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {row.priority}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mock Lifestyle row */}
            <div style={{ padding: '12px 16px', borderTop: '0.5px solid var(--gray-100)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { label: 'Hydration', color: '#3b82f6', checks: ['2–3 L daily', 'Electrolytes'] },
                { label: 'Sleep', color: '#6366f1', checks: ['7–9 hours', 'Consistent schedule'] },
                { label: 'Exercise', color: '#10b981', checks: ['3× strength', 'Morning walks'] },
              ].map(({ label, color, checks }) => (
                <div key={label} style={{ borderRadius: 10, border: '0.5px solid var(--gray-200)', background: 'var(--gray-50)', padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 6 }}>{label}</div>
                  {checks.map((c) => (
                    <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--gray-500)', marginBottom: 3 }}>
                      <Check size={9} color={color} />
                      {c}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Feature cards ── */}
          <motion.div
            variants={reduced ? {} : stagger(0.1)}
            initial="hidden"
            whileInView="visible"
            viewport={viewport('-40px')}
            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
          >
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <motion.div key={title} variants={reduced ? {} : staggerChild} style={cardBase}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(16,185,129,0.1)',
                  border: '0.5px solid rgba(16,185,129,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#059669', marginBottom: 12,
                }}>
                  <Icon size={18} strokeWidth={1.8} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 14, color: 'var(--gray-500)', lineHeight: 1.6 }}>{desc}</div>
              </motion.div>
            ))}

            <motion.div variants={reduced ? {} : staggerChild}>
              <button
                onClick={() => navigate('/login')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: '#10b981', color: 'white',
                  padding: '13px 24px', borderRadius: 12, border: 'none',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#059669' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#10b981' }}
              >
                Get your protocol
                <ArrowRight size={16} />
              </button>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .protocol-feature-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}
