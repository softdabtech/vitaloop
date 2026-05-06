import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'

/**
 * AnimatedCounter Component
 * Animates a number from 0 to a target value with smooth easing
 * Useful for health scores, statistics, and metrics
 */

export default function AnimatedCounter({
  value,
  decimals = 0,
  duration = 2,
  suffix = '',
  prefix = '',
  className = '',
  animated = true,
}) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, (latest) => {
    const rounded = Math.round(latest * Math.pow(10, decimals)) / Math.pow(10, decimals)
    return decimals > 0 ? rounded.toFixed(decimals) : Math.round(rounded)
  })

  useEffect(() => {
    if (!animated) {
      count.set(value)
      return
    }

    const animation = count.animate(value, {
      duration: duration,
      ease: [0.25, 0.46, 0.45, 0.94], // easeOutQuad-like
    })

    return () => animation.stop()
  }, [value, duration, animated, count])

  return (
    <motion.span className={className}>
      {prefix}
      {rounded}
      {suffix}
    </motion.span>
  )
}
