import { motion } from 'framer-motion'

/**
 * GradientSection Component
 * Section with gradient background and accent glows
 * Used for featured sections, CTAs, and highlights
 */

export default function GradientSection({
  children,
  variant = 'primary', // 'primary' | 'light' | 'success' | 'warning' | 'danger'
  className = '',
  animated = true,
  withGlow = true,
  containerClassName = '',
}) {
  const variantClasses = {
    primary: 'cabinet-gradient-primary',
    light: 'cabinet-gradient-light',
    success: 'cabinet-gradient-success',
    warning: 'cabinet-gradient-warning',
    danger: 'cabinet-gradient-danger',
  }

  const glowClass = withGlow ? 'cabinet-glow' : ''
  const baseGradient = variantClasses[variant] || variantClasses.primary
  const finalClass = `rounded-2xl p-8 md:p-12 ${baseGradient} ${glowClass} ${className}`

  const animationProps = animated
    ? {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-100px' },
        transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
      }
    : {}

  const WrapperComponent = animated ? motion.div : 'div'

  return (
    <div className={containerClassName}>
      <WrapperComponent className={finalClass} {...animationProps}>
        {children}
      </WrapperComponent>
    </div>
  )
}
