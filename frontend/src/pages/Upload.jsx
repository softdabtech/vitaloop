import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOCR } from '../hooks/useOCR.js'
import UploadZone from '../components/UploadZone.jsx'
import SymptomSelector from '../components/SymptomSelector.jsx'
import api from '../lib/api.js'
import toast from 'react-hot-toast'

export default function Upload() {
  const navigate = useNavigate()
  const { processFile, progress, isProcessing } = useOCR()
  const [symptoms, setSymptoms] = useState([])
  const [labName, setLabName] = useState('')
  const [analyzing, setAnalyzing] = useState(false)

  async function handleFile(file) {
    toast('Extracting text from your lab report…', { icon: '🔍' })
    const { text, confidence } = await processFile(file)

    if (!text || text.trim().length < 20) {
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

      toast.success('Analysis complete!')
      navigate(`/results/${data.upload_id}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Analysis failed. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-green-400 mb-6">Upload Lab Results</h2>
      <p className="text-gray-400 text-sm mb-6">
        Your PDF never leaves your device. Only the extracted text is sent for analysis.
      </p>

      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-1">Lab / Clinic name (optional)</label>
        <input
          value={labName}
          onChange={(e) => setLabName(e.target.value)}
          placeholder="Quest, LabCorp, Other…"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
        />
      </div>

      <SymptomSelector selected={symptoms} onChange={setSymptoms} />

      <div className="mt-6">
        {isProcessing && (
          <div className="mb-4">
            <div className="text-sm text-gray-400 mb-1">Reading document… {progress}%</div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {analyzing && <p className="text-sm text-gray-400 animate-pulse mb-4">AI is analyzing your results…</p>}
        {!isProcessing && !analyzing && <UploadZone onFile={handleFile} />}
      </div>
    </div>
  )
}
