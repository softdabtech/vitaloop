export function shouldGenerateInsight({
  querySucceeded,
  queryFetching,
  generationAllowed,
  generationInFlight,
  generationAttempted,
}) {
  return Boolean(
    querySucceeded &&
    !queryFetching &&
    generationAllowed &&
    !generationInFlight &&
    !generationAttempted
  )
}
