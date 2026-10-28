// AI-powered suggestions based on biomarkers
export async function getSuggestions(biomarkers: any[], adherence: number) {
  return {
    // Простые правила без API (быстро)
    topActions: generateTopActions(biomarkers),
    supplementsToPrioritize: filterSupplements(biomarkers),
    dietaryChanges: suggestDietaryChanges(biomarkers),
    warningFlags: identifyWarnings(biomarkers),
  }
}

function generateTopActions(biomarkers: any[]) {
  const deficient = biomarkers.filter(b => b.status === 'DEFICIENT')
  return deficient.slice(0, 3).map(b => ({
    priority: 'high',
    action: `Address ${b.name} deficiency`,
    impact: 'Improves energy and recovery',
    icon: 'AlertTriangle',
  }))
}

function filterSupplements(biomarkers: any[]) {
  const issues: Record<string, string[]> = {
    'Iron': ['Beef', 'Spinach', 'Oysters', 'Fortified cereals'],
    'Vitamin D': ['Salmon', 'Egg yolks', 'Mushrooms', 'Sunlight exposure'],
    'B12': ['Meat', 'Fish', 'Dairy', 'Nutritional yeast'],
    'Magnesium': ['Pumpkin seeds', 'Almonds', 'Spinach', 'Dark chocolate'],
    'Zinc': ['Oysters', 'Beef', 'Pumpkin seeds', 'Chickpeas'],
  }

  const deficient = biomarkers
    .filter(b => b.status === 'DEFICIENT')
    .map(b => b.name)

  return Object.entries(issues)
    .filter(([name]) => deficient.some(d => d.includes(name)))
    .flatMap(([name, foods]) => foods)
}

function suggestDietaryChanges(biomarkers: any[]) {
  const suggestions: string[] = []

  const elevated = biomarkers.filter(b => b.status === 'ELEVATED')
  if (elevated.some(b => b.name.includes('Cholesterol'))) {
    suggestions.push('Reduce saturated fats and increase omega-3 intake')
  }
  if (elevated.some(b => b.name.includes('Glucose'))) {
    suggestions.push('Reduce refined carbs, increase fiber and whole grains')
  }
  if (elevated.some(b => b.name.includes('Inflammation'))) {
    suggestions.push('Add anti-inflammatory foods: turmeric, ginger, berries')
  }

  return suggestions
}

function identifyWarnings(biomarkers: any[]) {
  const critical = biomarkers.filter(b => b.status === 'DEFICIENT')
  return critical.map(b => ({
    marker: b.name,
    severity: 'high',
    advice: `Consult doctor about ${b.name.toLowerCase()} supplementation`,
  }))
}
