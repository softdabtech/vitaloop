import { motion } from 'framer-motion'
import { stagger, staggerChild, viewport } from '../../lib/motion.js'

export default function ProblemSection() {
  return (
    <section
      id="problem"
      style={{
        background: 'var(--gray-950)',
        padding: 'var(--py-md) 24px',
      }}
    >
      <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
        <motion.div
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={viewport('-60px')}
        >
          <motion.div variants={staggerChild} style={{
            fontSize: 12, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--teal-400)', marginBottom: 20,
          }}>
            The Problem
          </motion.div>
          <motion.h2 variants={staggerChild} style={{
            fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700,
            letterSpacing: '-0.02em', color: 'white', lineHeight: 1.15,
            marginBottom: 24,
          }}>
            Most lab results are still a black box
          </motion.h2>
          <motion.p variants={staggerChild} style={{
            fontSize: 18, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7,
            maxWidth: 660, margin: '0 auto 24px',
          }}>
            Most reports show numbers without context. People lose hours trying to interpret markers,
            compare tests, and decide what to do next. Practitioners spend valuable time repeating the same analysis.
          </motion.p>
          <motion.p variants={staggerChild} style={{
            fontSize: 20, fontWeight: 600, color: 'var(--teal-400)',
            letterSpacing: '-0.01em',
          }}>
            VITALOOP turns raw labs into clear action.
          </motion.p>
        </motion.div>
      </div>
    </section>
  )
}
