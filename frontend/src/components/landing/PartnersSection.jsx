import { useState } from 'react'
import { Check } from 'lucide-react'

// -- Supplement store partners ------------------------------------------------
const STORES = [
  { name: 'iHerb',             tagline: 'Global · 30,000+ products',  color: '#5a9f3e', initial: 'iH' },
  { name: 'Amazon',            tagline: 'US · EU · UK · Worldwide',   color: '#ff9900', initial: 'Am' },
  { name: 'Thorne',            tagline: 'Clinical-grade supplements',  color: '#003865', initial: 'Th' },
  { name: 'Life Extension',    tagline: 'Science-backed formulas',     color: '#c41e3a', initial: 'LE' },
  { name: 'Vitacost',          tagline: 'Best-value US shipping',      color: '#e8630a', initial: 'Vc' },
  { name: 'Holland & Barrett', tagline: 'EU · UK · 1,000+ stores',    color: '#006b3f', initial: 'H&' },
  { name: 'MyProtein',         tagline: 'UK · EU · Australia',        color: '#111111', initial: 'MP' },
  { name: 'Solgar',            tagline: 'Premium since 1947',          color: '#8b6914', initial: 'So' },
  { name: 'NOW Foods',         tagline: 'Affordable · 1,400+ SKUs',   color: '#e63c2f', initial: 'NF' },
  { name: 'Viridian',          tagline: 'UK · Ethical sourcing',      color: '#4a7c59', initial: 'Vi' },
]

// -- Lab network --------------------------------------------------------------
const LAB_REGIONS = [
  {
    key: 'us',
    region: 'US',
    color: '#1D9E75',
    labs: ['Quest', 'LabCorp', 'SonoHealth'],
    dot: { x: '22%', y: '34%' },
  },
  {
    key: 'eu',
    region: 'EU',
    color: '#5DCAA5',
    labs: ['Synlab', 'Eurofins', 'Cerba'],
    dot: { x: '49%', y: '28%' },
  },
  {
    key: 'worldwide',
    region: 'Worldwide',
    color: '#9FE1CB',
    labs: ['Any PDF - AI auto-reads'],
    dot: { x: '62%', y: '58%' },
  },
]

// -- Partner tiers ------------------------------------------------------------
const PARTNER_TYPES = [
  { label: 'Health Coach' },
  { label: 'Nutritionist' },
  { label: 'Doctor / GP' },
  { label: 'Fitness Trainer' },
  { label: 'Wellness Brand' },
  { label: 'Influencer' },
]

// -- Map component ------------------------------------------------------------
function GlobalMap({ activeRegion, onRegionChange }) {

  return (
    <div style={{
      position: 'relative',
      background: '#0a1510',
      borderRadius: 20,
      overflow: 'hidden',
      height: 320,
      border: '0.5px solid rgba(29,158,117,0.15)',
    }}>

      {/* World silhouette */}
      <svg
        viewBox="0 0 800 320" width="100%" height="100%"
        style={{ position: 'absolute', inset: 0 }}
        aria-hidden="true"
      >
        {/* North America */}
        <path d="M70,30 L155,25 L195,55 L210,95 L200,155 L165,185 L130,195 L90,175 L60,140 L55,90 Z"
          fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.6"/>
        {/* South America */}
        <path d="M140,210 L195,200 L225,230 L238,275 L220,315 L188,318 L162,295 L148,258 Z"
          fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.07)" strokeWidth="0.6"/>
        {/* Europe */}
        <path d="M330,20 L390,15 L420,35 L425,72 L400,85 L368,80 L338,58 Z"
          fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.6"/>
        {/* Africa */}
        <path d="M335,90 L388,88 L420,110 L432,175 L425,248 L395,268 L360,260 L332,220 L325,155 Z"
          fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.6"/>
        {/* Asia */}
        <path d="M420,15 L600,10 L660,35 L680,85 L668,140 L625,170 L565,178 L490,158 L445,120 L430,65 Z"
          fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.07)" strokeWidth="0.6"/>
        {/* Australia */}
        <path d="M588,210 L660,205 L690,230 L692,268 L660,285 L615,282 L585,255 Z"
          fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.6"/>

        {/* Connection arcs between regions */}
        {[
          { x1: 176, y1: 109, x2: 392, y2: 90 },
          { x1: 392, y1: 90, x2: 496, y2: 185 },
        ].map(({ x1, y1, x2, y2 }, i) => {
          const mx = (x1 + x2) / 2
          const my = Math.min(y1, y2) - 30
          return (
            <path
              key={i}
              d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`}
              fill="none"
              stroke="rgba(95,202,165,0.18)"
              strokeWidth="0.6"
              strokeDasharray="4 6"
            />
          )
        })}
      </svg>

      {/* Region dots + labels */}
      {LAB_REGIONS.map(({ key, region, color, dot, labs }) => {
        const isActive = activeRegion === key
        return (
          <div
            key={key}
            style={{ position: 'absolute', left: dot.x, top: dot.y, zIndex: 2 }}
            onMouseEnter={() => onRegionChange(key)}
            onMouseLeave={() => onRegionChange(null)}
            onClick={() => onRegionChange(isActive ? null : key)}
          >
            {/* Pulse ring */}
            <div style={{
              position: 'absolute',
              width: 22, height: 22,
              borderRadius: '50%',
              background: color + '25',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              transition: 'all 300ms ease',
              ...(isActive ? { width: 32, height: 32, background: color + '35' } : {}),
            }}/>
            {/* Dot */}
            <div style={{
              width: 10, height: 10,
              borderRadius: '50%',
              background: color,
              position: 'relative', zIndex: 1,
              cursor: 'pointer',
              boxShadow: `0 0 0 2px ${color}40`,
              transition: 'transform 200ms ease',
              transform: isActive ? 'scale(1.4)' : 'scale(1)',
            }}/>
            {/* Region label */}
            <div style={{
              position: 'absolute',
              top: 14, left: '50%',
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: isActive ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)',
              textTransform: 'uppercase',
              transition: 'color 200ms ease',
              pointerEvents: 'none',
            }}>
              {region}
            </div>

            {/* Tooltip on hover */}
            {isActive && (
              <div style={{
                position: 'absolute',
                bottom: 20, left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(10,21,16,0.96)',
                border: `0.5px solid ${color}50`,
                borderRadius: 10,
                padding: '10px 14px',
                minWidth: 160,
                zIndex: 10,
                pointerEvents: 'none',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 6, letterSpacing: '0.06em' }}>
                  {region}
                </div>
                {labs.map(l => (
                  <div key={l} style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>
                    {l}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Top-left label */}
      <div style={{
        position: 'absolute', top: 14, left: 16,
        fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
        color: 'rgba(29,158,117,0.6)', textTransform: 'uppercase',
      }}>
        World map
      </div>

      {/* Bottom caption */}
      <div style={{
        position: 'absolute', bottom: 12, right: 16,
        fontSize: 10, color: 'rgba(255,255,255,0.2)',
      }}>
        Hover or tap a marker
      </div>
    </div>
  )
}

// -- Main component ------------------------------------------------------------
export default function PartnersSection() {
  const [activeRegion, setActiveRegion] = useState(null)

  const handlePartnerClick = () => {
    const subject = encodeURIComponent('VITALOOP Partnership Request')
    const body = encodeURIComponent(
      'Hello VITALOOP team,\n\nI am interested in the partner program.\n\n' +
      'My name:\nRole / business:\nAudience / reach:\nWebsite or social:\n\n' +
      'Please send me details.\n\nBest regards'
    )
    window.location.href = `mailto:info@softdab.tech?subject=${subject}&body=${body}`
  }

  return (
    <section id="partners" style={{ padding: 'var(--py-xl, 120px) 24px', background: 'var(--gray-50)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* -- Header -- */}
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 80 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--teal-500)', marginBottom: 16,
          }}>
            Partner network
          </div>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--gray-900)', marginBottom: 16,
          }}>
            Buy supplements anywhere.<br/>
            <span style={{ color: 'var(--teal-500)' }}>Upload labs from any lab.</span>
          </h2>
          <p style={{ fontSize: 17, color: 'var(--gray-500)', maxWidth: 480, margin: '0 auto', lineHeight: 1.65 }}>
            One-click purchase links to your preferred store. Results from any
            lab worldwide - uploaded in seconds.
          </p>
        </div>

        {/* -- Supplement stores -- */}
        <div className="reveal" style={{ marginBottom: 80 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 20, flexWrap: 'wrap', gap: 8,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)' }}>
              Supplement stores
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--teal-50)', border: '0.5px solid var(--teal-300)',
              borderRadius: 8, padding: '5px 12px',
              fontSize: 12, fontWeight: 600, color: 'var(--teal-600)',
            }}>
              5-8% cashback via partner links
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 10,
          }}>
            {STORES.map(({ name, tagline, color, initial }) => (
              <div
                key={name}
                style={{
                  background: 'white', borderRadius: 14,
                  border: '0.5px solid var(--gray-100)',
                  padding: '16px 16px',
                  transition: 'transform 250ms ease, border-color 250ms ease, box-shadow 250ms ease',
                  cursor: 'default',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)'
                  e.currentTarget.style.borderColor = color + '55'
                  e.currentTarget.style.boxShadow = `0 6px 20px ${color}12`
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.borderColor = 'var(--gray-100)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 9,
                  background: color + '15', border: `1.5px solid ${color}35`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, color, letterSpacing: '-0.02em',
                }}>
                  {initial}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 2 }}>{name}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{tagline}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* -- Map + Affiliate - side by side -- */}
        <div className="reveal grid grid-cols-1 md:grid-cols-2 gap-6" style={{ marginBottom: 0 }}>

          {/* Map */}
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 16 }}>
              Partner laboratories
            </div>
            <GlobalMap activeRegion={activeRegion} onRegionChange={setActiveRegion} />
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8, marginTop: 12,
            }}>
              {[
                { key: 'us', label: 'US labs',   text: 'Quest - LabCorp - SonoHealth' },
                { key: 'eu', label: 'EU labs',   text: 'Synlab - Eurofins - Cerba' },
                { key: 'worldwide', label: 'Worldwide', text: 'Any PDF - AI auto-reads' },
              ].map(({ key, label, text }) => (
                <div key={label} style={{
                  background: 'white', borderRadius: 10,
                  border: activeRegion === key ? '0.5px solid var(--teal-300)' : '0.5px solid var(--gray-100)',
                  padding: '10px 12px',
                  transition: 'border-color 200ms, box-shadow 200ms',
                  boxShadow: activeRegion === key ? '0 6px 18px rgba(29,158,117,0.14)' : 'none',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', lineHeight: 1.5 }}>{text}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Affiliate card */}
          <div style={{
            background: '#0d2218',
            borderRadius: 20,
            padding: '36px 32px',
            border: '0.5px solid rgba(29,158,117,0.2)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--teal-400)', marginBottom: 14,
            }}>
              Partner program
            </div>

            <h3 style={{
              fontSize: 'clamp(22px, 2.5vw, 28px)', fontWeight: 700,
              color: 'white', letterSpacing: '-0.02em', marginBottom: 10, lineHeight: 1.2,
            }}>
              Earn with every referral.
            </h3>

            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 24 }}>
              Refer users who need clarity with their lab results and earn
              recurring commission while they stay on VITALOOP.
            </p>

            {/* Stats */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8, marginBottom: 24,
            }}>
              {[
                { n: '20%',  l: 'recurring commission' },
                { n: '$117', l: 'avg annual per referral' },
                { n: '∞',    l: 'no earnings cap' },
              ].map(({ n, l }) => (
                <div key={n} style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 12, padding: '12px 14px',
                  border: '0.5px solid rgba(255,255,255,0.07)',
                }}>
                  <div style={{
                    fontSize: 22, fontWeight: 700, color: 'white',
                    letterSpacing: '-0.02em', lineHeight: 1,
                  }}>
                    {n}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4, lineHeight: 1.4 }}>
                    {l}
                  </div>
                </div>
              ))}
            </div>

            {/* Benefits list */}
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Recurring payout while referred clients stay active',
                'Ready-to-share content and referral dashboard',
                'Priority support for your partner pipeline',
                'Works for coaches, doctors, nutritionists & influencers',
              ].map(item => (
                <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Check size={14} style={{ color: 'var(--teal-400)', flexShrink: 0, marginTop: 2 }} aria-hidden="true"/>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{item}</span>
                </li>
              ))}
            </ul>

            {/* Partner type chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 28 }}>
              {PARTNER_TYPES.map(({ label }) => (
                <span key={label} style={{
                  background: 'rgba(29,158,117,0.12)',
                  border: '0.5px solid rgba(29,158,117,0.25)',
                  borderRadius: 6, padding: '4px 10px',
                  fontSize: 12, fontWeight: 600, color: 'var(--teal-300)',
                }}>
                  {label}
                </span>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={handlePartnerClick}
              style={{
                marginTop: 'auto',
                background: 'var(--teal-500)', color: 'white',
                border: 'none', borderRadius: 980,
                padding: '13px 28px', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', transition: 'background 200ms, transform 200ms',
                display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--teal-600)'
                e.currentTarget.style.transform = 'scale(1.02)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--teal-500)'
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              Apply to partner program
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>

            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 10 }}>
              We'll reply within 24 hours - info@softdab.tech
            </p>
          </div>
        </div>

      </div>
    </section>
  )
}
