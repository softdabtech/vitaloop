export function labPlanItemLabel(status, inLabPlanLabel = 'In lab plan') {
  return status === 'fulfilled' ? 'Completed' : inLabPlanLabel
}
