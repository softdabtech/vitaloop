/**
 * Accessible Form Field Component
 * Provides proper ARIA labels, error states, and accessibility features
 */

import { AlertCircle, CheckCircle, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function AccessibleFormField({
  id,
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  helperText,
  required = false,
  disabled = false,
  aria = {},
  className = '',
  ...props
}) {
  const inputId = id || `field-${Math.random()}`
  const errorId = `${inputId}-error`
  const helperId = `${inputId}-helper`

  const ariaAttrs = {
    'aria-label': label,
    'aria-required': required,
    'aria-invalid': !!error,
    'aria-describedby': [error && errorId, helperText && helperId].filter(Boolean).join(' ') || undefined,
    ...aria,
  }

  return (
    <div className="space-y-2">
      {/* Label */}
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-700 transition-colors"
        >
          {label}
          {required && <span className="ml-1 text-red-500" aria-label="required">*</span>}
        </label>
      )}

      {/* Input Wrapper */}
      <div className="relative">
        <input
          id={inputId}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`
            w-full rounded-lg border-2 px-4 py-2.5 text-sm
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-emerald-500/50
            disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500
            ${
    error
      ? 'border-red-500 bg-red-50 focus:border-red-600 focus:ring-red-500/30'
      : 'border-slate-200 bg-white focus:border-emerald-500'
    }
            ${className}
          `}
          {...ariaAttrs}
          {...props}
        />

        {/* Status Icons */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <AlertCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            id={errorId}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 text-sm text-red-600"
            role="alert"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Helper Text */}
      <AnimatePresence>
        {helperText && !error && (
          <motion.p
            id={helperId}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 text-xs text-slate-500"
          >
            <Info className="h-3 w-3 flex-shrink-0" />
            <span>{helperText}</span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Accessible Textarea Component
 */
export function AccessibleTextarea({
  id,
  label,
  placeholder,
  value,
  onChange,
  error,
  helperText,
  required = false,
  disabled = false,
  rows = 4,
  maxLength,
  aria = {},
  className = '',
  ...props
}) {
  const inputId = id || `field-${Math.random()}`
  const errorId = `${inputId}-error`
  const helperId = `${inputId}-helper`
  const charCountId = `${inputId}-charcount`

  return (
    <div className="space-y-2">
      {/* Label */}
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-700"
        >
          {label}
          {required && <span className="ml-1 text-red-500" aria-label="required">*</span>}
        </label>
      )}

      {/* Textarea */}
      <div className="relative">
        <textarea
          id={inputId}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          rows={rows}
          maxLength={maxLength}
          className={`
            w-full rounded-lg border-2 px-4 py-2.5 text-sm
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-emerald-500/50
            disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500
            resize-none
            ${
    error
      ? 'border-red-500 bg-red-50 focus:border-red-600 focus:ring-red-500/30'
      : 'border-slate-200 bg-white focus:border-emerald-500'
    }
            ${className}
          `}
          aria-label={label}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={[error && errorId, helperText && helperId, maxLength && charCountId].filter(Boolean).join(' ') || undefined}
          {...props}
        />

        {/* Character Count */}
        {maxLength && (
          <div id={charCountId} className="mt-1 text-right text-xs text-slate-500">
            {value?.length || 0} / {maxLength}
          </div>
        )}
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            id={errorId}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 text-sm text-red-600"
            role="alert"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Helper Text */}
      {helperText && !error && (
        <p id={helperId} className="flex items-center gap-2 text-xs text-slate-500">
          <Info className="h-3 w-3 flex-shrink-0" />
          <span>{helperText}</span>
        </p>
      )}
    </div>
  )
}

/**
 * Accessible Button Component
 */
export function AccessibleButton({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  aria = {},
  className = '',
  ...props
}) {
  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500/30',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-slate-500/30',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500/30',
    outline: 'border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 focus:ring-emerald-500/30',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2
        rounded-lg font-medium
        transition-all duration-200
        focus:outline-none focus:ring-2
        disabled:cursor-not-allowed disabled:opacity-50
        ${sizes[size]}
        ${variants[variant]}
        ${className}
      `}
      aria-busy={loading}
      aria-disabled={disabled || loading}
      {...aria}
      {...props}
    >
      {loading && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="h-4 w-4 rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
}

export default AccessibleFormField
