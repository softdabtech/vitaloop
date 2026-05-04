import { useState, useEffect } from 'react'
import { ChevronRight, Trash2, Plus } from 'lucide-react'
import api from '../lib/api.js'
import '../styles/manual-entry.css'

export default function ManualBiomarkerEntry({ onAnalyze, onLoading }) {
  const [entries, setEntries] = useState([])
  const [biomarkerOptions, setBiomarkerOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [errors, setErrors] = useState({})
  const [globalError, setGlobalError] = useState(null)

  // Load available biomarkers for dropdown
  useEffect(() => {
    const fetchBiomarkers = async () => {
      try {
        const { data } = await api.get('/analyze/biomarkers/options')
        setBiomarkerOptions(data || [])
        setLoading(false)
      } catch (err) {
        console.error('Failed to load biomarkers:', err)
        setGlobalError('Failed to load biomarker options. Please try refreshing.')
        setLoading(false)
      }
    }
    fetchBiomarkers()
  }, [])

  const addEntry = () => {
    setEntries([
      ...entries,
      { id: Date.now(), biomarker_id: '', value: '', unit: '', errors: [] }
    ])
  }

  const removeEntry = (id) => {
    setEntries(entries.filter(e => e.id !== id))
    const newErrors = { ...errors }
    delete newErrors[id]
    setErrors(newErrors)
  }

  const updateEntry = (id, field, value) => {
    setEntries(entries.map(e => {
      if (e.id === id) {
        const updated = { ...e, [field]: value }
        // Reset unit when biomarker changes
        if (field === 'biomarker_id') {
          updated.unit = ''
        }
        return updated
      }
      return e
    }))
    // Clear error for this field
    if (errors[id]) {
      const newErrors = { ...errors }
      delete newErrors[id]
      setErrors(newErrors)
    }
  }

  const getUnitsForBiomarker = (biomarkerId) => {
    const biomarker = biomarkerOptions.find(b => b.id === biomarkerId)
    if (!biomarker) return []
    return [biomarker.default_unit, ...biomarker.alternative_units]
  }

  const validateEntries = () => {
    const newErrors = {}
    let hasErrors = false

    entries.forEach((entry, idx) => {
      const entryErrors = []

      if (!entry.biomarker_id) {
        entryErrors.push('Select a biomarker')
        hasErrors = true
      }

      if (!entry.value || entry.value === '' || isNaN(parseFloat(entry.value))) {
        entryErrors.push('Enter a valid number')
        hasErrors = true
      } else if (parseFloat(entry.value) < 0) {
        entryErrors.push('Value cannot be negative')
        hasErrors = true
      } else if (parseFloat(entry.value) > 10000) {
        entryErrors.push('Value seems too high')
        hasErrors = true
      }

      if (!entry.unit) {
        entryErrors.push('Select a unit')
        hasErrors = true
      }

      if (entryErrors.length > 0) {
        newErrors[entry.id] = entryErrors
      }
    })

    setErrors(newErrors)
    return !hasErrors
  }

  const handleAnalyze = async () => {
    setGlobalError(null)

    if (entries.length === 0) {
      setGlobalError('Add at least one biomarker')
      return
    }

    if (!validateEntries()) {
      setGlobalError('Please fix the errors above')
      return
    }

    setAnalyzing(true)
    onLoading?.(true)

    try {
      const payload = {
        biomarkers: entries.map(e => ({
          biomarker_id: e.biomarker_id,
          value: parseFloat(e.value),
          unit: e.unit
        }))
      }

      const result = await api.post('/analyze/manual', payload)
      onAnalyze?.(result.data)
    } catch (err) {
      console.error('Analysis failed:', err)
      const message = err.response?.data?.detail || 'Analysis failed. Please try again.'
      setGlobalError(message)
    } finally {
      setAnalyzing(false)
      onLoading?.(false)
    }
  }

  if (loading) {
    return (
      <div className="manual-entry-loading">
        <div className="spinner"></div>
        <p>Loading biomarker database...</p>
      </div>
    )
  }

  if (!biomarkerOptions || biomarkerOptions.length === 0) {
    return (
      <div className="manual-entry-error">
        <p>Unable to load biomarker options. Please try uploading a PDF instead.</p>
      </div>
    )
  }

  return (
    <div className="manual-entry-container">
      <div className="manual-entry-header">
        <h3>📊 Enter Lab Results Manually</h3>
        <p className="subtitle">Don't have a PDF? Enter your biomarker values below to get personalized insights.</p>
      </div>

      {globalError && (
        <div className="alert alert-error">
          <p>{globalError}</p>
        </div>
      )}

      <div className="entries-section">
        {entries.length === 0 && (
          <div className="empty-state">
            <p>Click "Add Biomarker" to start entering your lab results</p>
          </div>
        )}

        {entries.map((entry, idx) => {
          const selectedBiomarker = biomarkerOptions.find(b => b.id === entry.biomarker_id)
          const units = getUnitsForBiomarker(entry.biomarker_id)
          const entryErrors = errors[entry.id] || []

          return (
            <div key={entry.id} className={`entry-card ${entryErrors.length > 0 ? 'has-error' : ''}`}>
              <div className="entry-fields">
                {/* Biomarker Dropdown */}
                <div className="field biomarker-field">
                  <label>Biomarker</label>
                  <select
                    value={entry.biomarker_id}
                    onChange={(e) => updateEntry(entry.id, 'biomarker_id', e.target.value)}
                    className={entryErrors.length > 0 ? 'has-error' : ''}
                  >
                    <option value="">Select biomarker...</option>
                    {biomarkerOptions.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Value Input */}
                <div className="field value-field">
                  <label>Value</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g., 14.5"
                    value={entry.value}
                    onChange={(e) => updateEntry(entry.id, 'value', e.target.value)}
                    className={entryErrors.length > 0 ? 'has-error' : ''}
                  />
                </div>

                {/* Unit Dropdown */}
                <div className="field unit-field">
                  <label>Unit</label>
                  <select
                    value={entry.unit}
                    onChange={(e) => updateEntry(entry.id, 'unit', e.target.value)}
                    disabled={!entry.biomarker_id}
                    className={entryErrors.length > 0 ? 'has-error' : ''}
                  >
                    <option value="">Unit...</option>
                    {units.map(u => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="btn-remove"
                  title="Remove this entry"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              {/* Show biomarker name once selected */}
              {selectedBiomarker && (
                <div className="entry-info">
                  <span className="badge">{selectedBiomarker.category}</span>
                  {selectedBiomarker.default_unit === entry.unit && (
                    <span className="hint">Standard unit</span>
                  )}
                  {selectedBiomarker.default_unit !== entry.unit && entry.unit && (
                    <span className="hint converting">Auto-converting to standard unit</span>
                  )}
                </div>
              )}

              {/* Error Messages */}
              {entryErrors.length > 0 && (
                <div className="error-messages">
                  {entryErrors.map((err, i) => (
                    <p key={i} className="error-text">• {err}</p>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {entries.length > 0 && (
          <button onClick={addEntry} className="btn-add-entry">
            <Plus size={18} />
            Add Another
          </button>
        )}

        {entries.length === 0 && (
          <button onClick={addEntry} className="btn-add-entry btn-primary">
            <Plus size={18} />
            Add First Biomarker
          </button>
        )}
      </div>

      {entries.length > 0 && (
        <div className="entry-actions">
          <button
            onClick={handleAnalyze}
            disabled={analyzing || entries.length === 0}
            className="btn-analyze"
          >
            {analyzing ? (
              <>
                <div className="spinner-small"></div>
                Analyzing...
              </>
            ) : (
              <>
                Analyze Results
                <ChevronRight size={18} />
              </>
            )}
          </button>
          <p className="hint-text">
            💡 You can enter 1-3 biomarkers per month for free. Upgrade to Premium for unlimited entries.
          </p>
        </div>
      )}
    </div>
  )
}
