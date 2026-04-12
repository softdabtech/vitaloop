import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useSubscription } from '../hooks/useSubscription.js'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const { subStatus } = useSubscription()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-10">
        <h1 className="text-2xl font-bold text-green-400">VITALOOP</h1>
        <div className="flex items-center gap-4">
          <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 uppercase">{subStatus}</span>
          <button onClick={signOut} className="text-sm text-gray-500 hover:text-gray-300">Sign out</button>
        </div>
      </header>

      <p className="text-gray-400 mb-8">Welcome, {user?.email}</p>

      <div className="grid md:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/upload')}
          className="bg-green-500 hover:bg-green-600 text-white rounded-xl p-6 text-left transition"
        >
          <div className="text-3xl mb-2">🧪</div>
          <div className="font-semibold">Upload Lab Results</div>
          <div className="text-sm opacity-80 mt-1">Analyze your blood test</div>
        </button>
        <button
          onClick={() => navigate('/avatar')}
          className="bg-gray-800 hover:bg-gray-700 rounded-xl p-6 text-left transition"
        >
          <div className="text-3xl mb-2">🫀</div>
          <div className="font-semibold">Health Avatar</div>
          <div className="text-sm text-gray-400 mt-1">View your body status</div>
        </button>
        <button
          onClick={() => navigate('/progress')}
          className="bg-gray-800 hover:bg-gray-700 rounded-xl p-6 text-left transition"
        >
          <div className="text-3xl mb-2">📈</div>
          <div className="font-semibold">Progress Tracker</div>
          <div className="text-sm text-gray-400 mt-1">Biomarker trends over time</div>
        </button>
      </div>
    </div>
  )
}
