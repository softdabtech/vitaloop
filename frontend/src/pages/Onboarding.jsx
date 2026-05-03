import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, ChevronLeft, CheckCircle, User, MapPin, AlertTriangle } from 'lucide-react'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import api from '../lib/api.js'
import { trackFunnelEvent } from '../lib/funnel.js'
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

const COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'Italy', 'Spain',
  'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark',
  'Finland', 'Poland', 'Czech Republic', 'Hungary', 'Slovakia', 'Slovenia', 'Croatia',
  'Russia', 'Ukraine', 'Belarus', 'Kazakhstan', 'Uzbekistan', 'Azerbaijan', 'Georgia',
  'Armenia', 'Moldova', 'Lithuania', 'Latvia', 'Estonia', 'Australia', 'New Zealand',
  'Japan', 'South Korea', 'China', 'India', 'Brazil', 'Mexico', 'Argentina', 'Chile',
  'Colombia', 'Peru', 'Venezuela', 'Ecuador', 'Uruguay', 'Paraguay', 'Bolivia'
]

const CITIES_BY_COUNTRY = {
  'United States': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte', 'San Francisco', 'Indianapolis', 'Seattle', 'Denver', 'Boston', 'El Paso', 'Nashville', 'Detroit', 'Oklahoma City', 'Portland', 'Las Vegas', 'Memphis', 'Louisville', 'Baltimore', 'Milwaukee', 'Albuquerque', 'Tucson', 'Fresno', 'Sacramento', 'Mesa', 'Kansas City', 'Atlanta', 'Long Beach', 'Colorado Springs', 'Raleigh', 'Miami', 'Virginia Beach', 'Omaha', 'Oakland', 'Minneapolis', 'Tulsa', 'Arlington', 'Tampa', 'New Orleans', 'Wichita'],
  'Canada': ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa', 'Winnipeg', 'Quebec City', 'Hamilton', 'Kitchener', 'London', 'Victoria', 'Halifax', 'Oshawa', 'Windsor', 'Saskatoon', 'Regina', 'St. John\'s', 'Kelowna', 'Barrie'],
  'United Kingdom': ['London', 'Birmingham', 'Manchester', 'Liverpool', 'Leeds', 'Sheffield', 'Bristol', 'Newcastle', 'Sunderland', 'Brighton', 'Cardiff', 'Edinburgh', 'Glasgow', 'Belfast', 'Leicester', 'Coventry', 'Bradford', 'Nottingham', 'Plymouth', 'Stoke-on-Trent'],
  'Ukraine': ['Kyiv', 'Kharkiv', 'Odesa', 'Dnipro', 'Donetsk', 'Zaporizhzhia', 'Lviv', 'Kryvyi Rih', 'Mykolaiv', 'Mariupol', 'Luhansk', 'Vinnytsia', 'Kherson', 'Poltava', 'Chernihiv', 'Cherkasy', 'Sumy', 'Zhytomyr', 'Khmelnytskyi', 'Rivne', 'Ivano-Frankivsk', 'Ternopil', 'Lutsk', 'Uzhhorod'],
  'Russia': ['Moscow', 'Saint Petersburg', 'Novosibirsk', 'Yekaterinburg', 'Nizhny Novgorod', 'Kazan', 'Chelyabinsk', 'Omsk', 'Samara', 'Rostov-on-Don', 'Ufa', 'Krasnoyarsk', 'Voronezh', 'Perm', 'Volgograd', 'Krasnodar', 'Saratov', 'Tyumen', 'Tolyatti', 'Izhevsk'],
  'Germany': ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig', 'Bremen', 'Dresden', 'Hanover', 'Nuremberg', 'Duisburg', 'Bochum', 'Wuppertal', 'Bielefeld', 'Bonn', 'Münster'],
  'France': ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille', 'Rennes', 'Reims', 'Le Havre', 'Saint-Étienne', 'Toulon', 'Grenoble', 'Dijon', 'Angers', 'Nîmes', 'Villeurbanne'],
  'Italy': ['Rome', 'Milan', 'Naples', 'Turin', 'Palermo', 'Genoa', 'Bologna', 'Florence', 'Bari', 'Catania', 'Venice', 'Verona', 'Messina', 'Padua', 'Trieste', 'Brescia', 'Parma', 'Prato', 'Modena', 'Reggio Calabria'],
  'Spain': ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Zaragoza', 'Málaga', 'Murcia', 'Palma', 'Las Palmas de Gran Canaria', 'Bilbao', 'Alicante', 'Córdoba', 'Valladolid', 'Vigo', 'Gijón', 'L\'Hospitalet de Llobregat', 'La Coruña', 'Granada', 'Elche', 'Oviedo'],
  'Netherlands': ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groningen', 'Almere', 'Breda', 'Nijmegen', 'Enschede', 'Haarlem', 'Arnhem', 'Zaanstad', 'Amersfoort', 'Apeldoorn', 'Den Haag', 'Haarlemmermeer', 'Zoetermeer', 'Leiden'],
  'Australia': ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Canberra', 'Newcastle', 'Central Coast', 'Wollongong', 'Hobart', 'Geelong', 'Townsville', 'Cairns', 'Darwin', 'Toowoomba', 'Ballarat', 'Bendigo', 'Albury', 'Launceston'],
  'Japan': ['Tokyo', 'Yokohama', 'Osaka', 'Nagoya', 'Sapporo', 'Fukuoka', 'Kobe', 'Kawasaki', 'Saitama', 'Hiroshima', 'Sendai', 'Kitakyushu', 'Chiba', 'Sakai', 'Niigata', 'Hamamatsu', 'Okayama', 'Kumamoto', 'Sagamihara', 'Shizuoka'],
  'China': ['Shanghai', 'Beijing', 'Guangzhou', 'Shenzhen', 'Tianjin', 'Wuhan', 'Dongguan', 'Chengdu', 'Nanjing', 'Hangzhou', 'Foshan', 'Shenyang', 'Harbin', 'Qingdao', 'Dalian', 'Jinan', 'Zhengzhou', 'Changsha', 'Xiamen', 'Wuxi'],
  'India': ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Surat', 'Pune', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Pimpri-Chinchwad', 'Patna', 'Vadodara'],
  'Brazil': ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza', 'Belo Horizonte', 'Manaus', 'Curitiba', 'Recife', 'Porto Alegre', 'Belém', 'Goiânia', 'Guarulhos', 'Campinas', 'São Luís', 'São Gonçalo', 'Maceió', 'Duque de Caxias', 'Natal', 'Campo Grande'],
  'Mexico': ['Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Juárez', 'Torreón', 'Querétaro', 'Mérida', 'Mexicali', 'Aguascalientes', 'Hermosillo', 'Saltillo', 'Chihuahua', 'Culiacán', 'Morelia', 'Durango', 'Veracruz', 'Reynosa']
}

const COMMON_SYMPTOMS = [
  'Fatigue', 'Headache', 'Insomnia', 'Joint pain', 'Muscle pain', 'Digestive issues',
  'Brain fog', 'Anxiety', 'Depression', 'Hair loss', 'Skin issues', 'Weight gain',
  'Weight loss', 'Low energy', 'Mood swings', 'Memory problems', 'Concentration issues',
  'Sleep problems', 'Digestive discomfort', 'Allergies', 'Frequent illness', 'Chronic pain',
  'Hormonal imbalance', 'Thyroid issues', 'Blood sugar issues', 'Cholesterol concerns',
  'Blood pressure issues', 'Heart palpitations', 'Shortness of breath', 'Dizziness'
]

const s = {
  wrap: { minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '24px 16px' },
  card: { width: '100%', maxWidth: 560, background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 24, padding: window.innerWidth < 500 ? '24px 16px' : '40px 36px', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' },
  title: { fontSize: 26, fontWeight: 700, color: '#0f172a', marginBottom: 6 },
  sub: { fontSize: 15, color: '#64748b', marginBottom: 32 },
  label: { display: 'block', fontSize: 13, color: '#475569', marginBottom: 8, fontWeight: 500, letterSpacing: '0.03em' },
  input: { width: '100%', background: '#f8fafc', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 10, padding: '12px 14px', color: '#0f172a', fontSize: 15, outline: 'none', boxSizing: 'border-box', minHeight: '44px' },
  select: { width: '100%', background: '#f8fafc', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 10, padding: '12px 14px', color: '#0f172a', fontSize: 15, outline: 'none', boxSizing: 'border-box', minHeight: '44px' },
  dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, background: '#ffffff', border: '1px solid rgba(15,23,42,0.12)', borderTop: 'none', borderRadius: '0 0 10px 10px', maxHeight: '200px', overflowY: 'auto', zIndex: 1000, boxShadow: '0 4px 6px rgba(15,23,42,0.1)' },
  dropdownItem: { padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(15,23,42,0.05)', color: '#0f172a', fontSize: 14 },
  dropdownItemHover: { background: 'rgba(16,185,129,0.05)' },
  error: { color: '#ef4444', fontSize: 12, marginTop: 4 },
  inputContainer: { position: 'relative' },
  btnPrimary: { width: '100%', padding: '14px', background: '#10b981', borderRadius: 12, color: '#ffffff', fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer', marginTop: 24, minHeight: '44px' },
  btnSec: { background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14, marginTop: 12, textDecoration: 'underline', padding: 0 },
  row: { display: 'grid', gridTemplateColumns: window.innerWidth < 600 ? '1fr' : '1fr 1fr', gap: 16 },
  goalChip: (active) => ({
    padding: '10px 14px', borderRadius: 10, border: `1px solid ${active ? '#10b981' : 'rgba(15,23,42,0.1)'}`,
    background: active ? 'rgba(16,185,129,0.08)' : '#f8fafc',
    color: active ? '#059669' : '#475569', cursor: 'pointer', fontSize: 14, fontWeight: 500, transition: 'all 0.15s',
    minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }),
  progress: { display: 'flex', gap: 6, marginBottom: 32 },
  dot: (active, done) => ({
    height: 4, flex: 1, borderRadius: 2,
    background: done ? '#10b981' : active ? 'rgba(16,185,129,0.5)' : 'rgba(15,23,42,0.1)',
    transition: 'background 0.3s',
  }),
}

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Org-setup state (shown before health-profile steps when user has no org)
  const [orgCheckDone, setOrgCheckDone] = useState(false)
  const [needsOrg, setNeedsOrg] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [orgSaving, setOrgSaving] = useState(false)

  const [profile, setProfile] = useState({ height_cm: '', weight_kg: '', goals: [], current_supplements: '', current_medications: '', prior_diagnoses: '' })
  const [location, setLocation] = useState({ city: '', state: '', country: '', district: '' })
  const [complaints, setComplaints] = useState([{ complaint: '', duration_description: '', tried_interventions: '' }])

  // Validation states
  const [validationErrors, setValidationErrors] = useState({})
  const [showSuggestions, setShowSuggestions] = useState({ country: false, city: false, complaint: false })

  // Validate numeric inputs
  const validateNumericField = (field, value, min, max, fieldName) => {
    const num = parseFloat(value)
    if (value && (isNaN(num) || num < min || num > max)) {
      setValidationErrors(prev => ({ ...prev, [field]: `${fieldName} must be between ${min} and ${max}` }))
      return false
    } else {
      setValidationErrors(prev => ({ ...prev, [field]: null }))
      return true
    }
  }

  const handleHeightChange = (e) => {
    const value = e.target.value
    setProfile(p => ({ ...p, height_cm: value }))
    validateNumericField('height_cm', value, 50, 250, 'Height')
  }

  const handleWeightChange = (e) => {
    const value = e.target.value
    setProfile(p => ({ ...p, weight_kg: value }))
    validateNumericField('weight_kg', value, 20, 300, 'Weight')
  }

  const handleSkipOnboarding = async () => {
    try {
      await api.post('/auth/onboarding/skip')
      trackFunnelEvent('funnel_onboarding_skipped', 'User skipped onboarding and entered dashboard', {
        stage: steps[step] || 'unknown',
      }, { oncePerSession: true })
      toast('Вы пропустили заполнение профиля. Его можно завершить позже в настройках.', { icon: 'ℹ️', style: { background: '#fef9c3', color: '#92400e', fontSize: 15 } })
    } catch {
      // Fail-open: user explicitly chose to continue without onboarding.
    }
    navigate('/dashboard', { replace: true })
  }

  // On mount: org setup is only required for CRM roles with no org membership.
  useEffect(() => {
    api.get('/auth/me').then(r => {
      const memberships = r.data?.memberships
      const globalRole = String(r.data?.user?.global_role || r.data?.global_role || '').toLowerCase()
      const requiresOrg = globalRole === 'org_admin' || globalRole === 'super_admin'
      const hasMembership = Array.isArray(memberships) && memberships.length > 0
      setNeedsOrg(requiresOrg && !hasMembership)
      setOrgCheckDone(true)
    }).catch(() => {
      // Fail open for normal users: show personal onboarding, not org setup.
      setNeedsOrg(false)
      setOrgCheckDone(true)
    })
  }, [])

  const handleCreateOrg = async (e) => {
    e.preventDefault()
    const name = orgName.trim()
    if (!name) { toast.error('Введите название организации.'); return }
    setOrgSaving(true)
    try {
      await api.post('/auth/onboarding/organization', { name })
      toast.success('Организация создана!')
      navigate('/admin/dashboard', { replace: true })
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Не удалось создать организацию.')
    } finally {
      setOrgSaving(false)
    }
  }

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
        onboarding_complete: p.onboarding_complete || false,
      }))
      const loc = r.data?.location || {}
      setLocation({ city: loc.city || '', state: loc.state || '', country: loc.country || '', district: loc.district || '' })

      // If onboarding is already complete, redirect to dashboard
      if (p.onboarding_complete) {
        navigate('/dashboard', { replace: true })
      }
    }).catch(() => {})
  }, [navigate])

  const toggleGoal = (id) => setProfile(prev => ({
    ...prev,
    goals: prev.goals.includes(id) ? prev.goals.filter(g => g !== id) : [...prev.goals, id],
  }))

  const updateComplaint = (i, field, val) => setComplaints(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c))
  const addComplaint = () => setComplaints(prev => [...prev, { complaint: '', duration_description: '', tried_interventions: '' }])

  const saveAll = async () => {
    // Validate required fields
    const heightValid = validateNumericField('height_cm', profile.height_cm, 50, 250, 'Height')
    const weightValid = validateNumericField('weight_kg', profile.weight_kg, 20, 300, 'Weight')

    if (!profile.height_cm || !profile.weight_kg || !heightValid || !weightValid) {
      toast.error('Please fill in valid height and weight for accurate analysis.')
      return
    }
    setSaving(true)
    try {
      const profilePayload = {
        height_cm: Number(profile.height_cm),
        weight_kg: Number(profile.weight_kg),
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

      await api.post('/auth/onboarding/complete')
      trackFunnelEvent('funnel_onboarding_completed', 'User completed onboarding profile flow', {
        goals_count: profile.goals.length,
        complaints_count: complaints.filter((c) => c.complaint.trim()).length,
      }, { oncePerSession: true })

      toast.success('Profile saved!')
      navigate('/dashboard', { replace: true })
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
      <div style={{ width: '100%', maxWidth: 760 }}>
        <CabinetPageHeader
          title="Onboarding"
          subtitle="Set baseline profile and goals for personalized protocol generation."
          helper="Concrete profile data here influences your assignments, insights and recommendations."
        />

        <motion.div style={s.card} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>

          {/* ── Org-setup screen (shown only before health profile, when user has no org) ── */}
          {!orgCheckDone && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #10b981', borderTopColor: 'transparent', margin: '0 auto', animation: 'spin 0.7s linear infinite' }} />
              <div style={{ marginTop: 16, color: '#64748b', fontSize: 14 }}>Загружаем данные...</div>
            </div>
          )}

          {orgCheckDone && needsOrg && (
            <motion.div key="org-setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>👋</div>
                <div style={s.title}>Добро пожаловать!</div>
                <div style={s.sub}>Как назовём вашу организацию?</div>
              </div>
              <form onSubmit={handleCreateOrg}>
                <label>
                  <span style={s.label}>Название организации</span>
                  <input
                    style={s.input}
                    type="text"
                    placeholder="Например: HealthFirst Clinic"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    autoFocus
                    maxLength={120}
                  />
                </label>
                <button type="submit" style={{ ...s.btnPrimary, opacity: orgSaving ? 0.6 : 1 }} disabled={orgSaving}>
                  {orgSaving ? 'Создаём...' : 'Создать и войти в CRM →'}
                </button>
              </form>
            </motion.div>
          )}

          {/* ── Health-profile steps (default path for regular users) ── */}
          {orgCheckDone && !needsOrg && (
            <>
              {/* Progress bar */}
              <div style={s.progress}>
                {steps.map((_, i) => <div key={i} style={s.dot(i === step, i < step)} />)}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
          This onboarding captures practical baseline data for personalized tasks and protocol adjustments.
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 24, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Step {step + 1} of {TOTAL} — {steps[step]}
              </div>

              {/* Step 0: Basics */}
              {step === 0 && (
                <motion.div key="basics" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div style={s.title}><User size={22} style={{ display: 'inline', marginRight: 10, color: '#10b981' }} />Your basics</div>
                  <div style={s.sub}>Help us personalize your health guidance.</div>
                  <div style={{ marginBottom: 20, padding: '12px 14px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, fontSize: 13, color: '#1e293b', lineHeight: 1.55 }}>
              💡 Height and weight help calculate healthy ranges for your biomarkers. List supplements and medications so the AI can flag interactions and avoid duplicating what you already take.
                  </div>
                  <div style={s.row}>
                    <div style={s.inputContainer}>
                      <label>
                        <span style={{...s.label, color: '#ef4444'}}>* Height (cm) (required)</span>
                        <input
                          style={{...s.input, borderColor: validationErrors.height_cm ? '#ef4444' : 'rgba(15,23,42,0.12)'}}
                          type="number"
                          placeholder="175"
                          value={profile.height_cm}
                          onChange={handleHeightChange}
                          min="50"
                          max="250"
                          required
                        />
                        {validationErrors.height_cm && <div style={s.error}>{validationErrors.height_cm}</div>}
                      </label>
                    </div>
                    <div style={s.inputContainer}>
                      <label>
                        <span style={{...s.label, color: '#ef4444'}}>* Weight (kg) (required)</span>
                        <input
                          style={{...s.input, borderColor: validationErrors.weight_kg ? '#ef4444' : 'rgba(15,23,42,0.12)'}}
                          type="number"
                          placeholder="72"
                          value={profile.weight_kg}
                          onChange={handleWeightChange}
                          min="20"
                          max="300"
                          required
                        />
                        {validationErrors.weight_kg && <div style={s.error}>{validationErrors.weight_kg}</div>}
                      </label>
                    </div>
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
                  <div style={{ marginBottom: 20, padding: '12px 14px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, fontSize: 13, color: '#1e293b', lineHeight: 1.55 }}>
              💡 Pick all goals that feel relevant — you can select more than one. Your goals influence which biomarkers get flagged first and what supplements are included in your protocol.
                  </div>
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
                  <div style={s.title}><MapPin size={22} style={{ display: 'inline', marginRight: 10, color: '#10b981' }} />Your location</div>
                  <div style={s.sub}>Used for future physician referral support and local care assistance.</div>
                  <div style={{ marginBottom: 20, padding: '12px 14px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, fontSize: 13, color: '#1e293b', lineHeight: 1.55 }}>
              💡 Location is optional. It helps us suggest nearby labs and practitioners when you're ready for in-person consultations. It is not shared with third parties.
                  </div>
                  <div style={s.inputContainer}>
                    <span style={s.label}>Country</span>
                    <input
                      style={s.input}
                      placeholder="Start typing to search countries..."
                      value={location.country}
                      onChange={(e) => {
                        setLocation(l => ({ ...l, country: e.target.value, city: '' }))
                        setShowSuggestions(prev => ({ ...prev, country: true }))
                      }}
                      onFocus={() => setShowSuggestions(prev => ({ ...prev, country: true }))}
                      onBlur={() => setTimeout(() => setShowSuggestions(prev => ({ ...prev, country: false })), 200)}
                    />
                    {showSuggestions.country && location.country && (
                      <div style={s.dropdown}>
                        {COUNTRIES.filter(c => c.toLowerCase().includes(location.country.toLowerCase())).slice(0, 10).map(country => (
                          <div
                            key={country}
                            style={s.dropdownItem}
                            onMouseDown={() => setLocation(l => ({ ...l, country, city: '' }))}
                            onMouseEnter={(e) => e.target.style.background = s.dropdownItemHover.background}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                          >
                            {country}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 16, ...s.inputContainer }}>
                    <span style={s.label}>City</span>
                    <input
                      style={s.input}
                      placeholder={location.country ? `Start typing ${location.country} cities...` : 'Select country first'}
                      value={location.city}
                      onChange={(e) => {
                        setLocation(l => ({ ...l, city: e.target.value }))
                        setShowSuggestions(prev => ({ ...prev, city: true }))
                      }}
                      onFocus={() => setShowSuggestions(prev => ({ ...prev, city: true }))}
                      onBlur={() => setTimeout(() => setShowSuggestions(prev => ({ ...prev, city: false })), 200)}
                      disabled={!location.country}
                    />
                    {showSuggestions.city && location.city && location.country && CITIES_BY_COUNTRY[location.country] && (
                      <div style={s.dropdown}>
                        {CITIES_BY_COUNTRY[location.country].filter(c => c.toLowerCase().includes(location.city.toLowerCase())).slice(0, 10).map(city => (
                          <div
                            key={city}
                            style={s.dropdownItem}
                            onMouseDown={() => setLocation(l => ({ ...l, city }))}
                            onMouseEnter={(e) => e.target.style.background = s.dropdownItemHover.background}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                          >
                            {city}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <span style={s.label}>State / Region (optional)</span>
                    <input style={s.input} placeholder="e.g. California, Ontario" value={location.state} onChange={e => setLocation(l => ({ ...l, state: e.target.value }))} />
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <span style={s.label}>District / Area (optional)</span>
                    <input style={s.input} placeholder="e.g. Downtown, Central" value={location.district} onChange={e => setLocation(l => ({ ...l, district: e.target.value }))} />
                  </div>
                </motion.div>
              )}

              {/* Step 3: Complaints */}
              {step === 3 && (
                <motion.div key="complaints" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div style={s.title}><AlertTriangle size={22} style={{ display: 'inline', marginRight: 10, color: '#f5a623' }} />Recurring complaints</div>
                  <div style={s.sub}>What has been bothering you? We'll factor this into your analysis.</div>
                  <div style={{ marginBottom: 20, padding: '12px 14px', background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 12, fontSize: 13, color: '#1e293b', lineHeight: 1.55 }}>
              💡 Even vague symptoms like "fatigue" or "brain fog" are valuable — the AI connects them to your biomarker patterns. You can add multiple complaints. Skip this step if you have no current symptoms.
                  </div>
                  {complaints.map((c, i) => (
                    <div key={i} style={{ marginBottom: 20, padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px solid rgba(15,23,42,0.07)' }}>
                      <div style={s.inputContainer}>
                        <span style={s.label}>Complaint {i + 1}</span>
                        <input
                          style={{ ...s.input, marginBottom: 10 }}
                          placeholder="Start typing symptoms..."
                          value={c.complaint}
                          onChange={(e) => {
                            updateComplaint(i, 'complaint', e.target.value)
                            setShowSuggestions(prev => ({ ...prev, complaint: true }))
                          }}
                          onFocus={() => setShowSuggestions(prev => ({ ...prev, complaint: true }))}
                          onBlur={() => setTimeout(() => setShowSuggestions(prev => ({ ...prev, complaint: false })), 200)}
                        />
                        {showSuggestions.complaint && c.complaint && (
                          <div style={s.dropdown}>
                            {COMMON_SYMPTOMS.filter(s => s.toLowerCase().includes(c.complaint.toLowerCase())).slice(0, 8).map(symptom => (
                              <div
                                key={symptom}
                                style={s.dropdownItem}
                                onMouseDown={() => updateComplaint(i, 'complaint', symptom)}
                                onMouseEnter={(e) => e.target.style.background = s.dropdownItemHover.background}
                                onMouseLeave={(e) => e.target.style.background = 'transparent'}
                              >
                                {symptom}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <span style={s.label}>How long has this been present?</span>
                      <input style={{ ...s.input, marginBottom: 10 }} placeholder="e.g. 3 months, 1 year" value={c.duration_description} onChange={e => updateComplaint(i, 'duration_description', e.target.value)} />
                      <span style={s.label}>What have you tried so far?</span>
                      <input style={s.input} placeholder="e.g. Magnesium, better sleep schedule, diet changes" value={c.tried_interventions} onChange={e => updateComplaint(i, 'tried_interventions', e.target.value)} />
                    </div>
                  ))}
                  <button style={{ ...s.btnSec, marginTop: 4 }} onClick={addComplaint}>+ Add another complaint</button>
                </motion.div>
              )}

              {/* Navigation */}
              <div style={{ display: 'flex', gap: 12, marginTop: 28, alignItems: 'center' }}>
                {step > 0 && (
                  <button style={{ ...s.btnPrimary, flex: 0.4, background: '#e2e8f0', color: '#475569', marginTop: 0 }} onClick={() => setStep(s => s - 1)}>
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
                <button style={s.btnSec} onClick={handleSkipOnboarding}>Skip for now</button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
