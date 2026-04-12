import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import api from '../lib/api.js'
import ProgressChart from '../components/ProgressChart.jsx'
import { useNavigate } from 'react-router-dom'

export default function Progress() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    api.get(`/progress/${user.id}`).then((res) => {
      setData(res.data)
      setLoading(false)
    })
  }, [user])

  if (loading) return <div className="flex items-center justify-center h-screen">Loading…</div>

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-green-400 mb-6">Progress Tracker</h2>
      {data.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 mb-4">No lab results yet.</p>
          <button onClick={() => navigate('/upload')} className="bg-green-500 hover:bg-green-600 text-white px-6 py-2.5 rounded-lg">
            Upload First Test
          </button>
        </div>
      ) : (
        <>
          <ProgressChart data={data} />
          <div className="mt-8 bg-gray-800 rounded-xl p-5 text-center">
            <p className="text-gray-400 text-sm">Retest recommended every 90 days to track improvements.</p>
            <button onClick={() => navigate('/upload')} className="mt-3 bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg text-sm">
              Upload New Test
            </button>
          </div>
        </>
      )}
    </div>
  )
}
