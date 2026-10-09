import { getCurrentLocale } from '../lib/locale.js'

export const SYMPTOM_SAFETY_LEVELS = [
  'emergency',
  'urgent_24h',
  'clinician_review',
  'insufficient_data',
  'provider_outage',
  'routine',
]

export const SYMPTOM_SAFETY_COPY = {
  en: {
    emergency: {
      title: 'Get emergency help now',
      body: 'Your answers may indicate a serious medical emergency. This symptom check cannot determine the cause.',
      action: 'Call your local emergency number now. Do not drive yourself. If possible, ask someone to stay with you and follow the emergency dispatcher’s instructions.',
      tone: 'critical',
    },
    urgent_24h: {
      title: 'Contact a medical professional within 24 hours',
      body: 'Your answers indicate that prompt medical assessment is appropriate. This is not a diagnosis or a lab result.',
      action: 'Arrange medical care within 24 hours. If symptoms suddenly worsen or you develop an emergency warning sign, call your local emergency number.',
      tone: 'warning',
    },
    clinician_review: {
      title: 'Arrange a medical consultation',
      body: 'A medical professional should review these symptoms.',
      action: 'Schedule a consultation. Seek urgent help sooner if symptoms worsen.',
      tone: 'warning',
    },
    insufficient_data: {
      title: 'We could not complete a safe assessment',
      body: 'This does not mean that nothing is wrong.',
      action: 'Try the symptom check again or contact a medical professional. If symptoms are severe or rapidly worsening, call your local emergency number.',
      tone: 'warning',
    },
    provider_outage: {
      title: 'Symptom assessment is temporarily unavailable',
      body: 'The symptom assessment service is temporarily unavailable because of a technical problem. This is not a medical assessment or reassurance.',
      action: 'Your progress may be saved. Retry shortly. If symptoms are severe, rapidly worsening, or you have an emergency warning sign, seek urgent medical help now.',
      tone: 'warning',
    },
    routine: {
      title: 'Monitor how you feel',
      body: 'Your answers did not trigger an urgent next step in this symptom check. This is not a diagnosis.',
      action: 'Monitor your symptoms and contact a medical professional if they persist, worsen, or new symptoms appear.',
      tone: 'success',
    },
  },
  uk: {
    emergency: {
      title: 'Негайно зверніться по екстрену допомогу',
      body: 'Ваші відповіді можуть свідчити про серйозний невідкладний стан. Ця перевірка симптомів не може визначити причину.',
      action: 'Негайно зателефонуйте до місцевої екстреної служби. Не сідайте за кермо самостійно. Якщо можливо, попросіть когось залишитися поруч і виконуйте вказівки диспетчера.',
      tone: 'critical',
    },
    urgent_24h: {
      title: 'Зверніться до медичного працівника протягом 24 годин',
      body: 'Ваші відповіді свідчать, що вам потрібна своєчасна медична оцінка. Це не діагноз і не результат лабораторного аналізу.',
      action: 'Організуйте медичну допомогу протягом 24 годин. Якщо симптоми раптово посиляться або з’явиться ознака невідкладного стану, телефонуйте до місцевої екстреної служби.',
      tone: 'warning',
    },
    clinician_review: {
      title: 'Заплануйте консультацію з медичним працівником',
      body: 'Медичний працівник має оцінити ці симптоми.',
      action: 'Заплануйте консультацію. Якщо симптоми посиляться, зверніться по невідкладну допомогу раніше.',
      tone: 'warning',
    },
    insufficient_data: {
      title: 'Ми не змогли безпечно завершити оцінку',
      body: 'Це не означає, що все гаразд.',
      action: 'Спробуйте пройти перевірку симптомів ще раз або зверніться до медичного працівника. Якщо симптоми сильні чи швидко погіршуються, телефонуйте до місцевої екстреної служби.',
      tone: 'warning',
    },
    provider_outage: {
      title: 'Оцінка симптомів тимчасово недоступна',
      body: 'Сервіс оцінки симптомів тимчасово недоступний через технічну проблему. Це технічна недоступність, а не медична оцінка і не підтвердження, що все гаразд.',
      action: 'Ваш прогрес може бути збережений. Спробуйте ще раз незабаром. Якщо симптоми сильні, швидко погіршуються або є ознака невідкладного стану, негайно зверніться по екстрену медичну допомогу.',
      tone: 'warning',
    },
    routine: {
      title: 'Спостерігайте за самопочуттям',
      body: 'Ваші відповіді не спричинили невідкладних рекомендацій у цій перевірці симптомів. Це не діагноз.',
      action: 'Спостерігайте за симптомами та зверніться до медичного працівника, якщо вони не минають, посилюються або з’являються нові симптоми.',
      tone: 'success',
    },
  },
}

export function getSymptomSafetyCopy(level, locale = getCurrentLocale()) {
  const language = String(locale || '').toLowerCase().startsWith('uk') ? 'uk' : 'en'
  if (!SYMPTOM_SAFETY_LEVELS.includes(level)) {
    throw new Error(`Unknown symptom safety level: ${level}`)
  }
  return SYMPTOM_SAFETY_COPY[language][level]
}
