import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../lib/api.js'

export default function RedFlagBanner() {
  const navigate = useNavigate()
  const [flags, setFlags] = useState([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    api.get('/red-flags').then(r => {
      const active = (r.data || []).filter(f => !f.acknowledged)
      setFlags(active)
    }).catch(() => {})
  }, [])

  const acknowledge = async (id) => {
    setFlags(prev => prev.filter(f => f.id !== id))
    await api.post(`/red-flags/${id}/acknowledge`).catch(() => {})
  }

  if (dismissed || flags.length === 0) return null

  const top = flags[0]
  const isCritical = top.severity === 'critical'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        style={{
          background: isCritical ? 'rgba(239,68,68,0.12)' : 'rgba(245,166,35,0.12)',
          border: `0.5px solid ${isCritical ? 'rgba(239,68,68,0.4)' : 'rgba(245,166,35,0.4)'}`,
          borderRadius: 14,
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
        }}
      >
        <AlertTriangle size={20} style={{ color: isCritical ? '#ef4444' : '#f5a623', flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            {isCritical ? 'Important Health Alert' : 'Health Notice'} {flags.length > 1 ? `(${flags.length} active)` : ''}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.55, marginBottom: 10 }}>
            {top.summary} — Your recent health inputs may require medical follow-up. Please consult a licensed physician or therapist if symptoms persist or worsen.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => acknowledge(top.id)}
              style={{ padding: '7px 14px', borderRadius: 8, background: isCritical ? 'rgba(239,68,68,0.2)' : 'rgba(245,166,35,0.2)', border: 'none', color: isCritical ? '#ef4444' : '#f5a623', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              I've seen this
            </button>
            <button
              onClick={() => navigate('/check-ins')}
              style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer' }}
            >
              Log this week's check-in
            </button>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', padding: 0 }}>
          <X size={16} />
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
