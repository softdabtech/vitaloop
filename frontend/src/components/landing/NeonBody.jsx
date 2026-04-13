import { useState, useRef } from 'react'

/**
 * NeonBody - particle/neon human silhouette with colored health zones
 *
 * Props:
 *   zones: { brain, heart, muscles, bones, gut } - hex colors
 *   size: number - width in px (height auto)
 *   interactive: bool - show click/hover labels
 *   activeZone: string - controlled active zone id
 *   onZoneClick: fn(id)
 */

const ZONE_DEFS = {
  brain:   { label: 'Brain & Cognition', cx: 100, cy: 36, rx: 27, ry: 27, shape: 'circle' },
  heart:   { label: 'Cardiovascular', cx: 93, cy: 130, rx: 24, ry: 20, shape: 'ellipse' },
  muscles: { label: 'Muscles & Energy', cx: 100, cy: 135, rx: 60, ry: 50, shape: 'arms' },
  bones:   { label: 'Bones & Structure', cx: 100, cy: 300, rx: 40, ry: 80, shape: 'legs' },
  gut:     { label: 'Gut & Digestion', cx: 100, cy: 170, rx: 40, ry: 26, shape: 'ellipse' },
}

function ParticleField({ color, cx, cy, rx, ry, count = 28, active }) {
  const particles = useRef([])

  if (particles.current.length === 0) {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + (i * 0.37)
      const r = 0.4 + (i % 7) * 0.1
      particles.current.push({
        x: cx + Math.cos(angle) * rx * r,
        y: cy + Math.sin(angle) * ry * r,
        size: 1.2 + (i % 5) * 0.5,
        opacity: 0.35 + (i % 6) * 0.09,
      })
    }
  }

  return (
    <>
      {particles.current.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={active ? p.size * 1.3 : p.size}
          fill={color}
          opacity={active ? Math.min(p.opacity * 1.5, 0.9) : p.opacity}
          style={{ transition: 'opacity 300ms ease, r 300ms ease' }}
        />
      ))}
    </>
  )
}

function ConnectionLines({ zoneColors }) {
  const connections = [
    ['brain', 'heart'],
    ['heart', 'gut'],
    ['gut', 'muscles'],
    ['gut', 'bones'],
  ]
  return (
    <>
      {connections.map(([a, b]) => {
        const za = ZONE_DEFS[a]
        const zb = ZONE_DEFS[b]
        const ca = zoneColors[a]
        return (
          <line
            key={`${a}-${b}`}
            x1={za.cx}
            y1={za.cy}
            x2={zb.cx}
            y2={zb.cy}
            stroke={ca}
            strokeWidth="0.4"
            strokeDasharray="3 5"
            opacity="0.2"
          />
        )
      })}
    </>
  )
}

export function NeonBodyMini({ zones, size = 80 }) {
  const h = size * 2.0
  return (
    <svg viewBox="0 0 200 390" width={size} height={h} aria-hidden="true">
      <defs>
        <filter id={`glow-mini-${size}`}>
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="200" height="390" fill="#0d1412" rx="10" />

      <g fill="#1e2a24">
        <circle cx="100" cy="36" r="27" />
        <rect x="88" y="63" width="24" height="20" rx="5" />
        <path d="M40,83 L160,83 L148,196 L52,196 Z" />
        <path d="M40,83 L16,92 L14,182 L38,182 L48,100 Z" />
        <path d="M160,83 L184,92 L186,182 L162,182 L152,100 Z" />
        <path d="M52,196 L148,196 L154,230 L46,230 Z" />
        <path d="M46,230 L92,230 L89,378 L49,378 Z" />
        <path d="M108,230 L154,230 L151,378 L111,378 Z" />
      </g>

      <g filter={`url(#glow-mini-${size})`}>
        <ParticleField color={zones.brain} cx={100} cy={36} rx={27} ry={27} count={16} />
        <ParticleField color={zones.heart} cx={93} cy={130} rx={22} ry={18} count={12} />
        <ParticleField color={zones.muscles} cx={25} cy={137} rx={14} ry={45} count={10} />
        <ParticleField color={zones.muscles} cx={175} cy={137} rx={14} ry={45} count={10} />
        <ParticleField color={zones.gut} cx={100} cy={170} rx={38} ry={24} count={14} />
        <ParticleField color={zones.bones} cx={70} cy={300} rx={20} ry={74} count={12} />
        <ParticleField color={zones.bones} cx={130} cy={300} rx={20} ry={74} count={12} />
      </g>

      <ConnectionLines zoneColors={zones} />
    </svg>
  )
}

export default function NeonBody({ zones, interactive = false, activeZone: controlledZone, onZoneClick, size = 280 }) {
  const [hovered, setHovered] = useState(null)
  const [internal, setInternal] = useState('brain')
  const active = controlledZone !== undefined ? controlledZone : internal

  const handleClick = (id) => {
    if (onZoneClick) onZoneClick(id)
    else setInternal(id)
  }

  const h = size * 1.55

  return (
    <svg
      viewBox="0 0 200 390"
      width={size}
      height={h}
      role={interactive ? 'group' : 'img'}
      aria-label="Digital Health Avatar - body map"
    >
      <defs>
        <filter id="neon-glow">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id="hex-bg" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
          <path
            d="M9 1.5L16 5.5L16 13.5L9 17.5L2 13.5L2 5.5Z"
            fill="none"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="0.4"
          />
        </pattern>
      </defs>

      <rect width="200" height="390" fill="#080f0c" rx="0" />
      <rect width="200" height="390" fill="url(#hex-bg)" rx="0" />

      <g fill="#141f18">
        <circle cx="100" cy="36" r="27" />
        <rect x="88" y="63" width="24" height="20" rx="5" />
        <path d="M40,83 L160,83 L148,196 L52,196 Z" />
        <path d="M40,83 L16,92 L14,182 L38,182 L48,100 Z" />
        <path d="M160,83 L184,92 L186,182 L162,182 L152,100 Z" />
        <path d="M52,196 L148,196 L154,230 L46,230 Z" />
        <path d="M46,230 L92,230 L89,378 L49,378 Z" />
        <path d="M108,230 L154,230 L151,378 L111,378 Z" />
      </g>

      <g filter="url(#neon-glow)">
        <g
          onClick={() => interactive && handleClick('brain')}
          onMouseEnter={() => interactive && setHovered('brain')}
          onMouseLeave={() => interactive && setHovered(null)}
          style={{ cursor: interactive ? 'pointer' : 'default' }}
        >
          <ParticleField
            color={zones.brain}
            cx={100}
            cy={36}
            rx={27}
            ry={27}
            count={32}
            active={active === 'brain' || hovered === 'brain'}
          />
        </g>

        <g
          onClick={() => interactive && handleClick('heart')}
          onMouseEnter={() => interactive && setHovered('heart')}
          onMouseLeave={() => interactive && setHovered(null)}
          style={{ cursor: interactive ? 'pointer' : 'default' }}
        >
          <ParticleField
            color={zones.heart}
            cx={93}
            cy={130}
            rx={24}
            ry={20}
            count={22}
            active={active === 'heart' || hovered === 'heart'}
          />
        </g>

        <g
          onClick={() => interactive && handleClick('muscles')}
          onMouseEnter={() => interactive && setHovered('muscles')}
          onMouseLeave={() => interactive && setHovered(null)}
          style={{ cursor: interactive ? 'pointer' : 'default' }}
        >
          <ParticleField
            color={zones.muscles}
            cx={25}
            cy={137}
            rx={14}
            ry={45}
            count={18}
            active={active === 'muscles' || hovered === 'muscles'}
          />
          <ParticleField
            color={zones.muscles}
            cx={175}
            cy={137}
            rx={14}
            ry={45}
            count={18}
            active={active === 'muscles' || hovered === 'muscles'}
          />
        </g>

        <g
          onClick={() => interactive && handleClick('gut')}
          onMouseEnter={() => interactive && setHovered('gut')}
          onMouseLeave={() => interactive && setHovered(null)}
          style={{ cursor: interactive ? 'pointer' : 'default' }}
        >
          <ParticleField
            color={zones.gut}
            cx={100}
            cy={170}
            rx={40}
            ry={26}
            count={24}
            active={active === 'gut' || hovered === 'gut'}
          />
        </g>

        <g
          onClick={() => interactive && handleClick('bones')}
          onMouseEnter={() => interactive && setHovered('bones')}
          onMouseLeave={() => interactive && setHovered(null)}
          style={{ cursor: interactive ? 'pointer' : 'default' }}
        >
          <ParticleField
            color={zones.bones}
            cx={70}
            cy={300}
            rx={20}
            ry={74}
            count={20}
            active={active === 'bones' || hovered === 'bones'}
          />
          <ParticleField
            color={zones.bones}
            cx={130}
            cy={300}
            rx={20}
            ry={74}
            count={20}
            active={active === 'bones' || hovered === 'bones'}
          />
        </g>
      </g>

      <ConnectionLines zoneColors={zones} />

      {interactive && Object.entries(ZONE_DEFS).map(([id, def]) => {
        const isActive = active === id || hovered === id
        const color = zones[id]
        const labelPos = {
          brain: { x: 145, y: 24 },
          heart: { x: 145, y: 118 },
          muscles: { x: 5, y: 122 },
          gut: { x: 148, y: 162 },
          bones: { x: 148, y: 292 },
        }
        const isLeft = id === 'muscles'
        const lp = labelPos[id]
        return (
          <g key={id} opacity={isActive ? 1 : 0.45} style={{ transition: 'opacity 250ms' }}>
            <line
              x1={isLeft ? lp.x + 55 : lp.x}
              y1={def.cy}
              x2={isLeft ? lp.x + 26 : lp.x + (id === 'brain' ? -26 : id === 'gut' ? -2 : -2)}
              y2={def.cy}
              stroke={color}
              strokeWidth="0.6"
              strokeDasharray="3 3"
            />
            <text
              x={isLeft ? lp.x + 58 : lp.x - 2}
              y={def.cy - 4}
              fontSize="6.5"
              fill="rgba(255,255,255,0.85)"
              textAnchor={isLeft ? 'start' : 'end'}
            >
              {def.label}
            </text>
            <text
              x={isLeft ? lp.x + 58 : lp.x - 2}
              y={def.cy + 6}
              fontSize="5.5"
              fill={color}
              fontWeight="700"
              letterSpacing="0.06em"
              textAnchor={isLeft ? 'start' : 'end'}
            >
              {color === '#e53935' ? 'CRITICAL' : color === '#f5a623' ? 'ATTENTION' : 'OPTIMAL'}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
