import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader } from 'lucide-react'
import { isUkrainianLocale } from '../lib/locale.js'

/**
 * Visual progress indicator for lab analysis.
 *
 * Only ever mounted while the real analysis request is in flight (Upload.jsx
 * wraps it in `{analyzing && ...}`), so it must never claim completion itself
 * — the parent unmounts it once the request actually resolves. Progress here
 * is an honest approximation, capped well under 100%, with a calm
 * long-running message after the threshold instead of a fake finish line.
 */
const STAGE_COPY = {
  en: {
    stages: [
      { id: 'prepare', label: 'Preparing your report', until: 5 },
      { id: 'read', label: 'Reading your file', until: 15 },
      { id: 'extract', label: 'Extracting biomarkers', until: 35 },
      { id: 'connect', label: 'Connecting patterns', until: 55 },
    ],
    longRunning: 'Still working — this can take a little longer for large files.',
    progressLabel: 'Estimated progress',
    keepOpen: 'Keep this tab open — we\'ll take you to your results automatically.',
    elapsed: (s) => `Elapsed: ${s}s`,
  },
  uk: {
    stages: [
      { id: 'prepare', label: 'Готуємо ваш звіт', until: 5 },
      { id: 'read', label: 'Читаємо файл', until: 15 },
      { id: 'extract', label: 'Витягуємо показники', until: 35 },
      { id: 'connect', label: 'Зіставляємо закономірності', until: 55 },
    ],
    longRunning: 'Ще працюємо — для великих файлів це може зайняти трохи більше часу.',
    progressLabel: 'Орієнтовний прогрес',
    keepOpen: 'Не закривайте цю вкладку — ми автоматично перейдемо до результатів.',
    elapsed: (s) => `Минуло: ${s}с`,
  },
}

// Progress is capped well short of 100% — it is an estimate, never a claim
// that the request has finished. The real completion signal is the parent
// unmounting this component when the request actually resolves.
const PROGRESS_CAP = 90
const LONG_RUNNING_THRESHOLD_S = 55

export default function AnalysisProgressIndicator({ analyzing = false, elapsedSeconds = 0 }) {
  const isUk = isUkrainianLocale()
  const copy = isUk ? STAGE_COPY.uk : STAGE_COPY.en
  const { stages, longRunning } = copy

  const [currentStageIndex, setCurrentStageIndex] = useState(0)

  useEffect(() => {
    if (!analyzing) {
      setCurrentStageIndex(0)
      return
    }
    const index = stages.findIndex((stage) => elapsedSeconds < stage.until)
    setCurrentStageIndex(index === -1 ? stages.length - 1 : index)
  }, [analyzing, elapsedSeconds, stages])

  const isLongRunning = elapsedSeconds >= LONG_RUNNING_THRESHOLD_S
  const currentLabel = isLongRunning ? longRunning : stages[currentStageIndex]?.label
  const overallProgress = Math.min(PROGRESS_CAP, (elapsedSeconds / LONG_RUNNING_THRESHOLD_S) * PROGRESS_CAP)

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-6 rounded-xl bg-gradient-to-br from-emerald-50 to-slate-50 p-6 ring-1 ring-emerald-200"
    >
      {/* Overall progress bar — capped, never reaches or claims 100%/complete */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">{copy.progressLabel}</p>
          <p className="text-sm font-semibold text-emerald-600">{Math.round(overallProgress)}%</p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Current stage / status message */}
      <motion.div
        key={currentLabel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 ring-1 ring-emerald-100"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="shrink-0"
        >
          <Loader className="h-5 w-5 text-emerald-500" />
        </motion.div>
        <p className="text-sm text-slate-700">{currentLabel}</p>
      </motion.div>

      <div className="flex flex-col items-center gap-1 text-center text-xs text-slate-500">
        <p>{copy.elapsed(Math.floor(elapsedSeconds))}</p>
        <p>{copy.keepOpen}</p>
      </div>
    </motion.div>
  )
}
