export function shouldGenerateInsight({
  querySucceeded,
  queryFetching,
  activeInsights = [],
  dismissedInsights = [],
  generationInFlight,
  generationAttempted,
}) {
  if (!querySucceeded || queryFetching || generationInFlight || generationAttempted) return false

  const hasActiveStructuredInsight = activeInsights.some(
    (insight) => insight?.provenance && insight?.next_action,
  )
  const hasDismissedStructuredInsight = dismissedInsights.some(
    (insight) => insight?.provenance && insight?.next_action,
  )

  return !hasActiveStructuredInsight && !hasDismissedStructuredInsight
}
