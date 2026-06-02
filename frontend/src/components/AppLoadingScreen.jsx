export default function AppLoadingScreen() {
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
