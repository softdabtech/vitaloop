import { useEffect, useState } from 'react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!show) return null

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setDeferredPrompt(null)
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-40">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 flex items-center gap-3 shadow-xl">
        <div className="text-2xl">📲</div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">Install VITALOOP</p>
          <p className="text-gray-400 text-xs">Add to your home screen</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShow(false)}
            className="text-gray-500 hover:text-gray-300 text-xs px-2 py-1"
          >
            Not now
          </button>
          <button
            onClick={install}
            className="bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  )
}
