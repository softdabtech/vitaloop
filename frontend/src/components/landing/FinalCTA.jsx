import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { stagger, staggerChild, buttonHoverProps, viewport } from '../../lib/motion.js'

export default function FinalCTA() {
  const navigate = useNavigate()
  const reduced = useReducedMotion()

  return (
    <section style={{
      background: 'var(--gray-950)',
      minHeight: 420,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center',
      padding: 'var(--py-sm) 24px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Radial glow */}
      {/* Radial glow — breathes slowly */}
      <div
        aria-hidden="true"
        className={reduced ? '' : 'cta-glow'}
        style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'radial-gradient(ellipse 60% 60% at 50% 50%, #085041 0%, transparent 70%)',
          opacity: 0.4,
        }}
      />

      <motion.div
        variants={reduced ? {} : stagger(0.1)}
        initial="hidden"
        whileInView="visible"
        viewport={viewport('-60px')}
        style={{ position: 'relative', zIndex: 1, maxWidth: 640 }}
      >
        <motion.div variants={reduced ? {} : staggerChild} style={{
          fontSize: 12, fontWeight: 600, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'var(--teal-300)', marginBottom: 16,
        }}>
          Start now
        </motion.div>
        <motion.h2 variants={reduced ? {} : staggerChild} style={{
          fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: 700,
          color: 'white', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 16,
        }}>
          Your biology is speaking.<br />
          It’s time to listen.
        </motion.h2>
        <motion.p variants={reduced ? {} : staggerChild} style={{
          fontSize: 'clamp(18px, 3vw, 22px)', color: 'var(--teal-300)',
          fontWeight: 500, letterSpacing: '-0.01em', marginBottom: 12,
        }}>
          Upload your first lab report — completely free.
        </motion.p>
        <motion.p variants={reduced ? {} : staggerChild} style={{
          fontSize: 17, color: 'var(--gray-300)',
          maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.65,
        }}>
          No credit card required. Instant results.
        </motion.p>
        <motion.button
          onClick={() => navigate('/login?signup=true')}
          className="btn-primary final-cta-btn"
          {...(reduced ? {} : buttonHoverProps)}
          style={{
            background: 'var(--teal-500)', color: 'white',
            border: 'none', borderRadius: 980,
            padding: '18px 52px', fontSize: 19, fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
        >
          Upload Labs Now — Start Free <ArrowRight size={18} aria-hidden="true" />
        </motion.button>
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, color: 'var(--gray-500)',
              transition: 'color 200ms',
              minHeight: 44,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--gray-300)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--gray-500)' }}
          >
            Already have an account? Sign in →
          </button>
        </div>
      </motion.div>
    </section>
  )
}
