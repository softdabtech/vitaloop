import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'

const NAV_LINKS = [
  { id: 'why-vitaloop', label: 'Features', route: '/#why-vitaloop' },
  { id: 'pricing', label: 'Pricing', route: '/#pricing' },
  { id: 'about', label: 'About', route: '/about' },
  { id: 'for-nutritionists', label: 'For Nutritionists', route: '/for-nutritionists' },
]

export function PageHeader() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const closeMobileMenu = () => setMobileMenuOpen(false)

  const navAction = (item) => {
    closeMobileMenu()
    if (item.route) {
      navigate(item.route)
      return
    }
    setTimeout(() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' }), mobileMenuOpen ? 280 : 0)
  }

  const ctaBase = 'inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50'
  const navTextClass = 'text-slate-600 hover:text-slate-900'

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-[72px] w-full max-w-[1240px] items-center justify-between px-4 sm:px-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 transition hover:opacity-80"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-emerald-500/90 text-white">
            <img src="/favicon.svg" alt="VITALOOP" className="h-5 w-5 object-contain" />
          </span>
          <span className="text-base font-semibold tracking-tight">VITALOOP</span>
        </button>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((item) => (
            <button
              key={item.id}
              onClick={() => navAction(item)}
              className={`text-sm transition ${navTextClass}`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Log in link — only for non-authenticated visitors */}
          {!user && (
            <button
              onClick={() => navigate('/login')}
              className="hidden sm:inline-flex h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Log in
            </button>
          )}

          {/* Cabinet / Sign Up button */}
          <button
            onClick={() => navigate(user ? '/dashboard' : '/login?signup=true')}
            className={`${ctaBase} border border-slate-300 bg-white text-slate-900 hover:border-emerald-300`}
          >
            {user ? 'Cabinet' : 'Sign Up'}
          </button>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Open navigation menu"
            className="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 md:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile slide-down menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="border-t md:hidden border-slate-200 bg-white"
          >
            <div className="mx-auto flex max-w-[1240px] flex-col gap-1 px-4 py-4">
              {NAV_LINKS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navAction(item)}
                  className="rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </button>
              ))}
              <div className="my-2 h-px bg-slate-100" />
              {user ? (
                <button
                  onClick={() => {
                    closeMobileMenu()
                    navigate('/dashboard')
                  }}
                  className="mt-1 w-full rounded-xl bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-400"
                >
                  Cabinet
                </button>
              ) : (
                <div className="mt-1 flex flex-col gap-2">
                  <button
                    onClick={() => {
                      closeMobileMenu()
                      navigate('/login?signup=true')
                    }}
                    className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-400"
                  >
                    Sign Up — Free
                  </button>
                  <button
                    onClick={() => {
                      closeMobileMenu()
                      navigate('/login')
                    }}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Log in
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
