import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, Calendar, ChevronRight, Upload } from 'lucide-react'
import api from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'

function normalizeStatus(status) {
  const value = String(status || '').toLowerCase()
  if (value.includes('optimal') || value.includes('normal')) return 'optimal'
  if (value.includes('border') || value.includes('warn')) return 'warning'
  if (value.includes('critical') || value.includes('deficient') || value.includes('elevated')) return 'critical'
  return 'warning'
}

function normalizeProgressPayload(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

export default function LabResultsList() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return

    let active = true
    api.get('/progress')
      .then((res) => {
        if (!active) return
        setItems(normalizeProgressPayload(res.data))
        setError(null)
      })
      .catch(() => {
        if (!active) return
        setError('Could not load lab results.')
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user])

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const da = new Date(a?.test_date || a?.created_at || 0).getTime()
      const db = new Date(b?.test_date || b?.created_at || 0).getTime()
      return db - da
    })
  }, [items])

  if (loading) {
    return (
      <div className="min-h-screen p-6 max-w-5xl mx-auto">
        <div className="animate-pulse h-8 w-56 bg-gray-700 rounded-xl mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="animate-pulse bg-gray-800 rounded-xl h-24" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-green-400 mb-1">Lab Results</h2>
          <p className="text-gray-400 text-sm">History of uploaded tests and biomarker quality snapshot.</p>
        </div>
        <button
          onClick={() => navigate('/upload')}
          className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
        >
          <Upload className="w-4 h-4" />
          Upload New Test
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4 mb-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {sortedItems.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <FlaskConical className="w-10 h-10 text-gray-500 mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">No lab uploads yet</p>
          <p className="text-gray-400 text-sm mb-4">Upload your first document to generate biomarkers and protocol.</p>
          <button
            onClick={() => navigate('/upload')}
            className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-semibold"
          >
            Go to Upload
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedItems.map((item, index) => {
            const date = item?.test_date || item?.created_at?.slice(0, 10) || 'Unknown date'
            const biomarkers = Array.isArray(item?.biomarkers) ? item.biomarkers : []
            const optimal = biomarkers.filter((b) => normalizeStatus(b?.status) === 'optimal').length
            const warning = biomarkers.filter((b) => normalizeStatus(b?.status) === 'warning').length
            const critical = biomarkers.filter((b) => normalizeStatus(b?.status) === 'critical').length
            const uploadId = item?.upload_id || item?.id

            return (
              <button
                key={uploadId || `${date}-${index}`}
                onClick={() => uploadId && navigate(`/results/${uploadId}`)}
                disabled={!uploadId}
                className="w-full text-left bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-green-500/60 hover:bg-gray-900/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white font-semibold truncate">{item?.lab_name || `Upload #${sortedItems.length - index}`}</p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {date}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 md:gap-3 text-xs">
                    <div className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Optimal: {optimal}</div>
                    <div className="px-2 py-1 rounded border border-yellow-500/30 bg-yellow-500/10 text-yellow-300">Warning: {warning}</div>
                    <div className="px-2 py-1 rounded border border-red-500/30 bg-red-500/10 text-red-300">Critical: {critical}</div>
                  </div>

                  <div className="text-gray-400 text-sm inline-flex items-center gap-1 self-start md:self-center">
                    Open
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
