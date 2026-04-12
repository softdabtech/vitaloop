import { useState } from 'react'

/* ── Zone data ── */
const ZONES = {
  brain: {
    id: 'brain',
    label: 'Brain & Cognition',
    status: 'attention',
    biomarkers: [
      { name: 'B12', value: '185 pg/mL', status: 'DEFICIENT', color: '#e53935', pct: 22 },
      { name: 'Omega-3 Index', value: '3.2%', status: 'DEFICIENT', color: '#e53935', pct: 18 },
    ],
    supplements: ['Methylcobalamin 2mg sublingual', 'Omega-3 2000mg EPA/DHA'],
  },
  heart: {
    id: 'heart',
    label: 'Cardiovascular',
    status: 'optimal',
    biomarkers: [
      { name: 'CoQ10', value: 'Sufficient', status: 'OPTIMAL', color: '#1D9E75', pct: 82 },
      { name: 'Magnesium', value: '2.1 mg/dL', status: 'OPTIMAL', color: '#1D9E75', pct: 78 },
    ],
    supplements: ['CoQ10 Ubiquinol 100mg maintenance', 'Magnesium Glycinate 200mg'],
  },
  muscles: {
    id: 'muscles',
    label: 'Muscles & Energy',
    status: 'critical',
    biomarkers: [
      { name: 'Ferritin', value: '12 ng/mL', status: 'DEFICIENT', color: '#e53935', pct: 18 },
      { name: 'Iron', value: '45 mcg/dL', status: 'DEFICIENT', color: '#e53935', pct: 22 },
    ],
    supplements: ['Iron Bisglycinate 25mg', 'Vitamin C 500mg (iron absorption)'],
  },
  bones: {
    id: 'bones',
    label: 'Bones & Joints',
    status: 'critical',
    biomarkers: [
      { name: 'Vitamin D', value: '18.5 ng/mL', status: 'DEFICIENT', color: '#e53935', pct: 15 },
      { name: 'Calcium', value: '8.9 mg/dL', status: 'BORDERLINE', color: '#f5a623', pct: 55 },
    ],
    supplements: ['Vitamin D3 5000 IU', 'Vitamin K2 MK-7 100mcg'],
  },
  gut: {
    id: 'gut',
    label: 'Gut & Digestion',
    status: 'borderline',
    biomarkers: [
      { name: 'Zinc', value: '68 mcg/dL', status: 'BORDERLINE', color: '#f5a623', pct: 48 },
    ],
    supplements: ['Zinc Picolinate 25mg', 'Digestive Enzymes with meals'],
  },
}

const STATUS = {
  optimal:    { color: '#1D9E75', label: 'OPTIMAL',    bg: '#1D9E7520' },
  attention:  { color: '#f5a623', label: 'ATTENTION',  bg: '#f5a62320' },
  borderline: { color: '#f5a623', label: 'BORDERLINE', bg: '#f5a62320' },
  critical:   { color: '#e53935', label: 'CRITICAL',   bg: '#e5393520' },
}

const ZONE_ORDER = ['brain', 'heart', 'muscles', 'bones', 'gut']

/* ── SVG Body ── */
function BodySVG({ activeZone, hoveredZone, onZoneClick, onZoneHover }) {
  const getColor = (zoneId) => {
    const isActive  = activeZone  === zoneId
    const isHovered = hoveredZone === zoneId
    const s = STATUS[ZONES[zoneId].status]
    return {
      fill: s.color,
      opacity: isActive ? 0.75 : isHovered ? 0.55 : 0.35,
    }
  }

  const zoneProps = (id) => ({
    onClick: () => onZoneClick(id),
    onMouseEnter: () => onZoneHover(id),
    onMouseLeave: () => onZoneHover(null),
    style: { cursor: 'pointer', transition: 'opacity 250ms ease' },
    role: 'button',
    tabIndex: 0,
    'aria-label': `${ZONES[id].label} — ${STATUS[ZONES[id].status].label}`,
    onKeyDown: (e) => e.key === 'Enter' && onZoneClick(id),
  })

  return (
    <svg viewBox="0 0 200 390" width="100%" style={{ maxHeight: 480, display: 'block' }}>
      <defs>
        <filter id="av-glow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        {/* Hex grid pattern */}
        <pattern id="hexGrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M10 2 L18 6 L18 14 L10 18 L2 14 L2 6 Z" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5"/>
        </pattern>
      </defs>

      {/* Background */}
      <rect width="200" height="390" fill="#0d1412" rx="16"/>
      <rect width="200" height="390" fill="url(#hexGrid)" rx="16"/>

      {/* Silhouette */}
      <g fill="#2a2a2e">
        <circle cx="100" cy="36" r="27"/>
        <rect x="88" y="63" width="24" height="20" rx="5"/>
        <path d="M40,83 L160,83 L148,196 L52,196 Z"/>
        <path d="M40,83 L16,92 L14,182 L38,182 L48,100 Z"/>
        <path d="M160,83 L184,92 L186,182 L162,182 L152,100 Z"/>
        <path d="M52,196 L148,196 L154,230 L46,230 Z"/>
        <path d="M46,230 L92,230 L89,378 L49,378 Z"/>
        <path d="M108,230 L154,230 L151,378 L111,378 Z"/>
      </g>

      {/* Zone glows */}
      <g filter="url(#av-glow)">
        {/* Brain */}
        <g {...zoneProps('brain')} className={activeZone === 'brain' ? 'zone-pulse' : ''}>
          <circle cx="100" cy="36" r="27" {...getColor('brain')} />
        </g>

        {/* Heart */}
        <g {...zoneProps('heart')} className={activeZone === 'heart' ? 'zone-pulse' : ''}>
          <ellipse cx="93" cy="130" rx="24" ry="20" {...getColor('heart')} />
        </g>

        {/* Muscles (arms) */}
        <g {...zoneProps('muscles')} className={activeZone === 'muscles' ? 'zone-pulse' : ''}>
          <path d="M40,83 L16,92 L14,182 L38,182 L48,100 Z" {...getColor('muscles')} />
          <path d="M160,83 L184,92 L186,182 L162,182 L152,100 Z" {...getColor('muscles')} />
        </g>

        {/* Bones (legs) */}
        <g {...zoneProps('bones')} className={activeZone === 'bones' ? 'zone-pulse' : ''}>
          <path d="M46,230 L92,230 L89,378 L49,378 Z" {...getColor('bones')} />
          <path d="M108,230 L154,230 L151,378 L111,378 Z" {...getColor('bones')} />
        </g>

        {/* Gut */}
        <g {...zoneProps('gut')} className={activeZone === 'gut' ? 'zone-pulse' : ''}>
          <ellipse cx="100" cy="170" rx="40" ry="26" {...getColor('gut')} />
        </g>
      </g>

      {/* Floating labels */}
      {ZONE_ORDER.map((id) => {
        const labelPositions = {
          brain:   { x: 140, y: 36,  lx: 130, ly: 36 },
          heart:   { x: 140, y: 130, lx: 130, ly: 130 },
          muscles: { x: 8,   y: 135, lx: 8,   ly: 135 },
          bones:   { x: 155, y: 300, lx: 145, ly: 300 },
          gut:     { x: 145, y: 170, lx: 135, ly: 170 },
        }
        const pos  = labelPositions[id]
        const isLeft = id === 'muscles'
        const zone = ZONES[id]
        const stat = STATUS[zone.status]
        const isHighlighted = activeZone === id || hoveredZone === id

        return (
          <g key={id} opacity={isHighlighted ? 1 : 0.55} style={{ transition: 'opacity 250ms' }}>
            <line
              x1={isLeft ? pos.lx + 50 : pos.lx}
              y1={pos.ly}
              x2={isLeft ? pos.lx + 24 : pos.lx + 26}
              y2={pos.ly}
              stroke={stat.color}
              strokeWidth="0.8"
              strokeDasharray="3 2"
            />
            <text
              x={isLeft ? pos.x + 52 : pos.x}
              y={pos.y - 4}
              fontSize="7"
              fill="rgba(255,255,255,0.8)"
              textAnchor={isLeft ? 'start' : 'end'}
            >
              {zone.label}
            </text>
            <text
              x={isLeft ? pos.x + 52 : pos.x}
              y={pos.y + 6}
              fontSize="6"
              fill={stat.color}
              textAnchor={isLeft ? 'start' : 'end'}
            >
              {stat.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ── Zone detail panel ── */
function ZonePanel({ zone }) {
  const z = ZONES[zone]
  const stat = STATUS[z.status]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: 0 }}>{z.label}</h3>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            color: stat.color, background: stat.bg, padding: '3px 9px', borderRadius: 6,
          }}>
            {stat.label}
          </span>
        </div>
      </div>

      {/* Biomarkers */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 10 }}>
          Biomarkers
        </div>
        {z.biomarkers.map(({ name, value, status, color, pct }) => (
          <div key={name} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>{name}</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{value}</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color, marginTop: 3 }}>{status}</div>
          </div>
        ))}
      </div>

      {/* Supplements */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 10 }}>
          Recommended supplements
        </div>
        {z.supplements.map((s) => (
          <div key={s} style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
            fontSize: 13, color: 'rgba(255,255,255,0.7)',
          }}>
            <span style={{ color: 'var(--teal-400)', fontSize: 12 }}>✓</span>
            {s}
          </div>
        ))}
      </div>

      <button style={{
        marginTop: 20,
        background: 'var(--teal-800)', color: 'white',
        border: 'none', borderRadius: 980, padding: '10px 20px',
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
        transition: 'background 200ms',
        alignSelf: 'flex-start',
      }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--teal-600)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--teal-800)' }}
      >
        View full protocol →
      </button>
    </div>
  )
}

export default function BodyAvatar() {
  const [activeZone,  setActiveZone]  = useState('brain')
  const [hoveredZone, setHoveredZone] = useState(null)

  return (
    <div
      style={{
        background: '#111',
        borderRadius: 20,
        border: '0.5px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
      }}
      className="md:grid-cols-2"
    >
      {/* SVG side */}
      <div style={{ padding: 24 }}>
        <BodySVG
          activeZone={activeZone}
          hoveredZone={hoveredZone}
          onZoneClick={setActiveZone}
          onZoneHover={setHoveredZone}
        />
      </div>

      {/* Panel side */}
      <div style={{ borderLeft: '0.5px solid rgba(255,255,255,0.08)', padding: 28 }}>
        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24,
        }}>
          {ZONE_ORDER.map((id) => {
            const s = STATUS[ZONES[id].status]
            const isActive = activeZone === id
            return (
              <button
                key={id}
                onClick={() => setActiveZone(id)}
                style={{
                  background: isActive ? s.bg : 'transparent',
                  border: `0.5px solid ${isActive ? s.color : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 8, padding: '5px 12px',
                  fontSize: 12, fontWeight: 600,
                  color: isActive ? s.color : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer', transition: 'all 200ms',
                }}
              >
                {ZONES[id].label.split(' ')[0]}
              </button>
            )
          })}
        </div>

        <ZonePanel zone={activeZone} />
      </div>
    </div>
  )
}
