import { motion } from 'framer-motion'

/**
 * PremiumCard Component
 * Reusable card with premium styling, animations, and hover effects
 * Based on landing page design language
 */

export default function PremiumCard({
  children,
  className = '',
  variant = 'default', // 'default' | 'gradient' | 'gradient-light'
  withHover = true,
  animated = true,
  delay = 0,
  onClick = null,
  testId = null,
}) {
  const variantClasses = {
    default: 'cabinet-card',
    'gradient-light': 'cabinet-card cabinet-gradient-light',
    gradient: 'cabinet-gradient-primary text-white',
  }

  const baseClass = variantClasses[variant] || variantClasses.default
  const hoverClass = withHover ? 'cabinet-card-hover' : ''
  const finalClass = `${baseClass} ${hoverClass} ${className}`

  const animationProps = animated
    ? {
      initial: { opacity: 0, y: 20 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, margin: '-100px' },
      transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] },
    }
    : {}

  const WrapperComponent = animated ? motion.div : 'div'

  return (
    <WrapperComponent
      className={finalClass}
      onClick={onClick}
      data-testid={testId}
      {...animationProps}
    >
      {children}
    </WrapperComponent>
  )
}
