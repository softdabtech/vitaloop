import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Activity, BarChart3, CreditCard, FileText, Home, LogOut, Menu, Settings, Upload, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Головна', icon: Home },
  { path: '/questionnaire', label: 'Симптоми', icon: Activity },
  { path: '/upload', label: 'Завантажити', icon: Upload, accent: true },
  { path: '/lab-results', label: 'Аналізи', icon: FileText },
  { path: '/subscription', label: 'Тарифи', icon: CreditCard },
  { path: '/settings', label: 'Налаштування', icon: Settings },
]

const PAGE_META = {
  '/dashboard': 'Кабінет',
  '/onboarding': 'Початок',
  '/questionnaire': 'Оцінка симптомів',
  '/upload': 'Завантаження аналізів',
  '/lab-results': 'Мої аналізи',
  '/subscription': 'Тарифи',
  '/settings': 'Налаштування',
}

function LogoMark() {
  return (
    <button onClick={() => window.location.assign('/dashboard')} className="flex items-center gap-2.5">
      <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-[#e8dfd2]">
        <img src="/images/ua-vitaloop-mark-20260603.png" alt="" className="h-8 w-8 object-contain" />
      </span>
      <span className="text-xl font-black tracking-[0.02em]">
        <span className="text-[#256bd8]">VITA</span><span className="text-[#f1bd2f]">LOOP</span>
      </span>
    </button>
  )
}

function NavButton({ item, active, onClick }) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className={[
        'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-black transition',
        active ? 'bg-[#0f766e] text-white shadow-[0_16px_34px_rgba(15,118,110,0.22)]' : 'text-[#334155] hover:bg-white hover:text-[#0f766e]',
        item.accent && !active ? 'ring-1 ring-[#d4b483]/45' : '',
      ].join(' ')}
    >
      <Icon className="h-5 w-5" />
      <span>{item.label}</span>
    </button>
  )
}

export default function UaCabinetLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const pageTitle = useMemo(() => PAGE_META[location.pathname] || 'VITALOOP Ukraine', [location.pathname])

  async function handleLogout() {
    try {
      await signOut()
    } finally {
      window.location.assign('/login')
    }
  }

  const nav = (
    <nav className="grid gap-2">
      {NAV_ITEMS.map((item) => (
        <NavButton
          key={item.path}
          item={item}
          active={location.pathname === item.path}
          onClick={() => {
            setOpen(false)
            navigate(item.path)
          }}
        />
      ))}
    </nav>
  )

  return (
    <div className="min-h-[100svh] bg-[#f8f5f0] text-[#0f172a]">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_8%,rgba(96,165,250,0.18),transparent_30%),radial-gradient(circle_at_85%_0%,rgba(212,180,131,0.20),transparent_28%),linear-gradient(180deg,#f8f5f0_0%,#efebe5_100%)]" />

      <aside className="fixed left-0 top-0 z-40 hidden h-full w-[280px] border-r border-[#e8dfd2] bg-[#f8f5f0]/92 p-5 backdrop-blur-xl lg:block">
        <LogoMark />
        <div className="mt-8">{nav}</div>
        <div className="absolute bottom-5 left-5 right-5 rounded-[22px] bg-white/72 p-4 ring-1 ring-[#e8dfd2]">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#0f766e]">
            <BarChart3 className="h-4 w-4" />
            Український кабінет
          </div>
          <p className="mt-2 text-sm leading-6 text-[#64748b]">Одна логіка з основним продуктом, окремий інтерфейс для UA-напряму.</p>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 bg-[#0f172a]/35 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}>
          <div className="h-full w-[82vw] max-w-[320px] bg-[#f8f5f0] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <LogoMark />
              <button onClick={() => setOpen(false)} className="rounded-full bg-white p-2 ring-1 ring-[#e8dfd2]"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-8">{nav}</div>
          </div>
        </div>
      )}

      <div className="lg:pl-[280px]">
        <header className="sticky top-0 z-30 border-b border-[#e8dfd2]/80 bg-[#f8f5f0]/88 backdrop-blur-xl">
          <div className="mx-auto flex h-[68px] max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setOpen(true)} className="rounded-2xl bg-white p-2.5 ring-1 ring-[#e8dfd2] lg:hidden">
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-black tracking-tight sm:text-xl">{pageTitle}</h1>
                <p className="truncate text-xs font-semibold text-[#64748b]">{user?.email || 'VITALOOP Ukraine'}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-[#0f172a] ring-1 ring-[#e8dfd2] transition hover:-translate-y-0.5 hover:text-[#0f766e]">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Вийти</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:pb-10">
          {children}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#e8dfd2] bg-[#f8f5f0]/94 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-xl lg:hidden">
          <div className="mx-auto grid max-w-[560px] grid-cols-5 gap-1">
            {NAV_ITEMS.slice(0, 5).map((item) => {
              const Icon = item.icon
              const active = location.pathname === item.path
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex min-h-[54px] flex-col items-center justify-center rounded-2xl text-[11px] font-black transition ${active ? 'bg-[#0f766e] text-white' : 'text-[#64748b] hover:bg-white'}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="mt-1">{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
