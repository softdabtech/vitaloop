import { useState } from 'react'
import { Check } from 'lucide-react'

const PARTNERS = [
  {
    name: 'iHerb',
    description: 'Global supplement marketplace with fast worldwide shipping.',
    url: 'https://www.iherb.com',
    brandColor: '#5a9f3e',
    logoSrc: '/partners/iherb.svg',
    links: [{ label: 'Shop' }, { label: 'Shipping' }],
  },
  {
    name: 'Thorne',
    description: 'Clinical-grade formulations trusted by practitioners.',
    url: 'https://www.thorne.com',
    brandColor: '#003865',
    logoSrc: '/partners/thorne.svg',
    links: [{ label: 'Products' }, { label: 'About' }],
  },
  {
    name: 'Life Extension',
    description: 'Science-backed longevity and wellness supplements.',
    url: 'https://www.lifeextension.com',
    brandColor: '#c41e3a',
    logoSrc: '/partners/life-extension.svg',
    links: [{ label: 'Shop' }, { label: 'Research' }],
  },
  {
    name: 'NOW Foods',
    description: 'Broad catalog of affordable vitamins and nutraceuticals.',
    url: 'https://www.nowfoods.com',
    brandColor: '#e63c2f',
    logoSrc: '/partners/now-foods.svg',
    links: [{ label: 'Products' }, { label: 'Quality' }],
  },
  {
    name: 'Holland & Barrett',
    description: 'Popular UK and EU health retailer with broad coverage.',
    url: 'https://www.hollandandbarrett.com',
    brandColor: '#006b3f',
    logoSrc: '/partners/holland-barrett.svg',
    links: [{ label: 'Shop' }, { label: 'Stores' }],
  },
]

const LAB_MARKERS = [
  {
    key: 'us',
    label: 'US',
    color: '#1D9E75',
    x: 170,
    y: 120,
    details: ['Quest', 'LabCorp', 'SonoHealth'],
  },
  {
    key: 'eu',
    label: 'EU',
    color: '#5DCAA5',
    x: 390,
    y: 88,
    details: ['Synlab', 'Eurofins', 'Cerba'],
  },
  {
    key: 'worldwide',
    label: 'Worldwide',
    color: '#9FE1CB',
    x: 520,
    y: 186,
    details: ['Any PDF - AI auto-reads'],
  },
]

const PARTNER_TYPES = [
  { label: 'Health Coach' },
  { label: 'Nutritionist' },
  { label: 'Doctor / GP' },
  { label: 'Fitness Trainer' },
  { label: 'Wellness Brand' },
  { label: 'Influencer' },
]

function PartnerCardsRow() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {PARTNERS.map(({ name, description, url, brandColor, logoSrc, links }) => (
        <a
          key={name}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            background: `${brandColor}10`,
            border: `1px solid ${brandColor}30`,
            borderTop: `4px solid ${brandColor}`,
            borderRadius: 16,
            padding: '18px 16px',
            textDecoration: 'none',
            transition: 'transform 200ms ease, box-shadow 200ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.03)'
            e.currentTarget.style.boxShadow = `0 12px 30px ${brandColor}22`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          <img
            src={logoSrc}
            alt={`${name} logo`}
            style={{ width: 44, height: 44, borderRadius: 10, marginBottom: 12, objectFit: 'cover', background: 'white' }}
          />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 8 }}>{name}</div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--gray-700)', lineHeight: 1.55 }}>{description}</p>
          {!!links?.length && (
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {links.map(({ label }) => (
                <span
                  key={label}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--gray-700)',
                    border: `0.5px solid ${brandColor}55`,
                    borderRadius: 999,
                    padding: '4px 8px',
                    background: 'rgba(255,255,255,0.6)',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </a>
      ))}
    </div>
  )
}

function GlobalMap({ activeRegion, onRegionChange }) {
  return (
    <div style={{
      position: 'relative',
      background: '#0d2218',
      borderRadius: 20,
      overflow: 'hidden',
      height: 320,
      border: '0.5px solid rgba(29,158,117,0.15)',
    }}>
      <svg viewBox="0 0 800 320" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
        <path d="M70,30 L155,25 L195,55 L210,95 L200,155 L165,185 L130,195 L90,175 L60,140 L55,90 Z" fill="rgba(255,255,255,0.10)" />
        <path d="M140,210 L195,200 L225,230 L238,275 L220,315 L188,318 L162,295 L148,258 Z" fill="rgba(255,255,255,0.08)" />
        <path d="M330,20 L390,15 L420,35 L425,72 L400,85 L368,80 L338,58 Z" fill="rgba(255,255,255,0.10)" />
        <path d="M335,90 L388,88 L420,110 L432,175 L425,248 L395,268 L360,260 L332,220 L325,155 Z" fill="rgba(255,255,255,0.07)" />
        <path d="M420,15 L600,10 L660,35 L680,85 L668,140 L625,170 L565,178 L490,158 L445,120 L430,65 Z" fill="rgba(255,255,255,0.09)" />
        <path d="M588,210 L660,205 L690,230 L692,268 L660,285 L615,282 L585,255 Z" fill="rgba(255,255,255,0.07)" />
        <path d="M170,120 Q280,60 390,88" fill="none" stroke="rgba(95,202,165,0.18)" strokeWidth="0.7" strokeDasharray="4 6" />
        <path d="M390,88 Q460,118 520,186" fill="none" stroke="rgba(95,202,165,0.18)" strokeWidth="0.7" strokeDasharray="4 6" />
      </svg>

      {LAB_MARKERS.map(({ key, label, color, x, y, details }) => {
        const isActive = activeRegion === key
        return (
          <button
            key={key}
            type="button"
            onMouseEnter={() => onRegionChange(key)}
            onMouseLeave={() => onRegionChange(null)}
            onClick={() => onRegionChange(isActive ? null : key)}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              transform: 'translate(-50%, -50%)',
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: 'none',
              background: color,
              boxShadow: `0 0 0 6px ${color}2E`,
              cursor: 'pointer',
              zIndex: 3,
            }}
            aria-label={`${label} labs marker`}
          >
            <span style={{
              position: 'absolute',
              top: 18,
              left: '50%',
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: isActive ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase',
              pointerEvents: 'none',
            }}>{label}</span>

            {isActive && (
              <span style={{
                position: 'absolute',
                left: '50%',
                bottom: 22,
                transform: 'translateX(-50%)',
                minWidth: 170,
                background: 'rgba(10,21,16,0.96)',
                border: `0.5px solid ${color}66`,
                borderRadius: 10,
                padding: '10px 12px',
                textAlign: 'left',
                color: 'rgba(255,255,255,0.75)',
                fontSize: 11,
                lineHeight: 1.5,
              }}>
                <strong style={{ color, display: 'block', marginBottom: 4 }}>{label}</strong>
                {details.join(' · ')}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

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

        <div className="reveal" style={{ marginBottom: 80 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 20, flexWrap: 'wrap', gap: 8,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)' }}>
              Supplement partners
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--teal-50)', border: '0.5px solid var(--teal-300)',
              borderRadius: 8, padding: '5px 12px',
              fontSize: 12, fontWeight: 600, color: 'var(--teal-600)',
            }}>
              Trusted stores and brands - open their site in one click
            </div>
          </div>
          <PartnerCardsRow />
        </div>

        <div className="reveal grid grid-cols-1 md:grid-cols-2 gap-6" style={{ marginBottom: 0 }}>
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
                { key: 'us', label: 'US labs', text: 'Quest - LabCorp - SonoHealth' },
                { key: 'eu', label: 'EU labs', text: 'Synlab - Eurofins - Cerba' },
                { key: 'worldwide', label: 'Worldwide', text: 'Any PDF - AI auto-reads' },
              ].map(({ key, label, text }) => (
                <div key={label} style={{
                  background: 'white',
                  borderRadius: 10,
                  border: activeRegion === key ? '0.5px solid var(--teal-300)' : '0.5px solid var(--gray-100)',
                  padding: '10px 12px',
                  transition: 'border-color 180ms, box-shadow 180ms',
                  boxShadow: activeRegion === key ? '0 6px 18px rgba(29,158,117,0.14)' : 'none',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', lineHeight: 1.5 }}>{text}</div>
                </div>
              ))}
            </div>
          </div>

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

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8, marginBottom: 24,
            }}>
              {[
                { n: '20%', l: 'recurring commission' },
                { n: '$117', l: 'avg annual per referral' },
                { n: '∞', l: 'no earnings cap' },
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

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Recurring payout while referred clients stay active',
                'Ready-to-share content and referral dashboard',
                'Priority support for your partner pipeline',
                'Works for coaches, doctors, nutritionists & influencers',
              ].map((item) => (
                <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Check size={14} style={{ color: 'var(--teal-400)', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{item}</span>
                </li>
              ))}
            </ul>

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
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--teal-600)'
                e.currentTarget.style.transform = 'scale(1.02)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--teal-500)'
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              Apply to partner program
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
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
