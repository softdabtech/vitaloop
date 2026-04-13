import { NeonBodyMini } from './NeonBody.jsx'

const PROFILES = [
  {
    name: 'Sarah',
    age: 34,
    role: 'Marketing Director',
    zones: { brain: '#f5a623', heart: '#1D9E75', muscles: '#e53935', bones: '#e53935', gut: '#f5a623' },
    issues: 'Vitamin D, Iron, B12',
    attention: 4,
    story: 'After 90 days: 2 areas resolved ✓',
    storyColor: '#1D9E75',
  },
  {
    name: 'Marcus',
    age: 42,
    role: 'Startup Founder',
    zones: { brain: '#e53935', heart: '#f5a623', muscles: '#1D9E75', bones: '#f5a623', gut: '#1D9E75' },
    issues: 'Omega-3, CoQ10, Magnesium',
    attention: 3,
    story: 'After 90 days: energy +60%, focus restored',
    storyColor: '#1D9E75',
  },
  {
    name: 'Elena',
    age: 28,
    role: 'Athlete',
    zones: { brain: '#1D9E75', heart: '#1D9E75', muscles: '#f5a623', bones: '#1D9E75', gut: '#1D9E75' },
    issues: 'Zinc (borderline)',
    attention: 1,
    story: 'Performance maintained year-round',
    storyColor: '#1D9E75',
  },
]

const ZONE_LABEL = ['Brain', 'Heart', 'Muscles', 'Bones', 'Gut']
const ZONE_KEYS  = ['brain', 'heart', 'muscles', 'bones', 'gut']

export default function AvatarExamples() {
  return (
    <div style={{ marginTop: 80 }}>
      {/* Sub-header */}
      <div className="reveal" style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em' }}>
          Examples across 3 user profiles
        </div>
      </div>

      {/* 3 cards */}
      <div className="grid md:grid-cols-3 gap-6 stagger-children reveal">
        {PROFILES.map(({ name, age, role, zones, issues, attention, story, storyColor }) => (
          <div
            key={name}
            style={{
              background: '#1a1a1a',
              border: '0.5px solid rgba(255,255,255,0.06)',
              borderRadius: 24, padding: '32px 28px',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              transition: 'transform 300ms ease, border-color 300ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.borderColor = 'rgba(29,158,117,0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
            }}
          >
            {/* Avatar */}
            <NeonBodyMini zones={zones} size={80} />

            {/* Name */}
            <div style={{ marginTop: 16, marginBottom: 4, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>
                {name}, {age}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{role}</div>
            </div>

            {/* Zone status dots */}
            <div style={{ display: 'flex', gap: 6, marginTop: 12, marginBottom: 16 }}>
              {ZONE_KEYS.map((k, i) => (
                <div
                  key={k}
                  title={ZONE_LABEL[i]}
                  style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: zones[k], flexShrink: 0,
                  }}
                />
              ))}
            </div>

            {/* Issues */}
            <div style={{
              fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
              marginBottom: 6, textAlign: 'center',
            }}>
              {attention} {attention === 1 ? 'area' : 'areas'} to optimize
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16, textAlign: 'center' }}>
              {issues}
            </div>

            {/* Outcome */}
            <div style={{
              background: `${storyColor}15`,
              border: `0.5px solid ${storyColor}40`,
              borderRadius: 8, padding: '6px 12px',
              fontSize: 12, fontWeight: 600, color: storyColor,
              textAlign: 'center',
            }}>
              {story}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
