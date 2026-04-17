import { Activity, ArrowRight, ClipboardList, FileUp, LineChart, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { fadeUp, slideIn, cardHoverProps, viewport, EASE } from '../../lib/motion.js'

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
    <motion.div
      {...cardHoverProps}
      style={{
        background: 'var(--gray-50)',
        borderRadius: 18,
        border: '0.5px solid var(--gray-100)',
        padding: 24,
        height: '100%',
        cursor: 'default',
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
    </motion.div>
  )
}

const STEPS = [
  {
    n: 1,
    title: 'Upload your labs',
    desc: 'Upload any lab results in seconds. Biomarkers are extracted automatically.',
    card: {
      icon: <FileUp size={18} aria-hidden="true" />,
      title: 'Lab upload',
      lines: ['PDF, JPG, PNG accepted', 'Auto biomarker extraction starts instantly'],
    },
  },
  {
    n: 2,
    title: "Understand what's wrong",
    desc: 'AI identifies deficiencies, risks, and meaningful patterns in your data.',
    card: {
      icon: <Search size={18} aria-hidden="true" />,
      title: 'AI analysis summary',
      lines: ['Deficiencies and borderline markers highlighted', 'Clear priorities for the next actions'],
    },
  },
  {
    n: 3,
    title: 'Answer a few questions',
    desc: 'Add symptoms and lifestyle context to refine your analysis.',
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
    desc: 'Receive a personalized protocol with clear, prioritized actions.',
    card: {
      icon: <Activity size={18} aria-hidden="true" />,
      title: 'Your weekly protocol',
      lines: ['Prioritized recommendations with guidance', 'Built for practical daily execution'],
    },
  },
  {
    n: 5,
    title: 'Track your progress',
    desc: 'Track trends over time and adjust before small issues grow.',
    card: {
      icon: <LineChart size={18} aria-hidden="true" />,
      title: 'Progress tracking',
      lines: ['Weekly trend view across key markers', 'Refine protocol as your data evolves'],
    },
  },
]

export default function HowItWorksSection() {
  const reduced = useReducedMotion()
  const navigate = useNavigate()

  return (
    <section id="how-it-works" style={{ padding: 'var(--py-xl) 24px', backgroundColor: 'var(--white)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <motion.div
          variants={reduced ? {} : { hidden: {}, visible: { transition: { staggerChildren: 0 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={viewport('-40px')}
          style={{ textAlign: 'center', marginBottom: 'clamp(48px, 7vw, 84px)' }}
        >
          <motion.div
            variants={reduced ? {} : fadeUp}
            custom={0}
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--teal-500)',
              marginBottom: 16,
            }}>
            How VITALOOP improves your health
          </motion.div>
          <motion.h2
            variants={reduced ? {} : fadeUp}
            custom={0.08}
            style={{
              fontSize: 'clamp(32px, 4vw, 52px)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--gray-900)',
              marginBottom: 20,
            }}
          >
            From raw labs to weekly progress
          </motion.h2>
          <motion.p
            variants={reduced ? {} : fadeUp}
            custom={0.16}
            style={{ fontSize: 17, color: 'var(--gray-500)', maxWidth: 620, margin: '0 auto', lineHeight: 1.65 }}
          >
            OCR extracts your data, Claude LLM interprets 50+ biomarkers, and VITALOOP delivers practical next steps.
          </motion.p>
        </motion.div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 72 }}>
          {STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              className="how-step-row grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center"
              variants={reduced ? {} : (i % 2 === 0 ? slideIn('left') : slideIn('right'))}
              custom={0}
              initial="hidden"
              whileInView="visible"
              viewport={viewport('-40px')}
            >
              <motion.div
                className={i % 2 === 0 ? '' : 'md:order-2'}
                style={{
                  background: 'white',
                  borderRadius: 18,
                  border: '0.5px solid var(--gray-100)',
                  padding: '28px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                {/* Step number badge — springs in */}
                <motion.div
                  initial={reduced ? {} : { scale: 0.5, opacity: 0 }}
                  whileInView={reduced ? {} : { scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.15 }}
                  viewport={{ once: true }}
                >
                  <StepLabel n={step.n} />
                </motion.div>
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
              </motion.div>
              <div className={i % 2 === 0 ? '' : 'md:order-1'}>
                <StepCard
                  icon={step.card.icon}
                  title={step.card.title}
                  subtitle={step.card.subtitle}
                  lines={step.card.lines}
                />
              </div>
              <div className="how-step-connector" aria-hidden="true" />
            </motion.div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <button
            onClick={() => navigate('/login?signup=true')}
            className="btn-primary"
            style={{
              background: 'var(--teal-500)',
              color: 'white',
              border: 'none',
              borderRadius: 980,
              padding: '12px 24px',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            Try it for Free <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
