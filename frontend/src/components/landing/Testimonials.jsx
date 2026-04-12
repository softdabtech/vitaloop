const TESTIMONIALS = [
  {
    quote: 'I had no idea I was deficient in 4 things. Three months later my energy is completely transformed. The avatar made it so visual — I could see exactly what needed fixing.',
    initials: 'SM',
    name: 'Sarah M.',
    role: 'Marketing Director · Austin, TX',
    stats: [
      { label: 'Vitamin D', before: '18', after: '54', unit: 'ng/mL' },
      { label: 'Ferritin',  before: '12', after: '38', unit: 'ng/mL' },
    ],
  },
  {
    quote: 'As a founder I was running on empty. VITALOOP found low CoQ10 and magnesium — things my GP never checked. The protocol actually worked.',
    initials: 'MK',
    name: 'Marcus K.',
    role: 'Startup Founder · London',
    stats: [
      { label: 'Energy score', before: '4/10', after: '8/10', unit: '' },
    ],
  },
  {
    quote: "I'm an athlete — I thought I was healthy. Turns out my Omega-3 index was terrible. Fixed it in 60 days, recovery time dropped by 30%.",
    initials: 'EV',
    name: 'Elena V.',
    role: 'Professional Athlete · Dubai',
    stats: [
      { label: 'Recovery time', before: '—', after: '-30%', unit: '' },
    ],
  },
]

export default function Testimonials() {
  return (
    <section style={{ padding: '120px 24px', background: 'var(--white)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* Header */}
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--teal-500)', marginBottom: 16,
          }}>
            Real Results
          </div>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--gray-900)',
          }}>
            Users who closed the loop.
          </h2>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 stagger-children reveal">
          {TESTIMONIALS.map(({ quote, initials, name, role, stats }) => (
            <div
              key={name}
              style={{
                background: 'var(--white)', borderRadius: 24,
                border: '0.5px solid var(--gray-100)', padding: '36px 32px',
                display: 'flex', flexDirection: 'column',
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
              {/* Quote marks */}
              <div style={{ fontSize: 48, lineHeight: 1, color: 'var(--teal-300)', marginBottom: 8, fontFamily: 'Georgia, serif' }}>"</div>

              <blockquote style={{
                flex: 1,
                fontSize: 17, fontStyle: 'italic', color: 'var(--gray-700)',
                lineHeight: 1.7, margin: '0 0 24px',
              }}>
                {quote}
              </blockquote>

              {/* Stats */}
              <div style={{
                background: 'var(--gray-50)', borderRadius: 12, padding: '12px 16px',
                marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                {stats.map(({ label, before, after, unit }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal-600)' }}>
                      {before !== '—' ? `${before} → ` : ''}{after} {unit}
                      <span style={{ color: 'var(--teal-500)', marginLeft: 4 }}>↑</span>
                    </span>
                  </div>
                ))}
              </div>

              {/* Stars */}
              <div style={{ color: 'var(--teal-500)', fontSize: 14, marginBottom: 12 }}>★★★★★</div>

              {/* Author */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'var(--teal-800)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                }}>
                  {initials}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-900)' }}>{name}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
