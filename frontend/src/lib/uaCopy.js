export function pluralizeUk(count, forms) {
  const value = Math.abs(Number(count) || 0)
  const mod10 = value % 10
  const mod100 = value % 100

  if (mod10 === 1 && mod100 !== 11) return `${value} ${forms[0]}`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${value} ${forms[1]}`
  return `${value} ${forms[2]}`
}

export const UA_COPY = {
  knowledgeCenter: 'Центр знань',
  freePlan: 'Безкоштовно',
  medicalReviewPending: 'Очікує медичної перевірки',
}

export const pluralizeArticles = (count) => pluralizeUk(count, ['стаття', 'статті', 'статей'])
