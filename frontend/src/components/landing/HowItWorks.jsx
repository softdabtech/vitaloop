import { Activity, ClipboardList, FileUp, LineChart, Search } from 'lucide-react'

function StepLabel({ n }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--teal-500)',
      marginBottom: 12,
    }}>
      Step {n}
    </div>
  )
}

function StepCard({ icon, title, subtitle, lines }) {
  return (
    <div style={{
      background: 'var(--gray-50)',
      borderRadius: 18,
      border: '0.5px solid var(--gray-100)',
      padding: 24,
      height: '100%',
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: 'var(--teal-50)',
        border: '0.5px solid var(--teal-300)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--teal-600)',
        marginBottom: 14,
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 6 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: 'var(--teal-600)', marginBottom: 10 }}>{subtitle}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lines.map((line) => (
          <div key={line} style={{ fontSize: 14, color: 'var(--gray-500)', lineHeight: 1.55 }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  )
}

const STEPS = [
  {
    n: 1,
    title: 'Upload your labs',
    desc: 'Upload any lab results in seconds - we extract all biomarkers automatically.',
    card: {
      icon: <FileUp size={18} aria-hidden="true" />,
      title: 'Lab upload',
      lines: ['PDF, JPG, PNG accepted', 'Auto biomarker extraction starts instantly'],
    },
  },
  {
    n: 2,
    title: "Understand what's wrong",
    desc: 'AI identifies deficiencies, risks, and hidden patterns in your data.',
    card: {
      icon: <Search size={18} aria-hidden="true" />,
      title: 'AI analysis summary',
      lines: ['Deficiencies and borderline markers highlighted', 'Clear priorities for the next actions'],
    },
  },
  {
    n: 3,
    title: 'Answer a few questions',
    desc: 'Tell us about your symptoms and lifestyle - we refine your results.',
    micro: 'Takes less than 60 seconds',
    card: {
      icon: <ClipboardList size={18} aria-hidden="true" />,
      title: 'Symptom and lifestyle check-in',
      subtitle: 'Takes less than 60 seconds',
      lines: ['Energy, sleep, mood, digestion', 'Context improves recommendation quality'],
    },
  },
  {
    n: 4,
    title: 'Get your protocol',
    desc: 'Personalized nutrition and supplement plan - clear and actionable.',
    card: {
      icon: <Activity size={18} aria-hidden="true" />,
      title: 'Your weekly protocol',
      lines: ['Prioritized recommendations with guidance', 'Built for practical daily execution'],
    },
  },
  {
    n: 5,
    title: 'Track your progress',
    desc: 'Monitor improvements over time and adjust before problems grow.',
    card: {
      icon: <LineChart size={18} aria-hidden="true" />,
      title: 'Progress tracking',
      lines: ['Weekly trend view across key markers', 'Refine protocol as your data evolves'],
    },
  },
]

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" style={{ padding: 'var(--py-xl) 24px', backgroundColor: 'var(--white)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(48px, 7vw, 84px)' }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--teal-500)',
            marginBottom: 16,
          }}>
            How VITALOOP improves your health
          </div>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 52px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--gray-900)',
            marginBottom: 20,
          }}>
            From raw labs to weekly progress
          </h2>
          <p style={{ fontSize: 17, color: 'var(--gray-500)', maxWidth: 620, margin: '0 auto', lineHeight: 1.65 }}>
            A clear 5-step flow focused on outcomes: understand your data, apply recommendations, and improve over time.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {STEPS.map((step, i) => (
            <div key={step.n} className="how-step-row grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-stretch">
              <div className={i % 2 === 0 ? '' : 'md:order-2'} style={{
                background: 'white',
                borderRadius: 18,
                border: '0.5px solid var(--gray-100)',
                padding: '28px 24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <StepLabel n={step.n} />
                <h3 style={{
                  fontSize: 'clamp(26px, 3.4vw, 38px)',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: 'var(--gray-900)',
                  marginBottom: 12,
                  lineHeight: 1.18,
                }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 17, color: 'var(--gray-500)', lineHeight: 1.65, marginBottom: step.micro ? 8 : 0 }}>
                  {step.desc}
                </p>
                {step.micro && (
                  <p style={{ fontSize: 13, color: 'var(--teal-600)', fontWeight: 600 }}>
                    {step.micro}
                  </p>
                )}
              </div>
              <div className={i % 2 === 0 ? '' : 'md:order-1'}>
                <StepCard
                  icon={step.card.icon}
                  title={step.card.title}
                  subtitle={step.card.subtitle}
                  lines={step.card.lines}
                />
              </div>
              <div className="how-step-connector" aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
