import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOCR } from '../hooks/useOCR.js'
import UploadZone from '../components/UploadZone.jsx'
import SymptomSelector from '../components/SymptomSelector.jsx'
import api from '../lib/api.js'
import { trackFunnelEvent } from '../lib/funnel.js'
import toast from 'react-hot-toast'
import '../styles/dashboard2026.css'

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024
const SUPPORTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

export default function Upload() {
  const navigate = useNavigate()
  const { processFile, progress, isProcessing } = useOCR()
  const [symptoms, setSymptoms] = useState([])
  const [labName, setLabName] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedFileName, setSelectedFileName] = useState('')

  const isBusy = isProcessing || analyzing

  function validateFile(file) {
    if (!file) {
      return 'No file selected. Please choose a lab report.'
    }

    if (!SUPPORTED_FILE_TYPES.includes(file.type)) {
      return 'Unsupported file type. Please upload PDF, JPG, or PNG.'
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return 'File is too large. Please upload a file under 20MB.'
    }

    return ''
  }

  async function handleFile(file) {
    if (isBusy) {
      return
    }

    const validationError = validateFile(file)
    if (validationError) {
      setErrorMessage(validationError)
      toast.error(validationError)
      return
    }

    setErrorMessage('')
    setSelectedFileName(file.name)

    toast('Extracting text from your lab report…', { icon: '🔍' })
    let text = ''
    let confidence = null

    try {
      const result = await processFile(file)
      text = result.text
      confidence = result.confidence
    } catch (err) {
      setErrorMessage('Could not read this file. Please try another clear PDF or image.')
      toast.error('Could not read this file. Please try another clear PDF or image.')
      return
    }

    if (!text || text.trim().length < 20) {
      setErrorMessage('Not enough readable text found. Please upload a clearer document.')
      toast.error('Could not read the document. Try a clearer image or PDF.')
      return
    }

    setAnalyzing(true)
    try {
      // user_id is now derived from JWT on the backend — not sent in body
      const { data } = await api.post('/analyze', {
        extracted_text: text,
        lab_name: labName || undefined,
        ocr_confidence: confidence,
        symptoms,
      })

      // Generate protocol
      await api.post('/protocol', {
        upload_id: data.upload_id,
        symptoms,
      })

      // Save symptoms record
      if (symptoms.length > 0) {
        await api.post('/symptoms', {
          upload_id: data.upload_id,
          tags: symptoms,
        }).catch(() => null) // non-critical
      }

      trackFunnelEvent('funnel_first_upload_completed', 'User completed first lab upload analysis', {
        upload_id: data.upload_id,
        symptoms_count: symptoms.length,
        has_lab_name: Boolean(labName),
      }, { oncePerSession: true })

      toast.success('Analysis complete!')
      navigate(`/results/${data.upload_id}`)
    } catch (err) {
      const message = err.response?.data?.detail || 'Analysis failed. Please try again.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="vtl-shell min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="vtl-card mb-6 p-6 sm:p-7">
          <h2 className="mb-2 text-2xl font-bold tracking-tight text-slate-100">Upload Lab Results</h2>
          <p className="text-sm text-slate-300">
            Your file is processed locally first. Only extracted text is sent for analysis.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
          <div className={`rounded-xl border px-3 py-2 ${isProcessing ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200' : 'border-slate-700 bg-slate-900/50 text-slate-400'}`}>
            1. Read document
          </div>
          <div className={`rounded-xl border px-3 py-2 ${analyzing ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200' : 'border-slate-700 bg-slate-900/50 text-slate-400'}`}>
            2. Analyze biomarkers
          </div>
          <div className={`rounded-xl border px-3 py-2 ${!isBusy && selectedFileName ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200' : 'border-slate-700 bg-slate-900/50 text-slate-400'}`}>
            3. Open results
          </div>
        </div>

        {errorMessage && (
          <div className="mb-5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300" role="alert">
            {errorMessage}
          </div>
        )}

        <p className="mb-6 text-sm text-slate-400">
          Tip: upload a clear full-page PDF or a sharp photo in good lighting.
        </p>

        <div className="mb-6">
          <label className="mb-1 block text-sm text-slate-300">Lab / Clinic name (optional)</label>
          <input
            value={labName}
            disabled={isBusy}
            onChange={(e) => setLabName(e.target.value)}
            placeholder="Quest, LabCorp, Other..."
            className="vtl-focus-ring w-full rounded-xl border border-slate-600 bg-slate-900/65 px-4 py-3 text-slate-100 placeholder-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <SymptomSelector selected={symptoms} onChange={setSymptoms} />

        <div className="mt-6">
          {isProcessing && (
            <div className="mb-4 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4">
              <div className="mb-2 text-sm text-emerald-200">Reading document... {progress}%</div>
              <div className="h-2.5 w-full rounded-full bg-emerald-900/40">
                <div className="h-2.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
              {selectedFileName && <div className="mt-2 truncate text-xs text-emerald-300">{selectedFileName}</div>}
            </div>
          )}

          {analyzing && (
            <div className="mb-4 animate-pulse rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              AI is analyzing your results. This usually takes under a minute.
            </div>
          )}

          {!isProcessing && !analyzing && <UploadZone onFile={handleFile} disabled={isBusy} />}
        </div>
      </div>
    </div>
  )
}
