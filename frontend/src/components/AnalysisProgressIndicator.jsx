import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader } from 'lucide-react'

/**
 * Visual progress indicator for lab analysis
 * Shows stages: Uploading → Extracting → Analyzing → Generating → Complete
 */
export default function AnalysisProgressIndicator({ analyzing = false, elapsedSeconds = 0 }) {
  const stages = [
    { id: 'upload', label: 'Uploading', duration: 3 },
    { id: 'extract', label: 'Extracting text', duration: 8 },
    { id: 'analyze', label: 'Analyzing biomarkers', duration: 20 },
    { id: 'generate', label: 'Generating protocol', duration: 5 },
    { id: 'complete', label: 'Complete', duration: 0 },
  ]

  const [currentStage, setCurrentStage] = useState(0)
  const [stageProgress, setStageProgress] = useState(0)

  useEffect(() => {
    if (!analyzing) {
      setCurrentStage(0)
      setStageProgress(0)
      return
    }

    let elapsed = 0
    for (let i = 0; i < stages.length - 1; i++) {
      if (elapsedSeconds < elapsed + stages[i].duration) {
        setCurrentStage(i)
        setStageProgress(((elapsedSeconds - elapsed) / stages[i].duration) * 100)
        return
      }
      elapsed += stages[i].duration
    }

    setCurrentStage(stages.length - 1)
    setStageProgress(100)
  }, [analyzing, elapsedSeconds])

  const overallProgress = analyzing
    ? (elapsedSeconds / 36) * 100 // 36s = total time estimate
    : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-6 rounded-xl bg-gradient-to-br from-emerald-50 to-slate-50 p-6 ring-1 ring-emerald-200"
    >
      {/* Overall progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Overall progress</p>
          <p className="text-sm font-semibold text-emerald-600">{Math.min(100, Math.round(overallProgress))}%</p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, overallProgress)}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Stage indicators */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Processing stages</p>
        <div className="space-y-2">
          {stages.map((stage, idx) => {
            const isActive = idx === currentStage && analyzing
            const isComplete = idx < currentStage
            const isCurrent = idx === currentStage

            return (
              <div key={stage.id} className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {isComplete ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500"
                    >
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </motion.div>
                  ) : isActive ? (
                    <div className="flex h-6 w-6 items-center justify-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <Loader className="h-5 w-5 text-emerald-500" />
                      </motion.div>
                    </div>
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-slate-300 bg-white" />
                  )}
                </div>

                <div className="flex-1">
                  <p className={`text-sm font-medium ${isActive || isComplete ? 'text-slate-900' : 'text-slate-500'}`}>
                    {stage.label}
                  </p>
                  {isCurrent && stage.duration > 0 && (
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <motion.div
                        className="h-full bg-emerald-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${stageProgress}%` }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                      />
                    </div>
                  )}
                </div>

                {isCurrent && stage.duration > 0 && (
                  <p className="text-xs text-slate-500">{Math.round(stageProgress)}%</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Status message */}
      <motion.div
        key={currentStage}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-lg bg-white px-4 py-3 text-center ring-1 ring-emerald-100"
      >
        <p className="text-sm text-slate-700">
          {analyzing ? (
            <>
              <span className="font-semibold text-emerald-600">{stages[currentStage]?.label}</span>
              {currentStage < stages.length - 1 && (
                <span className="text-slate-500">
                  {' '}
                  — This usually takes {stages[currentStage]?.duration}s
                </span>
              )}
            </>
          ) : (
            '✅ Analysis complete!'
          )}
        </p>
      </motion.div>

      {/* Time estimate */}
      {analyzing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-xs text-slate-500"
        >
          <p>
            Elapsed: <span className="font-mono font-semibold">{Math.floor(elapsedSeconds)}s</span> / Estimated:{' '}
            <span className="font-mono font-semibold">36s</span>
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}
