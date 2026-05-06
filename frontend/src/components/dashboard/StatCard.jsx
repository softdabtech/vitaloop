import React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import AnimatedCounter from './AnimatedCounter'

export default function StatCard({
  title,
  value,
  unit,
  icon: Icon,
  color,
  change,
  onClick,
  animated = true,
  delay = 0,
}) {
  const colorConfig = {
    emerald: {
      icon: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30',
      border: 'border-emerald-100',
      bar: 'bg-emerald-500',
      gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(5, 150, 105, 0.05) 100%)',
      bgClass: 'hover:bg-gradient-to-br hover:from-emerald-50 hover:to-teal-50',
    },
    blue: {
      icon: 'bg-blue-500 text-white shadow-lg shadow-blue-500/30',
      border: 'border-blue-100',
      bar: 'bg-blue-500',
      gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(37, 99, 235, 0.05) 100%)',
      bgClass: 'hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50',
    },
    purple: {
      icon: 'bg-purple-500 text-white shadow-lg shadow-purple-500/30',
      border: 'border-purple-100',
      bar: 'bg-purple-500',
      gradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(147, 51, 234, 0.05) 100%)',
      bgClass: 'hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50',
    },
    orange: {
      icon: 'bg-orange-400 text-white shadow-lg shadow-orange-400/30',
      border: 'border-orange-100',
      bar: 'bg-orange-400',
      gradient: 'linear-gradient(135deg, rgba(251, 146, 60, 0.05) 0%, rgba(234, 88, 12, 0.05) 100%)',
      bgClass: 'hover:bg-gradient-to-br hover:from-orange-50 hover:to-yellow-50',
    },
  }

  const c = colorConfig[color] ?? colorConfig.emerald

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
      onClick={onClick}
      role={onClick ? 'button' : 'article'}
      tabIndex={onClick ? 0 : -1}
      className={`cabinet-stat-card ${c.bgClass} border-l-4 ${c.border} relative transition-all duration-300 ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        backgroundImage: c.gradient,
        backgroundBlendMode: 'overlay',
      }}
      {...animationProps}
    >
      {/* Decorative accent glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-200/10 to-transparent rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <motion.div
            className={`rounded-lg p-2.5 shadow-lg ${c.icon}`}
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <Icon className="w-6 h-6" />
          </motion.div>
          {change !== undefined && change !== 0 && (
            <motion.div
              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                change > 0
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-rose-100 text-rose-600'
              }`}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: delay + 0.1 }}
            >
              {change > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {Math.abs(change)}%
            </motion.div>
          )}
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</p>
        <p className="text-3xl font-bold tracking-tight text-slate-900 leading-none">
          <AnimatedCounter
            value={value}
            decimals={0}
            duration={1.5}
            animated={animated}
          />
          {unit && <span className="ml-2 text-sm font-normal text-slate-400">{unit}</span>}
        </p>
      </div>
    </WrapperComponent>
  )
}
