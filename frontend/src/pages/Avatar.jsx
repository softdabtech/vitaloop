import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { supabase } from '../lib/supabase.js'
import BodyAvatar from '../components/BodyAvatar.jsx'

export default function Avatar() {
  const { user } = useAuth()
  const [biomarkers, setBiomarkers] = useState([])

  useEffect(() => {
    if (!user) return
    supabase
      .from('biomarkers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setBiomarkers(data ?? []))
  }, [user])

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-green-400 mb-6">Digital Health Avatar</h2>
      <p className="text-gray-400 text-sm mb-8">
        Tap a zone to see related biomarkers and supplement recommendations.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6 text-xs">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-2 text-center text-green-300">Optimal</div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-2 text-center text-yellow-300">Borderline</div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-2 text-center text-red-300">Deficient</div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-2 text-center text-orange-300">Elevated</div>
      </div>

      <BodyAvatar biomarkers={biomarkers} />
    </div>
  )
}
