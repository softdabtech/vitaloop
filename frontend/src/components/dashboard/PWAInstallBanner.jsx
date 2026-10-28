import { motion, AnimatePresence } from 'framer-motion'
import { Download, Share, X } from 'lucide-react'
import { usePWAInstall } from '../../hooks/usePWAInstall.js'

/**
 * Install banner shown to mobile users who haven't installed the PWA yet.
 * Shows on Android: native install prompt.
 * Shows on iOS: manual "Share → Add to Home Screen" tip.
 */
export default function PWAInstallBanner() {
  const { canInstall, install, dismiss, isIOS } = usePWAInstall()

  if (!canInstall) return null

  return (
    <AnimatePresence>
      <motion.div
        key="pwa-banner"
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="mx-4 mb-4 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 shadow-lg shadow-emerald-100/50"
      >
        <div className="flex items-start gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 shadow-sm shadow-emerald-500/30">
            <span className="text-xl">💚</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800">Install Vitaloop App</p>
            {isIOS ? (
              <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                Tap <Share className="inline h-3.5 w-3.5 text-blue-500" /> <strong>Share</strong> in Safari, then <strong>Add to Home Screen</strong> for the full app experience.
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-slate-600">
                Install for offline access, faster loading, and a native app experience — no App Store needed.
              </p>
            )}
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!isIOS && (
          <div className="flex gap-2 border-t border-emerald-100 px-4 py-3">
            <button
              onClick={install}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 active:scale-95"
            >
              <Download className="h-4 w-4" />
              Add to Home Screen
            </button>
            <button
              onClick={dismiss}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 active:scale-95"
            >
              Not now
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
