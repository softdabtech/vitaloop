/**
 * Empty State Illustration Component
 * Provides visual feedback when no data is available
 */

import { motion } from 'framer-motion'
import {
  FileUp,
  TrendingUp,
  Calendar,
  AlertCircle,
  CheckCircle,
  Heart,
} from 'lucide-react'

export function EmptyStateIllustration({ type = 'upload', size = 'md' }) {
  const sizeMap = {
    sm: 'h-12 w-12',
    md: 'h-16 w-16',
    lg: 'h-24 w-24',
  }

  const illustrations = {
    upload: {
      icon: FileUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      title: 'No uploads yet',
      description: 'Start by uploading your first lab report to get personalized biomarker analysis.',
      cta: 'Upload Lab Report',
    },
    results: {
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      title: 'No results available',
      description: 'Upload a lab report to see your biomarker analysis and personalized protocol.',
      cta: 'Upload Now',
    },
    checkins: {
      icon: Calendar,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      title: 'No check-ins yet',
      description: 'Track your progress by completing weekly check-ins.',
      cta: 'Start Check-in',
    },
    goals: {
      icon: Heart,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      title: 'No health goals set',
      description: 'Set health goals to get personalized recommendations.',
      cta: 'Set Goals',
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      title: 'Something went wrong',
      description: 'Please try again or contact support.',
      cta: 'Retry',
    },
    success: {
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      title: 'All set!',
      description: 'Your data has been processed successfully.',
      cta: 'Continue',
    },
  }

  const config = illustrations[type] || illustrations.upload
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 sm:p-12 ${config.bgColor} ${config.borderColor}`}
    >
      {/* Animated Icon */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className={`mb-4 ${sizeMap[size]}`}
      >
        <Icon className={`h-full w-full ${config.color}`} strokeWidth={1.5} />
      </motion.div>

      {/* Text Content */}
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{config.title}</h3>
      <p className="mt-2 max-w-xs text-center text-sm text-slate-600">
        {config.description}
      </p>
    </motion.div>
  )
}

/**
 * Loading Skeleton with Pulsing Animation
 */
export function SkeletonLoader({ className = '', count = 1 }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="h-20 rounded-2xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200"
        />
      ))}
    </div>
  )
}

/**
 * Card Skeleton Loader
 */
export function CardSkeleton({ count = 3 }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, delay: index * 0.1 }}
          className="h-40 rounded-2xl bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200"
        />
      ))}
    </div>
  )
}

export default EmptyStateIllustration
