import { useNavigate } from 'react-router-dom'

const STEPS = [
  { icon: '📤', step: '1. Upload', desc: 'Take a photo or upload your PDF blood test. Works with any lab format.' },
  { icon: '🤖', step: '2. AI Analysis', desc: 'Claude AI extracts all biomarkers, compares to optimal ranges, flags issues.' },
  { icon: '💊', step: '3. Get Protocol', desc: 'Receive a personalized supplement stack with exact dosages and iHerb links.' },
]

const SECURITY = [
  { icon: '🔒', title: 'No PHI stored', desc: 'We extract only biomarker values. Original images are never saved.' },
  { icon: '🛡️', title: 'Row-level security', desc: 'Your data in Supabase is accessible only by your account — enforced at DB level.' },
  { icon: '🔐', title: 'TLS everywhere', desc: 'All traffic encrypted in transit. VITALOOP runs on HTTPS only.' },
  { icon: '🏥', title: 'HIPAA-aware design', desc: 'No raw lab text in logs. AI prompts stripped of identifying information.' },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <span className="text-green-400 font-bold text-xl tracking-tight">VITALOOP</span>
        <button
          onClick={() => navigate('/login')}
          className="text-sm text-gray-300 hover:text-white border border-gray-700 hover:border-gray-500 px-4 py-2 rounded-lg transition"
        >
          Sign in
        </button>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-4 pt-16 pb-20">
        <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          AI-Powered · Backed by Science
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold text-white mb-4 leading-tight tracking-tight">
          Know what your<br />
          <span className="text-green-400">blood test</span> really means
        </h1>
        <p className="text-gray-400 max-w-lg mb-8 text-lg leading-relaxed">
          Upload any blood panel. Get a personalized AI supplement protocol in 60 seconds.
          Track biomarker progress over time.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/login')}
            className="bg-green-500 hover:bg-green-600 active:scale-95 text-white font-bold px-8 py-4 rounded-2xl transition text-lg shadow-lg shadow-green-500/20"
          >
            Start free — Upload your analysis
          </button>
          <a
            href="#how"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 px-8 py-4 rounded-2xl transition text-base flex items-center justify-center"
          >
            How it works ↓
          </a>
        </div>
        <p className="text-gray-600 text-xs mt-4">No credit card required to try · $49/mo for full access</p>
      </section>

      {/* How it works */}
      <section id="how" className="px-4 py-20 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-12 text-white">How it works</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {STEPS.map(({ icon, step, desc }) => (
            <div key={step} className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6">
              <div className="text-4xl mb-3">{icon}</div>
              <div className="font-bold text-green-400 mb-2">{step}</div>
              <div className="text-gray-400 text-sm leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Security */}
      <section className="px-4 py-20 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-2 text-white">Your data is safe</h2>
        <p className="text-gray-500 text-center text-sm mb-10">No PHI. No selling your data. Ever.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {SECURITY.map(({ icon, title, desc }) => (
            <div key={title} className="flex gap-4 bg-gray-800/40 border border-gray-700/40 rounded-xl p-4">
              <div className="text-2xl">{icon}</div>
              <div>
                <div className="text-white font-semibold text-sm mb-1">{title}</div>
                <div className="text-gray-500 text-xs leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing block */}
      <section className="px-4 py-20 max-w-md mx-auto text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Simple pricing</h2>
        <p className="text-gray-500 text-sm mb-8">Everything included. Cancel anytime.</p>
        <div className="bg-gray-800 border border-green-500/30 rounded-2xl p-8 shadow-xl shadow-green-500/5">
          <div className="text-5xl font-extrabold text-white mb-1">$49</div>
          <div className="text-gray-400 text-sm mb-6">per month</div>
          <ul className="space-y-3 text-sm text-left mb-8">
            {[
              '✅ Unlimited lab uploads',
              '✅ Full AI biomarker analysis',
              '✅ Personalized supplement protocol',
              '✅ Progress tracking & charts',
              '✅ iHerb affiliate links',
              '✅ Health Avatar visualization',
            ].map((f) => (
              <li key={f} className="text-gray-300">{f}</li>
            ))}
          </ul>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-xl transition"
          >
            Get started free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-8 text-center text-xs text-gray-600">
        <div className="flex justify-center gap-6 mb-3">
          <a href="/privacy" className="hover:text-gray-400 transition">Privacy Policy</a>
          <a href="/terms" className="hover:text-gray-400 transition">Terms of Service</a>
        </div>
        <p>© {new Date().getFullYear()} VITALOOP. Not a medical device. For informational purposes only.</p>
      </footer>
    </div>
  )
}
