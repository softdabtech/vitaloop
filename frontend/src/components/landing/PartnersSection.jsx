import { Check } from 'lucide-react'

const PARTNERS = [
  {
    name: 'iHerb',
    description: 'Global supplement marketplace with fast worldwide shipping.',
    url: 'https://www.iherb.com',
    brandColor: '#5a9f3e',
    logoSrc: '/partners/iherb.svg',
  },
  {
    name: 'Thorne',
    description: 'Clinical-grade formulations trusted by practitioners.',
    url: 'https://www.thorne.com',
    brandColor: '#003865',
    logoSrc: '/partners/thorne.svg',
  },
  {
    name: 'Life Extension',
    description: 'Science-backed longevity and wellness supplements.',
    url: 'https://www.lifeextension.com',
    brandColor: '#c41e3a',
    logoSrc: '/partners/life-extension.svg',
  },
  {
    name: 'NOW Foods',
    description: 'Broad catalog of affordable vitamins and nutraceuticals.',
    url: 'https://www.nowfoods.com',
    brandColor: '#e63c2f',
    logoSrc: '/partners/now-foods.svg',
  },
  {
    name: 'Holland & Barrett',
    description: 'Popular UK and EU health retailer with broad coverage.',
    url: 'https://www.hollandandbarrett.com',
    brandColor: '#006b3f',
    logoSrc: '/partners/holland-barrett.svg',
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
      {PARTNERS.map(({ name, description, url, brandColor, logoSrc }) => (
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
        </a>
      ))}
    </div>
  )
}

export default function PartnersSection() {
  const handlePartnerClick = () => {
    const subject = encodeURIComponent('VITALOOP Partnership Request')
    const body = encodeURIComponent(
      'Hello VITALOOP team,\n\nI am interested in the partner program.\n\n' +
      'My name:\nRole / business:\nAudience / reach:\nWebsite or social:\n\n' +
      'Please send me details.\n\nBest regards'
    )
    window.location.href = `mailto:info@softdab.tech?subject=${subject}&body=${body}`
  }

  const handleLabPartnerClick = () => {
    const subject = encodeURIComponent('VITALOOP Partner Laboratories Request')
    const body = encodeURIComponent(
      'Hello VITALOOP team,\n\nI am interested in becoming a partner laboratory.\n\n' +
      'Laboratory name:\nCountry / region:\nTests offered:\nCurrent monthly volume:\nMain contact name and role:\nEmail / phone:\n\n' +
      'Please share partnership details and next steps.\n\nBest regards'
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
          <div style={{
            background: '#122739',
            borderRadius: 20,
            padding: '36px 32px',
            border: '0.5px solid rgba(117,170,255,0.28)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: '#9bc7ff', marginBottom: 14,
            }}>
              Partner laboratories
            </div>

            <h3 style={{
              fontSize: 'clamp(22px, 2.5vw, 28px)', fontWeight: 700,
              color: 'white', letterSpacing: '-0.02em', marginBottom: 10, lineHeight: 1.2,
            }}>
              Grow your lab with digital referrals.
            </h3>

            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.56)', lineHeight: 1.6, marginBottom: 24 }}>
              Join VITALOOP to receive qualified users, accelerate report interpretation,
              and offer a smoother post-test journey.
            </p>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8, marginBottom: 24,
            }}>
              {[
                { n: '24h', l: 'average onboarding reply' },
                { n: 'PDF + API', l: 'integration pathways' },
                { n: 'Global', l: 'patient coverage' },
              ].map(({ n, l }) => (
                <div key={n} style={{
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 12, padding: '12px 14px',
                  border: '0.5px solid rgba(255,255,255,0.10)',
                }}>
                  <div style={{
                    fontSize: 22, fontWeight: 700, color: 'white',
                    letterSpacing: '-0.02em', lineHeight: 1,
                  }}>
                    {n}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4, lineHeight: 1.4 }}>
                    {l}
                  </div>
                </div>
              ))}
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Dedicated onboarding manager for your team',
                'Standardized biomarker mapping and QA process',
                'Joint co-marketing opportunities with health creators',
                'Roadmap for direct integration and automated syncing',
              ].map((item) => (
                <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Check size={14} style={{ color: '#8dc1ff', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.62)', lineHeight: 1.5 }}>{item}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={handleLabPartnerClick}
              style={{
                marginTop: 'auto',
                background: '#3c89e8', color: 'white',
                border: 'none', borderRadius: 980,
                padding: '13px 28px', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', transition: 'background 200ms, transform 200ms',
                display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#2f78d3'
                e.currentTarget.style.transform = 'scale(1.02)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#3c89e8'
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              Apply to partner laboratories
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>

            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.24)', marginTop: 10 }}>
              Response target: within 24 hours - info@softdab.tech
            </p>
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
