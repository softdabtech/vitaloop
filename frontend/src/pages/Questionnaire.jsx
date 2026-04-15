import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../lib/api.js'
import toast from 'react-hot-toast'
import { trackFunnelEvent } from '../lib/funnel.js'

const s = {
  wrap: {
    minHeight: '100vh',
    background: '#080808',
    color: '#fff',
    fontFamily: 'system-ui, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
  },
  card: {
    width: '100%',
    maxWidth: 720,
    background: 'rgba(255,255,255,0.04)',
    border: '0.5px solid rgba(255,255,255,0.1)',
    borderRadius: 24,
    padding: '34px 30px',
  },
}

export default function Questionnaire() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [session, setSession] = useState(null)
  const [nextQuestion, setNextQuestion] = useState(null)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [remainingCount, setRemainingCount] = useState(0)
  const [answerValue, setAnswerValue] = useState(5)
  const [answerText, setAnswerText] = useState('')

  const totalCount = useMemo(() => answeredCount + remainingCount, [answeredCount, remainingCount])
  const progressPct = useMemo(() => {
    if (!totalCount) return 0
    return Math.round((answeredCount / totalCount) * 100)
  }, [answeredCount, totalCount])

  async function loadSession() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/questionnaire/session')
      setSession(data?.session || null)
      setNextQuestion(data?.next_question || null)
      setAnsweredCount(Number(data?.answered_count || 0))
      setRemainingCount(Number(data?.remaining_count || 0))
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Failed to load questionnaire.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSession()
  }, [])

  async function submitAnswer() {
    if (!nextQuestion?.id) return

    setSaving(true)
    try {
      const { data } = await api.post('/questionnaire/answer', {
        question_id: nextQuestion.id,
        answer_value: Number(answerValue),
        answer_text: answerText || null,
      })

      setNextQuestion(data?.next_question || null)
      setAnsweredCount(Number(data?.answered_count || answeredCount))
      setRemainingCount(Number(data?.remaining_count || remainingCount))
      setAnswerValue(5)
      setAnswerText('')

      if (data?.completed) {
        await api.post('/questionnaire/complete', { mark_onboarding_complete: true })
        trackFunnelEvent('funnel_questionnaire_completed', 'User completed adaptive questionnaire', {
          answered_count: Number(data?.answered_count || 0),
        }, { oncePerSession: true })
        toast.success('Questionnaire completed!')
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save answer.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={s.wrap}>
        <div style={s.card}>Loading questionnaire...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={s.wrap}>
        <div style={s.card}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Questionnaire unavailable</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', marginBottom: 16 }}>{error}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={loadSession} style={{ background: '#1d9e75', border: 'none', color: '#fff', borderRadius: 10, padding: '10px 16px', cursor: 'pointer' }}>Retry</button>
            <button onClick={() => navigate('/dashboard')} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', borderRadius: 10, padding: '10px 16px', cursor: 'pointer' }}>Back to dashboard</button>
          </div>
        </div>
      </div>
    )
  }

  if (!nextQuestion) {
    return (
      <div style={s.wrap}>
        <div style={s.card}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No pending questions</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', marginBottom: 16 }}>You are all set for now.</div>
          <button onClick={() => navigate('/dashboard')} style={{ background: '#1d9e75', border: 'none', color: '#fff', borderRadius: 10, padding: '10px 16px', cursor: 'pointer' }}>Continue to dashboard</button>
        </div>
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      <motion.div style={s.card} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>Adaptive Questionnaire</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>Question {answeredCount + 1} of {totalCount || '?'}</div>
          </div>
          <div style={{ minWidth: 120, textAlign: 'right', fontSize: 13, color: '#1d9e75', fontWeight: 700 }}>{progressPct}% complete</div>
        </div>

        <div style={{ height: 6, borderRadius: 10, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 22 }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: '#1d9e75' }} />
        </div>

        <div style={{ fontSize: 21, lineHeight: 1.4, fontWeight: 700, marginBottom: 22 }}>
          {nextQuestion.text}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>Rate from 1 (very poor) to 10 (excellent)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range"
              min={1}
              max={10}
              value={answerValue}
              onChange={(e) => setAnswerValue(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#1d9e75' }}
            />
            <div style={{ width: 46, textAlign: 'right', fontSize: 18, fontWeight: 700, color: '#1d9e75' }}>{answerValue}/10</div>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>Optional context</div>
          <textarea
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="Add details that can help personalize your plan"
            style={{
              width: '100%',
              minHeight: 88,
              resize: 'vertical',
              background: 'rgba(255,255,255,0.06)',
              border: '0.5px solid rgba(255,255,255,0.15)',
              borderRadius: 10,
              padding: '10px 12px',
              color: '#fff',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={submitAnswer}
            disabled={saving}
            style={{
              background: '#1d9e75',
              border: 'none',
              color: '#fff',
              borderRadius: 10,
              padding: '11px 18px',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              opacity: saving ? 0.65 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Next Question'}
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              color: '#fff',
              borderRadius: 10,
              padding: '11px 18px',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Pause for now
          </button>
        </div>
      </motion.div>
    </div>
  )
}
