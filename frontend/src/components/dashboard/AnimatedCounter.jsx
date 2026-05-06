import { useEffect, useState } from 'react'

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
  const [displayValue, setDisplayValue] = useState(value)

  useEffect(() => {
    if (!animated) {
      setDisplayValue(value)
      return
    }

    const startTime = Date.now()
    const startValue = displayValue
    const difference = value - startValue

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / (duration * 1000), 1)

      // Easing function: easeOutQuad
      const easeProgress = 1 - (1 - progress) * (1 - progress)
      const currentValue = startValue + difference * easeProgress

      const rounded = Math.round(currentValue * Math.pow(10, decimals)) / Math.pow(10, decimals)
      const formatted = decimals > 0 ? rounded.toFixed(decimals) : Math.round(rounded)

      setDisplayValue(formatted)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setDisplayValue(value)
      }
    }

    const animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [value, duration, animated, decimals, displayValue])

  return (
    <span className={className}>
      {prefix}
      {displayValue}
      {suffix}
    </span>
  )
}
