import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, ChevronLeft, CheckCircle, User, MapPin, AlertTriangle } from 'lucide-react'
import api from '../lib/api.js'
import toast from 'react-hot-toast'

const GOAL_OPTIONS = [
  { id: 'energy', label: 'Improve energy' },
  { id: 'sleep', label: 'Better sleep' },
  { id: 'weight', label: 'Weight management' },
  { id: 'immunity', label: 'Boost immunity' },
  { id: 'hormones', label: 'Hormonal balance' },
  { id: 'gut', label: 'Gut health' },
  { id: 'mental', label: 'Mental clarity' },
  { id: 'longevity', label: 'Longevity & prevention' },
]

const s = {
  wrap: { minHeight: '100vh', background: '#080808', color: '#fff', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' },
  card: { width: '100%', maxWidth: 560, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: '40px 36px' },
  title: { fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 6 },
  sub: { fontSize: 15, color: 'rgba(255,255,255,0.45)', marginBottom: 32 },
  label: { display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 8, fontWeight: 500, letterSpacing: '0.03em' },
  input: { width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' },
  select: { width: '100%', background: '#1a1a1a', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' },
  btnPrimary: { width: '100%', padding: '14px', background: '#1d9e75', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer', marginTop: 24 },
  btnSec: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 14, marginTop: 12 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  goalChip: (active) => ({
    padding: '10px 14px', borderRadius: 10, border: `0.5px solid ${active ? '#1d9e75' : 'rgba(255,255,255,0.1)'}`,
    background: active ? 'rgba(29,158,117,0.15)' : 'rgba(255,255,255,0.03)',
    color: active ? '#1d9e75' : 'rgba(255,255,255,0.65)', cursor: 'pointer', fontSize: 14, fontWeight: 500, transition: 'all 0.15s',
  }),
  progress: { display: 'flex', gap: 6, marginBottom: 32 },
  dot: (active, done) => ({
    height: 4, flex: 1, borderRadius: 2,
    background: done ? '#1d9e75' : active ? 'rgba(29,158,117,0.6)' : 'rgba(255,255,255,0.1)',
    transition: 'background 0.3s',
  }),
}

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const [profile, setProfile] = useState({ height_cm: '', weight_kg: '', goals: [], current_supplements: '', current_medications: '', prior_diagnoses: '' })
  const [location, setLocation] = useState({ city: '', state: '', country: '', district: '' })
  const [complaints, setComplaints] = useState([{ complaint: '', duration_description: '', tried_interventions: '' }])

  useEffect(() => {
    api.get('/profile').then(r => {
      const p = r.data?.profile || {}
      setProfile(prev => ({
        ...prev,
        height_cm: p.height_cm || '',
        weight_kg: p.weight_kg || '',
        goals: p.goals || [],
        current_supplements: (p.current_supplements || []).join(', '),
        current_medications: (p.current_medications || []).join(', '),
        prior_diagnoses: p.prior_diagnoses || '',
      }))
      const loc = r.data?.location || {}
      setLocation({ city: loc.city || '', state: loc.state || '', country: loc.country || '', district: loc.district || '' })
    }).catch(() => {})
  }, [])

  const toggleGoal = (id) => setProfile(prev => ({
    ...prev,
    goals: prev.goals.includes(id) ? prev.goals.filter(g => g !== id) : [...prev.goals, id],
  }))

  const updateComplaint = (i, field, val) => setComplaints(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c))
  const addComplaint = () => setComplaints(prev => [...prev, { complaint: '', duration_description: '', tried_interventions: '' }])

  const saveAll = async () => {
    setSaving(true)
    try {
      const profilePayload = {
        height_cm: profile.height_cm ? Number(profile.height_cm) : undefined,
        weight_kg: profile.weight_kg ? Number(profile.weight_kg) : undefined,
        goals: profile.goals,
        current_supplements: profile.current_supplements ? profile.current_supplements.split(',').map(s => s.trim()).filter(Boolean) : [],
        current_medications: profile.current_medications ? profile.current_medications.split(',').map(s => s.trim()).filter(Boolean) : [],
        prior_diagnoses: profile.prior_diagnoses || undefined,
        onboarding_complete: true,
      }
      await api.patch('/profile', profilePayload)

      if (location.city || location.country) {
        await api.patch('/profile/location', location)
      }

      for (const c of complaints) {
        if (c.complaint.trim()) {
          await api.post('/complaints', c)
        }
      }

      toast.success('Profile saved!')
      navigate('/dashboard')
    } catch (e) {
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const steps = ['Basics', 'Goals', 'Location', 'Complaints']
  const TOTAL = steps.length

  return (
    <div style={s.wrap}>
      <motion.div style={s.card} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        {/* Progress bar */}
        <div style={s.progress}>
          {steps.map((_, i) => <div key={i} style={s.dot(i === step, i < step)} />)}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 24, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Step {step + 1} of {TOTAL} — {steps[step]}
        </div>

        {/* Step 0: Basics */}
        {step === 0 && (
          <motion.div key="basics" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={s.title}><User size={22} style={{ display: 'inline', marginRight: 10, color: '#1d9e75' }} />Your basics</div>
            <div style={s.sub}>Help us personalize your health guidance.</div>
            <div style={s.row}>
              <label>
                <span style={s.label}>Height (cm)</span>
                <input style={s.input} type="number" placeholder="175" value={profile.height_cm} onChange={e => setProfile(p => ({ ...p, height_cm: e.target.value }))} />
              </label>
              <label>
                <span style={s.label}>Weight (kg)</span>
                <input style={s.input} type="number" placeholder="72" value={profile.weight_kg} onChange={e => setProfile(p => ({ ...p, weight_kg: e.target.value }))} />
              </label>
            </div>
            <div style={{ marginTop: 16 }}>
              <span style={s.label}>Current supplements (comma-separated)</span>
              <input style={s.input} placeholder="Vitamin D3, Magnesium, Omega-3" value={profile.current_supplements} onChange={e => setProfile(p => ({ ...p, current_supplements: e.target.value }))} />
            </div>
            <div style={{ marginTop: 16 }}>
              <span style={s.label}>Current medications (comma-separated, optional)</span>
              <input style={s.input} placeholder="Leave blank if none" value={profile.current_medications} onChange={e => setProfile(p => ({ ...p, current_medications: e.target.value }))} />
            </div>
          </motion.div>
        )}

        {/* Step 1: Goals */}
        {step === 1 && (
          <motion.div key="goals" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={s.title}>Your health goals</div>
            <div style={s.sub}>Select everything that applies. We'll personalize your guidance around these.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {GOAL_OPTIONS.map(g => (
                <button key={g.id} style={s.goalChip(profile.goals.includes(g.id))} onClick={() => toggleGoal(g.id)}>
                  {profile.goals.includes(g.id) && '✓ '}{g.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Step 2: Location */}
        {step === 2 && (
          <motion.div key="location" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={s.title}><MapPin size={22} style={{ display: 'inline', marginRight: 10, color: '#1d9e75' }} />Your location</div>
            <div style={s.sub}>Used for future physician referral support and local care assistance.</div>
            <div style={s.row}>
              <label>
                <span style={s.label}>City</span>
                <input style={s.input} placeholder="Kyiv" value={location.city} onChange={e => setLocation(l => ({ ...l, city: e.target.value }))} />
              </label>
              <label>
                <span style={s.label}>State / Region</span>
                <input style={s.input} placeholder="Kyiv Oblast" value={location.state} onChange={e => setLocation(l => ({ ...l, state: e.target.value }))} />
              </label>
            </div>
            <div style={{ marginTop: 16 }}>
              <span style={s.label}>Country</span>
              <input style={s.input} placeholder="Ukraine" value={location.country} onChange={e => setLocation(l => ({ ...l, country: e.target.value }))} />
            </div>
            <div style={{ marginTop: 16 }}>
              <span style={s.label}>District / Area (optional)</span>
              <input style={s.input} placeholder="Pechersk" value={location.district} onChange={e => setLocation(l => ({ ...l, district: e.target.value }))} />
            </div>
          </motion.div>
        )}

        {/* Step 3: Complaints */}
        {step === 3 && (
          <motion.div key="complaints" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={s.title}><AlertTriangle size={22} style={{ display: 'inline', marginRight: 10, color: '#f5a623' }} />Recurring complaints</div>
            <div style={s.sub}>What has been bothering you? We'll factor this into your analysis.</div>
            {complaints.map((c, i) => (
              <div key={i} style={{ marginBottom: 20, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
                <span style={s.label}>Complaint {i + 1}</span>
                <input style={{ ...s.input, marginBottom: 10 }} placeholder="e.g. Persistent fatigue" value={c.complaint} onChange={e => updateComplaint(i, 'complaint', e.target.value)} />
                <span style={s.label}>How long has this been present?</span>
                <input style={{ ...s.input, marginBottom: 10 }} placeholder="e.g. 3 months" value={c.duration_description} onChange={e => updateComplaint(i, 'duration_description', e.target.value)} />
                <span style={s.label}>What have you tried so far?</span>
                <input style={s.input} placeholder="e.g. Magnesium, better sleep schedule" value={c.tried_interventions} onChange={e => updateComplaint(i, 'tried_interventions', e.target.value)} />
              </div>
            ))}
            <button style={{ ...s.btnSec, marginTop: 4 }} onClick={addComplaint}>+ Add another complaint</button>
          </motion.div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 12, marginTop: 28, alignItems: 'center' }}>
          {step > 0 && (
            <button style={{ ...s.btnPrimary, flex: 0.4, background: 'rgba(255,255,255,0.05)', marginTop: 0 }} onClick={() => setStep(s => s - 1)}>
              <ChevronLeft size={18} style={{ display: 'inline' }} /> Back
            </button>
          )}
          {step < TOTAL - 1 ? (
            <button style={{ ...s.btnPrimary, flex: 1, marginTop: 0 }} onClick={() => setStep(s => s + 1)}>
              Next <ChevronRight size={18} style={{ display: 'inline' }} />
            </button>
          ) : (
            <button style={{ ...s.btnPrimary, flex: 1, marginTop: 0, opacity: saving ? 0.6 : 1 }} onClick={saveAll} disabled={saving}>
              {saving ? 'Saving…' : <><CheckCircle size={18} style={{ display: 'inline', marginRight: 6 }} />Complete Profile</>}
            </button>
          )}
        </div>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button style={s.btnSec} onClick={() => navigate('/dashboard')}>Skip for now</button>
        </div>
      </motion.div>
    </div>
  )
}
