import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Info, X, Lightbulb } from 'lucide-react'
import { getBiomarkerContext, getCategoryColor } from '../lib/biomarker-context.js'

/**
 * Shows biomarker explanation on hover/click
 * Displays what the biomarker is, what it means, and recommended actions
 */
export default function BiomarkerContextTooltip({ biomarkerName, value, status, size = 'md' }) {
  const [showInfo, setShowInfo] = useState(false)
  const context = getBiomarkerContext(biomarkerName)

  if (!context) {
    return null // No context available for this biomarker
  }

  const categoryColor = getCategoryColor(context.category)

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  }

  const buttonSizes = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2',
  }

  return (
    <>
      {/* Info button */}
      <button
        onClick={() => setShowInfo(true)}
        className={`${buttonSizes[size]} rounded-full text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition flex-shrink-0`}
        title={`Learn about ${biomarkerName}`}
      >
        <Info className={iconSizes[size]} />
      </button>

      {/* Modal/Overlay */}
      <AnimatePresence>
        {showInfo && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInfo(false)}
              className="fixed inset-0 bg-black/20 z-40"
            />

            {/* Tooltip Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 max-w-sm w-11/12"
            >
              <div className="rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className={`${categoryColor} px-6 py-4 flex items-start justify-between`}>
                  <div className="flex-1">
                    <div className="inline-block text-xs font-semibold uppercase tracking-wide opacity-75">
                      {context.category}
                    </div>
                    <h3 className="text-lg font-bold mt-1">{biomarkerName}</h3>
                  </div>
                  <button
                    onClick={() => setShowInfo(false)}
                    className="p-1 rounded-lg hover:bg-white/20 transition flex-shrink-0"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                  {/* What it is */}
                  <div>
                    <p className="text-sm font-semibold text-slate-700">What it is</p>
                    <p className="text-sm text-slate-600 mt-1">{context.description}</p>
                  </div>

                  {/* What it means */}
                  <div>
                    <p className="text-sm font-semibold text-slate-700">What it means</p>
                    <p className="text-sm text-slate-600 mt-1">{context.what_it_means}</p>
                  </div>

                  {/* Your value */}
                  {value !== undefined && (
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-semibold text-slate-600 uppercase">Your value</p>
                      <p className="text-lg font-bold text-slate-900 mt-1">{value}</p>
                      {status && (
                        <p className="text-xs text-slate-500 mt-1">Status: {status}</p>
                      )}
                    </div>
                  )}

                  {/* Normal range */}
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase">Normal range</p>
                    <p className="text-sm text-slate-700 mt-1 font-mono">{context.normal_range}</p>
                  </div>

                  {/* Recommended actions */}
                  {context.actions && context.actions.length > 0 && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-emerald-900 uppercase">Tips</p>
                          <ul className="text-sm text-emerald-800 mt-1 space-y-1">
                            {context.actions.map((action, idx) => (
                              <li key={idx} className="flex gap-2">
                                <span className="text-emerald-600">•</span>
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
                  <button
                    onClick={() => setShowInfo(false)}
                    className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-900 font-medium text-sm transition"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
