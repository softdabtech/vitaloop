export default function AppLoadingScreen({ error = null, onRetry = null }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-3">
          <img
            src="/images/favicon_1.png"
            alt=""
            className="h-20 w-20 object-contain"
            aria-hidden="true"
          />
          <div
            className="text-[28px] font-black uppercase leading-none tracking-[0.02em]"
            aria-label="VITALOOP"
          >
            <span className="text-[#10343a]">VITA</span>
            <span className="text-[#08c7ba]">LOOP</span>
          </div>
        </div>

        {error ? (
          <>
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-sm font-medium text-red-600">Unable to load dashboard</p>
              <p className="text-xs text-slate-500">
                {error.message || 'A network or service error occurred. Please try again.'}
              </p>
            </div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800"
              >
                Retry
              </button>
            )}
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  )
}
