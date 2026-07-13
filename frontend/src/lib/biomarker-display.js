const BIOMARKER_LABELS_UK = {
  ferritin: 'Феритин',
  canonical_ferritin: 'Феритин',
  glucose: 'Глюкоза',
  canonical_glucose: 'Глюкоза',
  hba1c: 'HbA1c',
  canonical_hba1c: 'HbA1c',
  vitamin_d: 'Вітамін D',
  canonical_vitamin_d: 'Вітамін D',
  b12: 'Вітамін B12',
  vitamin_b12: 'Вітамін B12',
  canonical_b12: 'Вітамін B12',
  folate: 'Фолат',
  canonical_folate: 'Фолат',
  magnesium: 'Магній',
  canonical_magnesium: 'Магній',
  tsh: 'ТТГ',
  canonical_tsh: 'ТТГ',
  crp: 'СРБ',
  canonical_crp: 'СРБ',
  hemoglobin: 'Гемоглобін',
  canonical_hemoglobin: 'Гемоглобін',
  hematocrit: 'Гематокрит',
  canonical_hematocrit: 'Гематокрит',
  rbc: 'Еритроцити',
  canonical_rbc: 'Еритроцити',
  wbc: 'Лейкоцити',
  canonical_wbc: 'Лейкоцити',
  platelets: 'Тромбоцити',
  canonical_platelets: 'Тромбоцити',
  creatinine: 'Креатинін',
  canonical_creatinine: 'Креатинін',
  egfr: 'eGFR',
  canonical_egfr: 'eGFR',
  alt: 'АЛТ',
  canonical_alt: 'АЛТ',
  ast: 'АСТ',
  canonical_ast: 'АСТ',
  ggt: 'ГГТ',
  canonical_ggt: 'ГГТ',
  bilirubin: 'Білірубін',
  canonical_bilirubin: 'Білірубін',
  ldl: 'ЛПНЩ',
  canonical_ldl: 'ЛПНЩ',
  hdl: 'ЛПВЩ',
  canonical_hdl: 'ЛПВЩ',
  triglycerides: 'Тригліцериди',
  canonical_triglycerides: 'Тригліцериди',
  total_cholesterol: 'Загальний холестерин',
  canonical_total_cholesterol: 'Загальний холестерин',
  iron: 'Залізо',
  canonical_iron: 'Залізо',
}

const BIOMARKER_LABELS_EN = {
  canonical_ferritin: 'Ferritin',
  canonical_glucose: 'Glucose',
  canonical_hba1c: 'HbA1c',
  canonical_vitamin_d: 'Vitamin D',
  canonical_b12: 'Vitamin B12',
  canonical_folate: 'Folate',
  canonical_magnesium: 'Magnesium',
  canonical_tsh: 'TSH',
  canonical_crp: 'C-Reactive Protein (CRP)',
  canonical_hemoglobin: 'Hemoglobin',
  canonical_creatinine: 'Creatinine',
  canonical_egfr: 'eGFR',
  canonical_alt: 'ALT',
  canonical_ast: 'AST',
  canonical_ldl: 'LDL',
  canonical_hdl: 'HDL',
}

const EVIDENCE_LABELS = {
  clinical_context: { en: 'Clinical context', uk: 'Клінічний контекст' },
  knowledge_rule: { en: 'Knowledge-base rule', uk: 'Правило бази знань' },
  rule_based: { en: 'Rule-based', uk: 'На основі правил' },
  ai_protocol: { en: 'AI-assisted draft', uk: 'AI-допоміжний чернетковий план' },
  high: { en: 'High confidence', uk: 'Висока впевненість' },
  medium: { en: 'Medium confidence', uk: 'Середня впевненість' },
  low: { en: 'Low confidence', uk: 'Низька впевненість' },
}

const RISK_LABELS = {
  needs_attention: { en: 'Needs attention', uk: 'Потребує уваги' },
  watch: { en: 'Watch', uk: 'Спостерігати' },
  stable: { en: 'Stable', uk: 'Стабільно' },
  high: { en: 'High', uk: 'Високий' },
  medium: { en: 'Medium', uk: 'Середній' },
  low: { en: 'Low', uk: 'Низький' },
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^canonical_/, 'canonical_')
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9а-яіїєґ]+/gi, '_')
    .replace(/^_+|_+$/g, '')
}

export function biomarkerDisplayName(value, isUk = false) {
  if (!value) return ''
  if (typeof value === 'object') {
    const key = value.canonical_name || value.canonical || value.biomarker || value.marker || value.name
    const translated = biomarkerDisplayName(key, isUk)
    return translated || value.name || value.label || ''
  }
  const raw = String(value || '').trim()
  const key = normalizeKey(raw)
  const labels = isUk ? BIOMARKER_LABELS_UK : BIOMARKER_LABELS_EN
  return labels[key] || raw.replace(/^canonical_/, '').replaceAll('_', ' ')
}

export function evidenceDisplayLabel(value, isUk = false) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const key = normalizeKey(raw)
  const entry = EVIDENCE_LABELS[key] || RISK_LABELS[key]
  if (entry) return isUk ? entry.uk : entry.en
  return raw.replaceAll('_', ' ')
}

export function riskDisplayLabel(value, isUk = false) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const entry = RISK_LABELS[normalizeKey(raw)]
  if (entry) return isUk ? entry.uk : entry.en
  return raw.replaceAll('_', ' ')
}
