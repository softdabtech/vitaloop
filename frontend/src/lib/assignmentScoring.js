const KEYWORD_WEIGHTS = [
  { match: /(critical|urgent|risk|red flag)/i, score: 30, impact: 'critical' },
  { match: /(upload|lab|test|biomarker|blood)/i, score: 18, impact: 'high' },
  { match: /(check-?in|weekly|follow)/i, score: 14, impact: 'medium' },
  { match: /(questionnaire|survey|form)/i, score: 10, impact: 'medium' },
  { match: /(education|read|guide|tips)/i, score: 6, impact: 'low' },
]

function daysUntilDue(dueDate) {
  if (!dueDate) return null
  const due = new Date(dueDate).getTime()
  if (!Number.isFinite(due)) return null
  const now = Date.now()
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24))
}

function urgencyFromDays(days) {
  if (days == null) return { score: 0, urgency: 'normal' }
  if (days < 0) return { score: 28, urgency: 'overdue' }
  if (days <= 1) return { score: 20, urgency: 'today' }
  if (days <= 3) return { score: 12, urgency: 'soon' }
  return { score: 4, urgency: 'normal' }
}

function statusWeight(status) {
  const value = String(status || '').toLowerCase()
  if (value === 'overdue') return 26
  if (value === 'in_progress') return 12
  if (value === 'pending') return 8
  if (value === 'completed') return -40
  return 0
}

export function scoreAssignment(assignment) {
  const text = [
    assignment?.type,
    assignment?.category,
    assignment?.title,
    assignment?.name,
    assignment?.description,
  ].filter(Boolean).join(' ')

  let impact = 'low'
  let keywordScore = 0

  KEYWORD_WEIGHTS.forEach((rule) => {
    if (rule.match.test(text)) {
      keywordScore += rule.score
      if (rule.impact === 'critical') impact = 'critical'
      else if (rule.impact === 'high' && impact !== 'critical') impact = 'high'
      else if (rule.impact === 'medium' && impact === 'low') impact = 'medium'
    }
  })

  const days = daysUntilDue(assignment?.due_date)
  const urgencyPack = urgencyFromDays(days)
  const status = String(assignment?.status || 'pending').toLowerCase()

  const raw = 40 + keywordScore + urgencyPack.score + statusWeight(status)
  const score = Math.max(0, Math.min(100, raw))

  return {
    score,
    urgency: urgencyPack.urgency,
    impact,
    daysUntilDue: days,
  }
}

export function enrichAssignments(assignments) {
  return (assignments || []).map((assignment) => {
    const priority = scoreAssignment(assignment)
    return {
      ...assignment,
      priority,
    }
  })
}
