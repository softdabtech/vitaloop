export const CABINET_VERSION = 'V5.1'

export const HEALTH_LOOP_STAGES = [
  'Concern',
  'Questions',
  'Lab Plan',
  'Results',
  'Protocol',
  'Check-in',
  'Retest',
]

export function getHealthLoopStageIndex({ hasConcern, hasQuestions, hasLabPlan, hasResults, hasProtocol, hasCheckin }) {
  if (!hasConcern) return 0
  if (!hasQuestions) return 1
  if (!hasLabPlan) return 2
  if (!hasResults) return 3
  if (!hasProtocol) return 4
  if (!hasCheckin) return 5
  return 6
}
