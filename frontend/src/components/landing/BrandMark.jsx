export default function BrandMark({ compact = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-[14px]">
        <img src="/images/favicon_1.png" alt="" className="h-11 w-11 object-contain" />
      </span>
      {!compact && (
        <span
          className="text-[22px] font-black uppercase leading-none tracking-[0.02em]"
          aria-label="VITALOOP"
        >
          <span className="text-[#10343a]">VITA</span>
          <span className="text-[#087f78]">LOOP</span>
        </span>
      )}
    </span>
  )
}
