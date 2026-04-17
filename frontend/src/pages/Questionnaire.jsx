import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../lib/api.js'
import toast from 'react-hot-toast'
import { trackFunnelEvent } from '../lib/funnel.js'

const DIMENSION_LABELS = {
  energy: 'Daytime Energy',
  sleep: 'Sleep Quality',
  stress: 'Stress Level',
  digestion: 'Digestion',
  cognition: 'Focus & Clarity',
  recovery: 'Recovery',
  mood: 'Mood Stability',
  metabolic: 'Metabolic Health',
  inflammation: 'Inflammation',
  behavior: 'Healthy Habits',
}

function ScoreBar({ label, value }) {
  const color = value >= 70 ? '#10b981' : value >= 45 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13, color: '#475569' }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value?.toFixed(0) ?? '—'}</span>
      </div>
      <div style={{ height: 6, borderRadius: 10, background: 'rgba(15,23,42,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(value ?? 0, 100)}%`, height: '100%', background: color, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

const s = {
  wrap: {
    minHeight: '100vh',
    background: '#f8fafc',
    color: '#0f172a',
    fontFamily: 'system-ui, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
  },
  card: {
    width: '100%',
    maxWidth: 720,
    background: '#ffffff',
    border: '1px solid rgba(15,23,42,0.08)',
    borderRadius: 24,
    padding: '34px 30px',
    boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
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
  const [results, setResults] = useState(null)  // { completion_score, dimension_scores, llm_summary }

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
        const completeResp = await api.post('/questionnaire/complete', { mark_onboarding_complete: true })
        trackFunnelEvent('funnel_questionnaire_completed', 'User completed adaptive questionnaire', {
          answered_count: Number(data?.answered_count || 0),
        }, { oncePerSession: true })
        const completedSession = completeResp?.data?.session || {}
        setResults({
          completion_score: completedSession.completion_score ?? null,
          dimension_scores: completedSession.dimension_scores ?? {},
          llm_summary: completedSession.llm_summary ?? null,
        })
        toast.success('Questionnaire completed!')
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
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>Questionnaire unavailable</div>
          <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>{error}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={loadSession} style={{ background: '#10b981', border: 'none', color: '#fff', borderRadius: 10, padding: '10px 16px', cursor: 'pointer' }}>Retry</button>
            <button onClick={() => navigate('/dashboard')} style={{ background: '#f1f5f9', border: '1px solid rgba(15,23,42,0.1)', color: '#475569', borderRadius: 10, padding: '10px 16px', cursor: 'pointer' }}>Back to dashboard</button>
          </div>
        </div>
      </div>
    )
  }

  if (!nextQuestion && !results) {
    return (
      <div style={s.wrap}>
        <div style={s.card}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>No pending questions</div>
          <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>You are all set for now.</div>
          <button onClick={() => navigate('/dashboard')} style={{ background: '#10b981', border: 'none', color: '#fff', borderRadius: 10, padding: '10px 16px', cursor: 'pointer' }}>Continue to dashboard</button>
        </div>
      </div>
    )
  }

  if (results) {
    const score = results.completion_score
    const scoreColor = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444'
    const dims = results.dimension_scores || {}
    return (
      <div style={s.wrap}>
        <motion.div style={s.card} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>Assessment Complete</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: scoreColor, marginBottom: 2 }}>
              {score != null ? `${score.toFixed(0)}/100` : '—'}
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>Overall Health Score</div>
          </div>

          {results.llm_summary && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 16px', marginBottom: 20, fontSize: 14, color: '#166534', lineHeight: 1.6 }}>
              {results.llm_summary}
            </div>
          )}

          {Object.keys(dims).length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 12 }}>Dimension Breakdown</div>
              {Object.entries(dims)
                .sort(([, a], [, b]) => b - a)
                .map(([dim, val]) => (
                  <ScoreBar key={dim} label={DIMENSION_LABELS[dim] || dim} value={val} />
                ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => navigate('/dashboard', { replace: true })}
              style={{ flex: 1, background: '#10b981', border: 'none', color: '#fff', borderRadius: 10, padding: '12px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              View My Dashboard
            </button>
            <button
              onClick={() => navigate('/insights')}
              style={{ flex: 1, background: '#f1f5f9', border: '1px solid rgba(15,23,42,0.1)', color: '#475569', borderRadius: 10, padding: '12px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
            >
              See Insights
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      <motion.div style={s.card} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Adaptive Questionnaire</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Question {answeredCount + 1} of {totalCount || '?'}</div>
          </div>
          <div style={{ minWidth: 120, textAlign: 'right', fontSize: 13, color: '#1d9e75', fontWeight: 700 }}>{progressPct}% complete</div>
        </div>

        <div style={{ height: 6, borderRadius: 10, background: 'rgba(15,23,42,0.08)', overflow: 'hidden', marginBottom: 22 }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: '#10b981' }} />
        </div>

        <div style={{ fontSize: 21, lineHeight: 1.4, fontWeight: 700, marginBottom: 22, color: '#0f172a' }}>
          {nextQuestion.text}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>Rate from 1 (very poor) to 10 (excellent)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range"
              min={1}
              max={10}
              value={answerValue}
              onChange={(e) => setAnswerValue(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#1d9e75' }}
            />
            <div style={{ width: 46, textAlign: 'right', fontSize: 18, fontWeight: 700, color: '#10b981' }}>{answerValue}/10</div>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>Optional context</div>
          <textarea
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="Add details that can help personalize your plan"
            style={{
              width: '100%',
              minHeight: 88,
              resize: 'vertical',
              background: '#f8fafc',
              border: '1px solid rgba(15,23,42,0.12)',
              borderRadius: 10,
              padding: '10px 12px',
              color: '#0f172a',
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
              background: '#10b981',
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
              background: '#f1f5f9',
              border: '1px solid rgba(15,23,42,0.1)',
              color: '#475569',
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
