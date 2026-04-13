import { Package, Activity, Zap } from 'lucide-react'

const STORES = [
  { name: 'iHerb',          tagline: 'Global · All brands',   color: '#5a9f3e', initial: 'iH' },
  { name: 'Thorne',         tagline: 'Professional grade',    color: '#003865', initial: 'Th' },
  { name: 'Life Extension', tagline: 'Science-backed',        color: '#c41e3a', initial: 'LE' },
]

function StoreCard({ name, tagline, color, initial }) {
  return (
    <div
      style={{
        background: 'white', borderRadius: 14,
        border: '0.5px solid var(--gray-100)',
        padding: '16px 18px',
        display: 'flex', alignItems: 'center', gap: 12,
        transition: 'transform 250ms ease, border-color 250ms ease',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.borderColor = color + '60'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = 'var(--gray-100)'
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 9, flexShrink: 0,
        background: color + '15', border: `1.5px solid ${color}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 800, color: color, letterSpacing: '-0.02em',
      }}>
        {initial}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-900)' }}>{name}</div>
        <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>{tagline}</div>
      </div>
    </div>
  )
}

const BLOCKS = [
  {
    Icon: Package,
    label: 'Supplements',
    title: 'Order supplements in one click',
    body: 'Get direct links to trusted stores based on your protocol. No searching. No guesswork.',
    extra: 'stores',
  },
  {
    Icon: Activity,
    label: 'Lab integrations',
    title: 'Connect your lab results',
    body: 'Upload results from any lab — or connect directly as integrations expand.',
    extra: 'labs',
  },
  {
    Icon: Zap,
    label: 'Ecosystem benefits',
    title: 'Unlock partner benefits as you follow your protocol',
    body: 'Exclusive pricing, early access to new features, and more — the longer you track, the more you get.',
    extra: null,
  },
]

export default function PartnersSection() {
  return (
    <section id="partners" style={{ padding: '120px 24px', background: 'var(--gray-50)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* Header */}
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 72 }}>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--gray-900)', marginBottom: 16,
          }}>
            Everything you need —{' '}
            <span style={{ color: 'var(--teal-500)' }}>in one place</span>
          </h2>
          <p style={{ fontSize: 17, color: 'var(--gray-500)', maxWidth: 520, margin: '0 auto', lineHeight: 1.65 }}>
            From lab testing to supplements — seamlessly connected inside VITALOOP.
          </p>
        </div>

        {/* 3 ecosystem blocks */}
        <div className="grid md:grid-cols-3 gap-6 stagger-children reveal">
          {BLOCKS.map(({ Icon, label, title, body, extra }) => (
            <div
              key={label}
              style={{
                background: 'white', borderRadius: 24,
                border: '0.5px solid var(--gray-100)',
                padding: '32px 28px',
                display: 'flex', flexDirection: 'column', gap: 0,
                transition: 'transform 300ms ease, border-color 300ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.borderColor = 'var(--teal-300)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.borderColor = 'var(--gray-100)'
              }}
            >
              {/* Icon */}
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(16,185,129,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20,
              }}>
                <Icon size={22} color="var(--teal-500)" strokeWidth={1.8} />
              </div>

              {/* Label */}
              <div style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'var(--teal-500)', marginBottom: 10,
              }}>
                {label}
              </div>

              {/* Title */}
              <h3 style={{
                fontSize: 17, fontWeight: 700, color: 'var(--gray-900)',
                marginBottom: 12, lineHeight: 1.35,
              }}>
                {title}
              </h3>

              {/* Body */}
              <p style={{ fontSize: 14, color: 'var(--gray-500)', lineHeight: 1.65, margin: '0 0 20px' }}>
                {body}
              </p>

              {/* Store cards */}
              {extra === 'stores' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
                  {STORES.map((s) => <StoreCard key={s.name} {...s} />)}
                </div>
              )}

              {/* Labs placeholder */}
              {extra === 'labs' && (
                <div style={{
                  marginTop: 'auto',
                  background: 'var(--gray-50)',
                  borderRadius: 12,
                  border: '0.5px solid var(--gray-100)',
                  padding: '14px 16px',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-900)', marginBottom: 6 }}>
                    Supported labs
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--teal-600)', lineHeight: 1.6 }}>
                    Quest · LabCorp · EU labs
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 6 }}>
                    + any lab PDF worldwide
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
