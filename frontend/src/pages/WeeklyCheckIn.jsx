import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, CheckCircle } from 'lucide-react'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import api from '../lib/api.js'
import toast from 'react-hot-toast'

const s = {
  wrap: { minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '24px 16px' },
  card: { width: '100%', maxWidth: 560, background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 24, padding: '40px 36px', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' },
  title: { fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 6 },
  sub: { fontSize: 14, color: '#64748b', marginBottom: 32 },
  label: { display: 'block', fontSize: 13, color: '#475569', marginBottom: 8, fontWeight: 500, letterSpacing: '0.03em' },
  input: { width: '100%', background: '#f8fafc', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 10, padding: '12px 14px', color: '#0f172a', fontSize: 15, outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', background: '#f8fafc', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 10, padding: '12px 14px', color: '#0f172a', fontSize: 14, outline: 'none', boxSizing: 'border-box', resize: 'vertical', minHeight: 80 },
  btn: { width: '100%', padding: '14px', background: '#10b981', borderRadius: 12, color: '#ffffff', fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer', marginTop: 28 },
  scoreRow: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 },
  scoreLabel: { fontSize: 14, color: '#475569', flex: '0 0 140px' },
  scoreVal: { fontSize: 16, fontWeight: 700, color: '#10b981', width: 24, textAlign: 'right' },
}

function getMonday(d = new Date()) {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d.setDate(diff))
  return mon.toISOString().split('T')[0]
}

export default function WeeklyCheckIn() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    week_start: getMonday(),
    energy_score: 5,
    sleep_quality: 5,
    mood_score: 5,
    protocol_adherence: 5,
    symptom_changes: '',
    new_complaints: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await api.post('/checkins', form)
      setDone(true)
      toast.success('Check-in submitted!')
    } catch (_error) {
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div style={s.wrap}>
        <div style={{ width: '100%', maxWidth: 760 }}>
          <CabinetPageHeader
            title="Weekly Check-In"
            subtitle="Record weekly adherence and symptom changes in under 2 minutes."
            helper="These answers are used to adjust recommendations and task priorities."
          />
          <motion.div style={{ ...s.card, textAlign: 'center' }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <CheckCircle size={56} style={{ color: '#1d9e75', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Check-in complete</div>
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 28 }}>Your weekly data has been recorded. We'll use it to personalize your guidance.</div>
            <button style={{ ...s.btn, marginTop: 0 }} onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
          </motion.div>
        </div>
      </div>
    )
  }

  const sliders = [
    { key: 'energy_score', label: 'Energy level', color: '#f59e0b' },
    { key: 'sleep_quality', label: 'Sleep quality', color: '#818cf8' },
    { key: 'mood_score', label: 'Mood', color: '#f472b6' },
    { key: 'protocol_adherence', label: 'Protocol adherence', color: '#1d9e75' },
  ]

  return (
    <div style={s.wrap}>
      <div style={{ width: '100%', maxWidth: 760 }}>
        <CabinetPageHeader
          title="Weekly Check-In"
          subtitle={`Week of ${form.week_start} - takes ~2 minutes`}
          helper="Concrete weekly signal check for adherence, symptoms, mood and recovery."
        />

        <motion.div style={s.card} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Heart size={22} style={{ color: '#f472b6' }} />
            <div style={s.title}>Weekly Check-In</div>
          </div>
          <div style={s.sub}>Update this week and submit.</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>
            This page records concrete weekly adherence and symptom changes that feed your protocol updates.
          </div>

        {/* Sliders */}
        {sliders.map(({ key, label, color }) => (
          <div key={key} style={{ marginBottom: 24 }}>
            <div style={s.scoreRow}>
              <span style={s.scoreLabel}>{label}</span>
              <input
                type="range" min={1} max={10} value={form[key]}
                onChange={e => set(key, Number(e.target.value))}
                style={{ flex: 1, accentColor: color }}
              />
              <span style={{ ...s.scoreVal, color }}>{form[key]}/10</span>
            </div>
          </div>
        ))}

        {/* Text fields */}
        <div style={{ marginTop: 8, marginBottom: 16 }}>
          <span style={s.label}>Any symptom changes this week?</span>
          <textarea style={s.textarea} placeholder="e.g. Better energy in the morning, headaches subsided..." value={form.symptom_changes} onChange={e => set('symptom_changes', e.target.value)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <span style={s.label}>New complaints or concerns?</span>
          <textarea style={s.textarea} placeholder="e.g. Started experiencing lower back pain..." value={form.new_complaints} onChange={e => set('new_complaints', e.target.value)} />
        </div>
        <div>
          <span style={s.label}>Anything else to note?</span>
          <textarea style={s.textarea} placeholder="Optional notes..." value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>

        <button style={{ ...s.btn, opacity: saving ? 0.6 : 1 }} onClick={handleSubmit} disabled={saving}>
          {saving ? 'Submitting…' : 'Submit Check-In'}
        </button>
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }} onClick={() => navigate('/dashboard')}>Cancel</button>
        </div>
        </motion.div>
      </div>
    </div>
  )
}
