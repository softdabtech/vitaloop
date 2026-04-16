import { motion, useReducedMotion } from 'framer-motion'
import { fadeUp, viewport as vp } from '../lib/motion.js'

/**
 * Drop-in animated wrapper for any section or block.
 * Respects prefers-reduced-motion — falls back to instant render.
 *
 * Props:
 *  delay     — stagger delay in seconds (default 0)
 *  margin    — viewport trigger margin (default '-60px')
 *  className — forwarded to motion.div
 *  style     — forwarded to motion.div
 */
export default function AnimatedSection({ children, delay = 0, margin = '-60px', className, style }) {
  const reduced = useReducedMotion()

  if (reduced) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      className={className}
      style={style}
      variants={fadeUp}
      custom={delay}
      initial="hidden"
      whileInView="visible"
      viewport={vp(margin)}
    >
      {children}
    </motion.div>
  )
}
