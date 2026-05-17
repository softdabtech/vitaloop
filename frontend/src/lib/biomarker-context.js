/**
 * Biomarker context and explanations
 * Provides user-friendly descriptions for common biomarkers
 */

export const BIOMARKER_CONTEXT = {
  // Red Blood Cell markers
  'Red Blood Cells (RBC)': {
    description: 'Oxygen-carrying cells in your blood',
    what_it_means: 'Low RBC can cause fatigue and shortness of breath. High RBC may indicate dehydration or underlying conditions.',
    normal_range: '4.5-5.5 million cells/mcL for men, 4.0-5.0 for women',
    category: 'Blood',
  },
  'Hemoglobin': {
    description: 'Protein in red blood cells that carries oxygen',
    what_it_means: 'Low hemoglobin (anemia) causes fatigue and weakness. High hemoglobin is rare and usually indicates dehydration.',
    normal_range: '13.5-17.5 g/dL for men, 12.0-15.5 for women',
    category: 'Blood',
  },
  'Hematocrit': {
    description: 'Percentage of red blood cells in your blood',
    what_it_means: 'Measures how much of your blood is red blood cells. Low hematocrit (anemia) causes fatigue.',
    normal_range: '41-50% for men, 36-44% for women',
    category: 'Blood',
  },

  // White Blood Cell markers
  'White Blood Cells (WBC)': {
    description: 'Immune cells that fight infections',
    what_it_means: 'High WBC suggests infection, inflammation, or immune response. Low WBC weakens immune system.',
    normal_range: '4.5-11.0 thousand cells/mcL',
    category: 'Immunity',
  },
  'Neutrophils': {
    description: 'Most common type of white blood cell',
    what_it_means: 'High levels suggest infection or stress. Low levels weaken bacterial defense.',
    normal_range: '40-60% of WBC',
    category: 'Immunity',
  },
  'Lymphocytes': {
    description: 'White blood cells that produce antibodies',
    what_it_means: 'High levels suggest viral infection. Low levels indicate immune system weakness.',
    normal_range: '20-40% of WBC',
    category: 'Immunity',
  },

  // Platelet markers
  'Platelets': {
    description: 'Cell fragments that help with blood clotting',
    what_it_means: 'Low platelets increase bleeding/bruising risk. High platelets increase clotting risk.',
    normal_range: '150-400 thousand/mcL',
    category: 'Blood',
  },

  // Glucose & Metabolism
  'Glucose': {
    description: 'Blood sugar level',
    what_it_means: 'High fasting glucose may indicate prediabetes or diabetes. Low glucose causes dizziness and fatigue.',
    normal_range: 'Fasting: 70-100 mg/dL',
    category: 'Metabolism',
    actions: [
      'Reduce refined carbohydrates',
      'Increase physical activity',
      'Manage stress levels',
    ],
  },

  // Kidney Function
  'Creatinine': {
    description: 'Waste product filtered by kidneys',
    what_it_means: 'High creatinine suggests kidney dysfunction. Monitor with BUN and GFR.',
    normal_range: '0.7-1.3 mg/dL for men, 0.6-1.1 for women',
    category: 'Kidney',
  },
  'Blood Urea Nitrogen (BUN)': {
    description: 'Waste product from protein breakdown',
    what_it_means: 'High BUN may indicate kidney issues or dehydration. Low BUN suggests liver disease.',
    normal_range: '7-20 mg/dL',
    category: 'Kidney',
  },

  // Liver Function
  'Alanine Aminotransferase (ALT)': {
    description: 'Enzyme primarily found in liver cells',
    what_it_means: 'High ALT suggests liver damage or inflammation. Often more specific than AST.',
    normal_range: '7-55 units/L',
    category: 'Liver',
  },
  'Aspartate Aminotransferase (AST)': {
    description: 'Enzyme found in liver, heart, and muscles',
    what_it_means: 'High AST suggests liver or heart damage. Found in multiple tissues so less specific than ALT.',
    normal_range: '10-40 units/L',
    category: 'Liver',
  },
  'Bilirubin': {
    description: 'Pigment from breakdown of red blood cells',
    what_it_means: 'High bilirubin causes jaundice and suggests liver dysfunction or hemolysis.',
    normal_range: 'Total: 0.1-1.2 mg/dL',
    category: 'Liver',
  },

  // Cholesterol & Lipids
  'Total Cholesterol': {
    description: 'Total amount of cholesterol in blood',
    what_it_means: 'High cholesterol increases heart disease risk. Aim for <200 mg/dL.',
    normal_range: '<200 mg/dL (desirable)',
    category: 'Cardiovascular',
    actions: [
      'Reduce saturated fats',
      'Increase fiber intake',
      'Exercise regularly',
    ],
  },
  'Low-Density Lipoprotein (LDL)': {
    description: '"Bad" cholesterol that builds up in arteries',
    what_it_means: 'High LDL increases heart attack risk. Often called "bad cholesterol".',
    normal_range: '<100 mg/dL (optimal)',
    category: 'Cardiovascular',
  },
  'High-Density Lipoprotein (HDL)': {
    description: '"Good" cholesterol that removes LDL from arteries',
    what_it_means: 'High HDL protects against heart disease. Often called "good cholesterol".',
    normal_range: '>40 mg/dL for men, >50 for women',
    category: 'Cardiovascular',
  },
  'Triglycerides': {
    description: 'Type of fat in blood',
    what_it_means: 'High triglycerides indicate metabolic issues and increase heart disease risk.',
    normal_range: '<150 mg/dL (normal)',
    category: 'Cardiovascular',
  },

  // Minerals & Electrolytes
  'Calcium': {
    description: 'Mineral essential for bones, muscles, and nerves',
    what_it_means: 'Low calcium weakens bones (osteoporosis). High calcium may indicate kidney issues.',
    normal_range: '8.5-10.2 mg/dL',
    category: 'Minerals',
  },
  'Magnesium': {
    description: 'Mineral for muscle and nerve function',
    what_it_means: 'Low magnesium causes muscle cramps and fatigue. Low levels are common.',
    normal_range: '1.7-2.2 mg/dL',
    category: 'Minerals',
  },
  'Iron': {
    description: 'Mineral for oxygen transport in blood',
    what_it_means: 'Low iron causes anemia and fatigue. High iron damages organs.',
    normal_range: '60-170 mcg/dL for men, 50-170 for women',
    category: 'Minerals',
  },
  'Vitamin D': {
    description: 'Fat-soluble vitamin for bone health and immunity',
    what_it_means: 'Low vitamin D weakens bones and immunity. Very common deficiency, especially in winter.',
    normal_range: '30-100 ng/mL (sufficient: >30)',
    category: 'Vitamins',
    actions: [
      'Increase sun exposure (10-30 min daily)',
      'Eat fatty fish or fortified foods',
      'Consider supplementation if very low',
    ],
  },

  // Thyroid
  'TSH (Thyroid Stimulating Hormone)': {
    description: 'Hormone that regulates thyroid function',
    what_it_means: 'High TSH suggests underactive thyroid (hypothyroidism). Low TSH suggests overactive thyroid.',
    normal_range: '0.4-4.0 mIU/L',
    category: 'Thyroid',
  },
}

/**
 * Get biomarker context by name
 * Tries exact match first, then fuzzy matching
 */
export function getBiomarkerContext(name) {
  if (!name) return null

  // Try exact match first (case-insensitive)
  const exactMatch = Object.entries(BIOMARKER_CONTEXT).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  )
  if (exactMatch) return exactMatch[1]

  // Try fuzzy match for common abbreviations
  const fuzzyMap = {
    'RBC': 'Red Blood Cells (RBC)',
    'HGB': 'Hemoglobin',
    'HCT': 'Hematocrit',
    'WBC': 'White Blood Cells (WBC)',
    'PLT': 'Platelets',
    'BUN': 'Blood Urea Nitrogen (BUN)',
    'ALT': 'Alanine Aminotransferase (ALT)',
    'AST': 'Aspartate Aminotransferase (AST)',
    'TSH': 'TSH (Thyroid Stimulating Hormone)',
    'HDL': 'High-Density Lipoprotein (HDL)',
    'LDL': 'Low-Density Lipoprotein (LDL)',
  }

  const fuzzyKey = fuzzyMap[name.toUpperCase()]
  if (fuzzyKey) return BIOMARKER_CONTEXT[fuzzyKey]

  return null
}

/**
 * Get category-based color for biomarker
 */
export function getCategoryColor(category) {
  const colors = {
    'Blood': 'text-rose-600 bg-rose-50',
    'Immunity': 'text-blue-600 bg-blue-50',
    'Metabolism': 'text-amber-600 bg-amber-50',
    'Kidney': 'text-indigo-600 bg-indigo-50',
    'Liver': 'text-orange-600 bg-orange-50',
    'Cardiovascular': 'text-red-600 bg-red-50',
    'Minerals': 'text-emerald-600 bg-emerald-50',
    'Vitamins': 'text-yellow-600 bg-yellow-50',
    'Thyroid': 'text-purple-600 bg-purple-50',
  }
  return colors[category] || 'text-slate-600 bg-slate-50'
}
