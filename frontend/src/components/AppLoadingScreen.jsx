export default function AppLoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-6">
        {/* Logo */}
        <img src="/images/vitaloop-logo-wordmark.svg" alt="VITALOOP" className="h-12 w-auto" />

        {/* Loading Animation */}
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>

        {/* Loading Text */}
        <p className="text-sm text-slate-500">Loading your health dashboard...</p>
      </div>
    </div>
  )
}
