import { useNavigate } from 'react-router-dom'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-gradient-to-b from-gray-950 to-gray-900">
      <h1 className="text-4xl md:text-6xl font-bold text-green-400 mb-4">VITALOOP</h1>
      <p className="text-xl text-gray-300 max-w-xl mb-2">Biohacking-as-a-Service</p>
      <p className="text-gray-400 max-w-lg mb-10">
        Upload your blood test → get an AI-powered supplement protocol → track your biomarker progress.
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => navigate('/login')}
          className="bg-green-500 hover:bg-green-600 text-white font-semibold px-8 py-3 rounded-xl transition"
        >
          Get Started — $49/mo
        </button>
        <a href="#how" className="border border-gray-600 text-gray-300 px-8 py-3 rounded-xl hover:border-gray-400 transition">
          How it works
        </a>
      </div>

      <section id="how" className="mt-24 grid md:grid-cols-5 gap-6 max-w-4xl text-left">
        {[
          { icon: '🧪', step: 'TEST', desc: 'Upload your PDF/photo blood test' },
          { icon: '🤖', step: 'AI ANALYSIS', desc: 'Claude AI extracts & interprets biomarkers' },
          { icon: '📋', step: 'PROTOCOL', desc: 'Personalized supplement stack with dosages' },
          { icon: '🛒', step: 'BUY', desc: 'One-click iHerb affiliate links' },
          { icon: '📈', step: 'RETEST', desc: 'Track progress after 90 days' },
        ].map(({ icon, step, desc }) => (
          <div key={step} className="bg-gray-800 rounded-xl p-5">
            <div className="text-3xl mb-2">{icon}</div>
            <div className="font-bold text-green-400 text-sm mb-1">{step}</div>
            <div className="text-gray-400 text-sm">{desc}</div>
          </div>
        ))}
      </section>
    </div>
  )
}
