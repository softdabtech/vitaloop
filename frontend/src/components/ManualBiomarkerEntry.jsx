import { useState, useEffect } from 'react'
import { ChevronRight, Trash2, Plus } from 'lucide-react'
import api from '../lib/api.js'
import { isUkrainianLocale } from '../lib/locale.js'
import '../styles/manual-entry.css'

const COPY = {
  en: {
    loadFailed: 'Failed to load biomarker options. Please try refreshing.',
    selectBiomarkerError: 'Select a biomarker',
    validNumberError: 'Enter a valid number',
    negativeError: 'Value cannot be negative',
    tooHighError: 'Value seems too high',
    selectUnitError: 'Select a unit',
    addAtLeastOne: 'Add at least one biomarker',
    fixErrors: 'Please fix the errors above',
    analysisFailed: 'Analysis failed. Please try again.',
    pdfQuota: 'You\'ve already uploaded a lab PDF. Free plan allows 1 entry via PDF OR manual. Upgrade to Premium for unlimited entries.',
    manualQuota: 'Your free biomarker entry quota is full. Upgrade to Premium for unlimited entries.',
    subscriptionRequired: 'Subscription required for this action. Upgrade to Premium.',
    validationPrefix: 'Validation error',
    loading: 'Loading biomarker database...',
    emptyOptions: 'Unable to load biomarker options. Please try uploading a PDF instead.',
    title: '📊 Enter Lab Results Manually',
    subtitle: 'Don\'t have a PDF? Enter your biomarker values below to get personalized insights.',
    empty: 'Click "Add Biomarker" to start entering your lab results',
    biomarker: 'Biomarker',
    selectBiomarker: 'Select biomarker...',
    value: 'Value',
    valuePlaceholder: 'e.g., 14.5',
    unit: 'Unit',
    selectUnit: 'Unit...',
    removeTitle: 'Remove this entry',
    standardUnit: 'Standard unit',
    converting: 'Auto-converting to standard unit',
    addAnother: 'Add Another',
    addFirst: 'Add First Biomarker',
    analyzing: 'Analyzing...',
    analyze: 'Analyze Results',
    hint: '💡 You can enter 1-3 biomarkers per month for free. Upgrade to Premium for unlimited entries.',
  },
  uk: {
    loadFailed: 'Не вдалося завантажити список показників. Оновіть сторінку й спробуйте ще раз.',
    selectBiomarkerError: 'Оберіть показник',
    validNumberError: 'Введіть коректне число',
    negativeError: 'Значення не може бути відʼємним',
    tooHighError: 'Значення виглядає занадто високим',
    selectUnitError: 'Оберіть одиницю',
    addAtLeastOne: 'Додайте хоча б один показник',
    fixErrors: 'Виправте помилки вище',
    analysisFailed: 'Аналіз не вдався. Спробуйте ще раз.',
    pdfQuota: 'Ви вже завантажили PDF з аналізами. Безкоштовний план дозволяє 1 введення: PDF або вручну. Premium відкриває необмежені введення.',
    manualQuota: 'Ліміт безкоштовного ручного введення вичерпано. Premium відкриває необмежені введення.',
    subscriptionRequired: 'Для цієї дії потрібен Premium.',
    validationPrefix: 'Помилка валідації',
    loading: 'Завантажуємо базу показників...',
    emptyOptions: 'Не вдалося завантажити список показників. Спробуйте завантажити PDF.',
    title: '📊 Ввести аналізи вручну',
    subtitle: 'Немає PDF? Внесіть значення показників вручну, щоб отримати структурований розбір.',
    empty: 'Натисніть «Додати показник», щоб почати введення результатів',
    biomarker: 'Показник',
    selectBiomarker: 'Оберіть показник...',
    value: 'Значення',
    valuePlaceholder: 'наприклад, 14.5',
    unit: 'Одиниця',
    selectUnit: 'Одиниця...',
    removeTitle: 'Видалити цей показник',
    standardUnit: 'Стандартна одиниця',
    converting: 'Автоматично приводимо до стандартної одиниці',
    addAnother: 'Додати ще',
    addFirst: 'Додати показник',
    analyzing: 'Аналізуємо...',
    analyze: 'Аналізувати результати',
    hint: '💡 У безкоштовному плані доступне одне введення аналізів. Premium відкриває необмежені введення.',
  },
}

function triggerPaywall(detail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('paywall:trigger', { detail }))
  }
}

export default function ManualBiomarkerEntry({ onAnalyze, onLoading }) {
  const isUk = isUkrainianLocale()
  const copy = isUk ? COPY.uk : COPY.en
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
        setGlobalError(copy.loadFailed)
        setLoading(false)
      }
    }
    fetchBiomarkers()
  }, [copy.loadFailed])

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
        entryErrors.push(copy.selectBiomarkerError)
        hasErrors = true
      }

      if (!entry.value || entry.value === '' || isNaN(parseFloat(entry.value))) {
        entryErrors.push(copy.validNumberError)
        hasErrors = true
      } else if (parseFloat(entry.value) < 0) {
        entryErrors.push(copy.negativeError)
        hasErrors = true
      } else if (parseFloat(entry.value) > 10000) {
        entryErrors.push(copy.tooHighError)
        hasErrors = true
      }

      if (!entry.unit) {
        entryErrors.push(copy.selectUnitError)
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
      setGlobalError(copy.addAtLeastOne)
      return
    }

    if (!validateEntries()) {
      setGlobalError(copy.fixErrors)
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

      // Handle specific error codes
      const errorData = err.response?.data || {}
      const innerError = typeof errorData?.detail === 'object' ? errorData.detail : errorData
      const errorCode = innerError?.code || errorData?.code
      const errorDetail = typeof innerError?.detail === 'string'
        ? innerError.detail
        : typeof errorData?.detail === 'string'
          ? errorData.detail
          : null
      const firstValidationMessage = Array.isArray(errorData?.errors) && errorData.errors.length > 0
        ? errorData.errors[0]?.msg
        : null

      let message = firstValidationMessage || errorDetail || copy.analysisFailed

      if (err.response?.status === 402 && errorCode === 'BIOMARKER_QUOTA_EXCEEDED') {
        const usedBy = innerError?.used_by || errorData?.used_by
        if (usedBy === 'pdf') {
          message = copy.pdfQuota
        } else {
          message = errorDetail || copy.manualQuota
        }
        // Trigger paywall
        triggerPaywall({ reason: 'BIOMARKER_QUOTA_EXCEEDED', used_by: usedBy })
      } else if (err.response?.status === 402) {
        message = errorDetail || copy.subscriptionRequired
        triggerPaywall({ reason: 'SUBSCRIPTION_REQUIRED' })
      } else if (err.response?.status === 422 && !errorDetail && firstValidationMessage) {
        message = `${copy.validationPrefix}: ${firstValidationMessage}`
      }

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
        <p>{copy.loading}</p>
      </div>
    )
  }

  if (!biomarkerOptions || biomarkerOptions.length === 0) {
    return (
      <div className="manual-entry-error">
        <p>{copy.emptyOptions}</p>
      </div>
    )
  }

  return (
    <div className="manual-entry-container">
      <div className="manual-entry-header">
        <h3>{copy.title}</h3>
        <p className="subtitle">{copy.subtitle}</p>
      </div>

      {globalError && (
        <div className="alert alert-error">
          <p>{globalError}</p>
        </div>
      )}

      <div className="entries-section">
        {entries.length === 0 && (
          <div className="empty-state">
            <p>{copy.empty}</p>
          </div>
        )}

        {entries.map((entry, _idx) => {
          const selectedBiomarker = biomarkerOptions.find(b => b.id === entry.biomarker_id)
          const units = getUnitsForBiomarker(entry.biomarker_id)
          const entryErrors = errors[entry.id] || []

          return (
            <div key={entry.id} className={`entry-card ${entryErrors.length > 0 ? 'has-error' : ''}`}>
              <div className="entry-fields">
                {/* Biomarker Dropdown */}
                <div className="field biomarker-field">
                  <label>{copy.biomarker}</label>
                  <select
                    value={entry.biomarker_id}
                    onChange={(e) => updateEntry(entry.id, 'biomarker_id', e.target.value)}
                    className={entryErrors.length > 0 ? 'has-error' : ''}
                  >
                    <option value="">{copy.selectBiomarker}</option>
                    {biomarkerOptions.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Value Input */}
                <div className="field value-field">
                  <label>{copy.value}</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={copy.valuePlaceholder}
                    value={entry.value}
                    onChange={(e) => updateEntry(entry.id, 'value', e.target.value)}
                    className={entryErrors.length > 0 ? 'has-error' : ''}
                  />
                </div>

                {/* Unit Dropdown */}
                <div className="field unit-field">
                  <label>{copy.unit}</label>
                  <select
                    value={entry.unit}
                    onChange={(e) => updateEntry(entry.id, 'unit', e.target.value)}
                    disabled={!entry.biomarker_id}
                    className={entryErrors.length > 0 ? 'has-error' : ''}
                  >
                    <option value="">{copy.selectUnit}</option>
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
                  title={copy.removeTitle}
                >
                  <Trash2 size={18} />
                </button>
              </div>

              {/* Show biomarker name once selected */}
              {selectedBiomarker && (
                <div className="entry-info">
                  <span className="badge">{selectedBiomarker.category}</span>
                  {selectedBiomarker.default_unit === entry.unit && (
                    <span className="hint">{copy.standardUnit}</span>
                  )}
                  {selectedBiomarker.default_unit !== entry.unit && entry.unit && (
                    <span className="hint converting">{copy.converting}</span>
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
            {copy.addAnother}
          </button>
        )}

        {entries.length === 0 && (
          <button onClick={addEntry} className="btn-add-entry btn-primary">
            <Plus size={18} />
            {copy.addFirst}
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
                {copy.analyzing}
              </>
            ) : (
              <>
                {copy.analyze}
                <ChevronRight size={18} />
              </>
            )}
          </button>
          <p className="hint-text">
            {copy.hint}
          </p>
        </div>
      )}
    </div>
  )
}
