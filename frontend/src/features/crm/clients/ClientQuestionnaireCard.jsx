import { useState } from 'react'

export default function ClientQuestionnaireCard({ clientId, onSubmit, loading }) {
  const [questionnaireId, setQuestionnaireId] = useState('')
  const [responsesJson, setResponsesJson] = useState('{\n  "q1": "Feeling better",\n  "q2": 8\n}')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!questionnaireId) {
      setError('Questionnaire ID is required')
      return
    }

    let responses
    try {
      responses = JSON.parse(responsesJson)
    } catch {
      setError('Responses must be valid JSON')
      return
    }

    await onSubmit({
      client_id: clientId,
      questionnaire_id: questionnaireId,
      responses,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="vtl-card rounded-2xl p-4">
      <h3 className="mb-2 mt-0 text-lg font-semibold text-slate-100">Questionnaire Review</h3>
      <p className="mb-3 text-sm text-slate-400">Submit validated questionnaire responses to continue lifecycle pipeline.</p>
      <input value={questionnaireId} onChange={(e) => setQuestionnaireId(e.target.value)} placeholder="Questionnaire ID" className={inputClassName} />
      <textarea value={responsesJson} onChange={(e) => setResponsesJson(e.target.value)} className={`${inputClassName} mt-2 min-h-[100px] font-mono text-xs`} />
      {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
      <button disabled={loading} type="submit" className="vtl-button-primary mt-3 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60">
        {loading ? 'Submitting...' : 'Submit Questionnaire'}
      </button>
    </form>
  )
}

const inputClassName = 'w-full rounded-xl border border-slate-600 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40'
