/**
 * Shared Framer Motion variants & helpers — VITALOOP design system
 * easing: [0.16, 1, 0.3, 1]  ≈ easeOutExpo (premium, fast settle)
 */

export const EASE = [0.16, 1, 0.3, 1]
export const SPRING = { type: 'spring', stiffness: 360, damping: 24 }
export const SPRING_SOFT = { type: 'spring', stiffness: 220, damping: 22 }

/** Fade up from y=28 — most common reveal */
export const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: EASE, delay },
  }),
}

/** Pure fade — for backgrounds and overlays */
export const fadeIn = {
  hidden: { opacity: 0 },
  visible: (delay = 0) => ({
    opacity: 1,
    transition: { duration: 0.32, ease: EASE, delay },
  }),
}

/** Fade up with blur — for hero headlines */
export const fadeUpBlur = {
  hidden: { opacity: 0, y: 32, filter: 'blur(8px)' },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.48, ease: EASE, delay },
  }),
}

/** Container: staggers children */
export const stagger = (delayBetween = 0.1, delayStart = 0) => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: delayBetween, delayChildren: delayStart },
  },
})

/** Child item for staggered lists (uses fadeUp automatically) */
export const staggerChild = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: EASE } },
}

/** Scale in from 0.88 — for cards that pop */
export const scaleIn = {
  hidden: { opacity: 0, scale: 0.88 },
  visible: (delay = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { ...SPRING_SOFT, delay },
  }),
}

/** Slide in from a side */
export const slideIn = (dir = 'left', dist = 48) => ({
  hidden: {
    opacity: 0,
    x: dir === 'left' ? -dist : dir === 'right' ? dist : 0,
    y: dir === 'up' ? dist : dir === 'down' ? -dist : 0,
  },
  visible: (delay = 0) => ({
    opacity: 1,
    x: 0,
    y: 0,
    transition: { duration: 0.44, ease: EASE, delay },
  }),
})

/** Viewport defaults — use once:true everywhere for perf */
export const viewport = (margin = '-60px') => ({ once: true, margin })

/** Card hover props — spread onto motion.div */
export const cardHoverProps = {
  whileHover: { scale: 1.025, boxShadow: '0 12px 32px rgba(16,185,129,0.13)' },
  transition: SPRING,
}

/** Button tap/hover props */
export const buttonHoverProps = {
  whileHover: { scale: 1.04 },
  whileTap: { scale: 0.97 },
  transition: SPRING,
}
