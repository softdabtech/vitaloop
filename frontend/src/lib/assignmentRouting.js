export function resolveAssignmentPath(assignment) {
  const text = [
    assignment?.type,
    assignment?.category,
    assignment?.title,
    assignment?.name,
    assignment?.description,
  ].filter(Boolean).join(' ').toLowerCase()

  if (text.includes('questionnaire') || text.includes('survey') || text.includes('form')) {
    return '/questionnaire'
  }
  if (text.includes('check') || text.includes('weekly')) {
    return '/checkin'
  }
  if (text.includes('upload') || text.includes('lab') || text.includes('test')) {
    return '/upload'
  }
  return '/timeline'
}
