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
    <form onSubmit={handleSubmit} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
      <h3 style={{ margin: '0 0 10px', color: '#fff' }}>Questionnaire Review</h3>
      <p style={{ margin: '0 0 10px', color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>Submit validated questionnaire responses to continue lifecycle pipeline.</p>
      <input value={questionnaireId} onChange={(e) => setQuestionnaireId(e.target.value)} placeholder="Questionnaire ID" style={inputStyle} />
      <textarea value={responsesJson} onChange={(e) => setResponsesJson(e.target.value)} style={{ ...inputStyle, marginTop: 8, minHeight: 100, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }} />
      {error ? <p style={{ margin: '8px 0 0', color: '#ff9c9c' }}>{error}</p> : null}
      <button disabled={loading} type="submit" style={{ marginTop: 8, border: 'none', background: '#1d9e75', color: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>
        {loading ? 'Submitting...' : 'Submit Questionnaire'}
      </button>
    </form>
  )
}

const inputStyle = {
  width: '100%',
  background: 'rgba(0,0,0,0.25)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 8,
  padding: '8px 10px',
}
