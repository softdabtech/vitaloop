import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { supabase } from '../lib/supabase.js'
import toast from 'react-hot-toast'

export default function Settings() {
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState({ full_name: '', age: '', sex: '', timezone: 'America/New_York' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('users').select('*').eq('id', user.id).single().then(({ data }) => {
      if (data) setProfile({ full_name: data.full_name || '', age: data.age || '', sex: data.sex || '', timezone: data.timezone })
    })
  }, [user])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('users').update({
      full_name: profile.full_name,
      age: profile.age ? Number(profile.age) : null,
      sex: profile.sex || null,
      timezone: profile.timezone,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id)
    setSaving(false)
    if (error) toast.error('Save failed')
    else toast.success('Profile updated')
  }

  return (
    <div className="min-h-screen p-6 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold text-green-400 mb-6">Settings</h2>
      <form onSubmit={handleSave} className="space-y-4 bg-gray-900 rounded-xl p-6">
        <div>
          <label className="text-sm text-gray-400">Full Name</label>
          <input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
            className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-400">Age</label>
            <input type="number" min="1" max="120" value={profile.age} onChange={(e) => setProfile({ ...profile, age: e.target.value })}
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500" />
          </div>
          <div>
            <label className="text-sm text-gray-400">Sex</label>
            <select value={profile.sex} onChange={(e) => setProfile({ ...profile, sex: e.target.value })}
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500">
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <button type="submit" disabled={saving} className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
      <button onClick={signOut} className="mt-4 w-full border border-gray-700 text-gray-500 py-2.5 rounded-lg hover:border-gray-500 text-sm">
        Sign out
      </button>
    </div>
  )
}
