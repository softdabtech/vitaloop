// Skeleton pulse animation block
export function SkeletonBlock({ className = '' }) {
  return (
    <div className={`animate-pulse bg-gray-700/60 rounded-xl ${className}`} />
  )
}

// Skeleton for a biomarker card row
export function BiomarkerCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-2">
      <SkeletonBlock className="h-4 w-1/3" />
      <SkeletonBlock className="h-3 w-2/3" />
      <SkeletonBlock className="h-6 w-full" />
    </div>
  )
}

// Skeleton for a chart area
export function ChartSkeleton() {
  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-3">
      <SkeletonBlock className="h-4 w-1/4" />
      <SkeletonBlock className="h-40 w-full" />
    </div>
  )
}

// Skeleton for a protocol card
export function ProtocolCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-2">
      <SkeletonBlock className="h-4 w-1/2" />
      <SkeletonBlock className="h-3 w-3/4" />
      <SkeletonBlock className="h-3 w-1/2" />
    </div>
  )
}
