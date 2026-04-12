import { useState } from 'react'
import { Check } from 'lucide-react'

const STORES = [
  { name: 'iHerb',             tagline: 'Global · All brands' },
  { name: 'Amazon',            tagline: 'US · EU · UK · Global' },
  { name: 'Thorne',            tagline: 'Professional grade' },
  { name: 'Life Extension',    tagline: 'Science-backed' },
  { name: 'Vitacost',          tagline: 'Best value US' },
  { name: 'Holland & Barrett', tagline: 'EU · UK stores' },
  { name: 'MyProtein',         tagline: 'UK · EU · AU' },
  { name: 'Viridian',          tagline: 'UK · Ethical' },
  { name: 'Solgar',            tagline: 'Global premium' },
  { name: 'NOW Foods',         tagline: 'Global · Affordable' },
]

const LABS = [
  { name: 'Quest Diagnostics', city: 'New York',    x: '23%', y: '34%', region: 'US'   },
  { name: 'LabCorp',           city: 'Los Angeles', x: '13%', y: '38%', region: 'US'   },
  { name: 'SonoHealth',        city: 'Chicago',     x: '19%', y: '30%', region: 'US'   },
  { name: 'HealthLabs.com',    city: 'Houston',     x: '17%', y: '44%', region: 'US'   },
  { name: 'Synlab',            city: 'London',      x: '46%', y: '20%', region: 'EU'   },
  { name: 'Eurofins',          city: 'Berlin',      x: '50%', y: '16%', region: 'EU'   },
  { name: 'Cerba',             city: 'Paris',       x: '47%', y: '21%', region: 'EU'   },
  { name: 'Sonic Healthcare',  city: 'Amsterdam',   x: '49%', y: '15%', region: 'EU'   },
  { name: 'Dubai Health',      city: 'Dubai',       x: '61%', y: '42%', region: 'ME'   },
  { name: 'Medilab',           city: 'Abu Dhabi',   x: '61%', y: '45%', region: 'ME'   },
  { name: 'Pathology Asia',    city: 'Singapore',   x: '76%', y: '56%', region: 'Asia' },
  { name: 'SRL Diagnostics',   city: 'Tokyo',       x: '84%', y: '28%', region: 'Asia' },
  { name: 'Metropolis',        city: 'Mumbai',      x: '67%', y: '47%', region: 'Asia' },
  { name: 'Fleury',            city: 'São Paulo',   x: '29%', y: '70%', region: 'LATAM'},
  { name: 'Chopo',             city: 'Mexico City', x: '16%', y: '47%', region: 'LATAM'},
]

const REGION_COLOR = {
  US: '#1D9E75', EU: '#5DCAA5', ME: '#f5a623', Asia: '#9FE1CB', LATAM: '#0F6E56',
}

const LAB_CATEGORIES = [
  { label: '🇺🇸 US Labs',  labs: 'Quest · LabCorp · SonoHealth · HealthLabs.com' },
  { label: '🇪🇺 EU Labs',  labs: 'Synlab · Eurofins · Sonic Healthcare · Cerba'  },
  { label: '🌍 Worldwide', labs: 'Any PDF from any language — AI auto-detects format' },
]

function WorldMap() {
  const [tooltip, setTooltip] = useState(null)
  const regionLegend = { US: '#1D9E75', EU: '#5DCAA5', ME: '#f5a623', Asia: '#9FE1CB', LATAM: '#0F6E56' }

  return (
    <div style={{ position: 'relative', background: '#0f1b18', borderRadius: 20, overflow: 'hidden', height: 360 }}>
      <svg viewBox="0 0 800 350" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
        <defs>
          <pattern id="mapGrid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M0 40L40 0M-10 10L10-10M30 50L50 30" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" fill="none" />
          </pattern>
        </defs>
        <rect width="800" height="350" fill="url(#mapGrid)" />
        {/* Simplified continent shapes */}
        <path d="M80,50 L95,35 L120,38 L165,48 L200,62 L220,90 L230,130 L205,170 L175,200 L140,208 L95,188 L75,155 L65,120 Z"
          fill="#1a2820" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <path d="M150,210 L200,205 L230,220 L245,265 L248,310 L225,345 L200,340 L180,315 L165,275 L150,240 Z"
          fill="#1a2820" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <path d="M330,38 L355,28 L390,32 L420,40 L440,60 L435,88 L415,100 L390,104 L362,94 L338,72 Z"
          fill="#1a2820" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <path d="M340,110 L380,108 L420,115 L440,140 L448,195 L442,255 L420,310 L390,328 L362,318 L338,282 L328,228 L330,165 Z"
          fill="#1a2820" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <path d="M440,30 L510,18 L600,24 L660,30 L720,50 L745,85 L740,140 L710,190 L655,215 L590,218 L530,200 L475,172 L450,140 L438,80 Z"
          fill="#1a2820" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <path d="M620,255 L680,248 L730,260 L745,295 L732,335 L695,348 L650,338 L622,308 Z"
          fill="#1a2820" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      </svg>

      <div style={{
        position: 'absolute', top: 12, left: 16,
        display: 'flex', flexDirection: 'column', gap: 4, zIndex: 3,
      }}>
        {Object.entries(regionLegend).map(([region, color]) => (
          <div key={region} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{region}</span>
          </div>
        ))}
      </div>

      {LABS.map(({ name, city, x, y, region }, i) => (
        <div
          key={name}
          style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)', zIndex: 2 }}
          onMouseEnter={() => setTooltip({ name, city })}
          onMouseLeave={() => setTooltip(null)}
        >
          <div style={{ position: 'relative', width: 9, height: 9 }}>
            <div style={{
              position: 'absolute', inset: -3,
              borderRadius: '50%',
              background: `${REGION_COLOR[region]}40`,
              animation: 'zonePulse 2s ease-in-out infinite',
              animationDelay: `${(i % 7) * 0.2}s`,
            }} />
            <div style={{
              width: 9, height: 9, borderRadius: '50%',
              background: REGION_COLOR[region],
              position: 'relative', zIndex: 1,
              cursor: 'pointer',
              boxShadow: `0 0 8px ${REGION_COLOR[region]}80`,
            }} />
          </div>
        </div>
      ))}

      {[
        { label: 'North America', x: '15%', y: '55%' },
        { label: 'Europe', x: '47%', y: '30%' },
        { label: 'Middle East', x: '58%', y: '52%' },
        { label: 'Asia', x: '75%', y: '40%' },
        { label: 'South America', x: '26%', y: '75%' },
      ].map(({ label, x, y }) => (
        <div key={label} style={{
          position: 'absolute', left: x, top: y,
          fontSize: 9, color: 'rgba(255,255,255,0.18)',
          fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', userSelect: 'none',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}>
          {label}
        </div>
      ))}

      {tooltip && (
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.9)', borderRadius: 8, padding: '8px 14px',
          fontSize: 12, color: 'white', whiteSpace: 'nowrap', zIndex: 10,
          border: '0.5px solid rgba(255,255,255,0.1)', pointerEvents: 'none',
        }}>
          <span style={{ fontWeight: 600 }}>{tooltip.name}</span>
          <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 8 }}>{tooltip.city}</span>
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 16, right: 20, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
        Results from any of these labs upload seamlessly
      </div>
    </div>
  )
}

export default function PartnersSection() {
  return (
    <section id="partners" style={{ padding: '120px 24px', background: 'var(--gray-50)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* Header */}
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 80 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--teal-500)', marginBottom: 16 }}>
            Global Partner Network
          </div>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--gray-900)', marginBottom: 20 }}>
            Buy supplements anywhere in the world.
          </h2>
          <p style={{ fontSize: 17, color: 'var(--gray-500)', maxWidth: 480, margin: '0 auto', lineHeight: 1.65 }}>
            One-click purchase links to your preferred store — wherever you are.
          </p>
        </div>

        {/* Supplement stores */}
        <div className="reveal" style={{ marginBottom: 80 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-900)', marginBottom: 20 }}>
            Supplement stores
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {STORES.map(({ name, tagline }) => (
              <div
                key={name}
                style={{ background: 'white', borderRadius: 16, border: '0.5px solid var(--gray-100)', padding: '18px 20px', transition: 'transform 200ms ease, border-color 200ms ease', cursor: 'default' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.borderColor = 'var(--teal-300)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = 'var(--gray-100)' }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 3 }}>{name}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{tagline}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', background: 'var(--teal-50)', border: '0.5px solid var(--teal-300)', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: 'var(--teal-600)' }}>
            Earn 5–8% cashback on all purchases via our partner links
          </div>
        </div>

        {/* Partner labs + world map */}
        <div className="reveal" style={{ marginBottom: 80 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-900)', marginBottom: 20 }}>
            Partner laboratories
          </div>
          <WorldMap />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 16 }}>
            {LAB_CATEGORIES.map(({ label, labs }) => (
              <div key={label} style={{ background: 'white', borderRadius: 12, border: '0.5px solid var(--gray-100)', padding: '14px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-900)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.5 }}>{labs}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Affiliate card */}
        <div
          className="reveal grid md:grid-cols-2 gap-12 items-center"
          style={{ background: 'var(--teal-800)', borderRadius: 28, padding: '56px 48px' }}
        >
          {/* Text */}
          <div>
            <h3 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 12, letterSpacing: '-0.02em' }}>
              Become a VITALOOP Partner
            </h3>
            <p style={{ fontSize: 16, color: 'var(--teal-100)', lineHeight: 1.65, marginBottom: 24 }}>
              Earn 20% recurring commission on every subscriber you refer.
              Health coaches, nutritionists, doctors, and influencers welcome.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {['Custom referral link + dashboard', '20% recurring monthly commission', 'Marketing materials provided', 'Priority support'].map((item) => (
                <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: 'var(--teal-100)' }}>
                  <Check size={15} style={{ color: 'var(--teal-300)', flexShrink: 0 }} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <button
              style={{ background: 'white', color: 'var(--teal-800)', border: 'none', borderRadius: 980, padding: '14px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'opacity 200ms, transform 200ms' }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'scale(1.02)' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)' }}
            >
              Apply to partner program →
            </button>
          </div>

          {/* Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {['Health Coach', 'Nutritionist', 'Influencer', 'Doctor', 'Wellness Brand'].map((tag) => (
              <span key={tag} style={{ background: 'var(--teal-600)', color: 'white', borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 600 }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}
