import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ActivitySquare, Home, Route, TrendingUp, User } from 'lucide-react'
import { isUkrainianLocale } from '../../lib/locale.js'

const TAB_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', ukLabel: 'Панель', icon: Home },
  { path: '/questionnaire', label: 'Journey', ukLabel: 'Шлях', icon: Route },
  { path: '/lab-results', label: 'Results', ukLabel: 'Результати', icon: ActivitySquare, accent: true },
  { path: '/progress', label: 'Progress', ukLabel: 'Прогрес', icon: TrendingUp },
  { path: '/health-profile', label: 'Profile', ukLabel: 'Профіль', icon: User },
]

function isActive(current, item) {
  if (current === item.path) return true
  if (item.path === '/questionnaire') return current === '/questionnaire' || current === '/lab-plan' || current === '/upload' || current === '/assignments' || current === '/check-ins'
  if (item.path === '/lab-results') return current === '/lab-results' || current.startsWith('/results/') || current.startsWith('/protocol/')
  if (item.path === '/health-profile') return current === '/health-profile' || current === '/settings' || current === '/subscription' || current === '/billing-history'
  if (item.path === '/dashboard') return current === '/dashboard'
  return current.startsWith(`${item.path}/`)
}

export default function MobileBottomBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isUk = isUkrainianLocale()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/97 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))', minHeight: 'var(--vtl-bottom-bar-height)' }}
      aria-label="Main navigation"
    >
      <div className="flex items-end justify-around px-1 pt-2">
        {TAB_ITEMS.map((item) => {
          const active = isActive(pathname, item)
          const Icon = item.icon
          const label = isUk ? item.ukLabel || item.label : item.label

          if (item.accent) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className="relative -mt-5 flex flex-col items-center"
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition-all duration-200 ${
                    active
                      ? 'bg-emerald-600 shadow-emerald-500/40 scale-105'
                      : 'bg-emerald-500 shadow-emerald-500/30 hover:bg-emerald-600 active:scale-95'
                  }`}
                  style={{ boxShadow: '0 4px 16px rgba(16,185,129,0.45)' }}
                >
                  <Icon className="h-6 w-6 text-white" />
                </span>
                <span className={`mt-1.5 text-xs font-semibold ${active ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {label}
                </span>
              </button>
            )
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className="relative flex flex-col items-center gap-1 pb-1 pt-0.5 min-w-[48px] transition-all duration-150 active:scale-95"
            >
              <span className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-200 ${active ? 'bg-emerald-50' : ''}`}>
                <Icon className={`h-5 w-5 transition-colors duration-200 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
                {active && (
                  <motion.span
                    layoutId="tab-indicator"
                    className="absolute -bottom-0.5 left-1/2 h-1 w-4 -translate-x-1/2 rounded-full bg-emerald-500"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </span>
              <span className={`text-xs font-semibold leading-none transition-colors duration-200 ${active ? 'text-emerald-700' : 'text-slate-500'}`}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
