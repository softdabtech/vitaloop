export const TEAM_CATEGORIES = {
  leadership: {
    title: 'Leadership & Product',
    description: 'The people shaping VITALOOP’s product, experience and company development.',
  },
  engineering: {
    title: 'Engineering',
    description: 'Building the infrastructure, automation and reliability behind the health intelligence pipeline.',
  },
  health: {
    title: 'Health & Nutrition',
    description: 'Contributing domain context and educational guidance to VITALOOP’s structured knowledge system.',
  },
}

export const teamMembers = [
  {
    id: 'alex-bombela', category: 'leadership', name: 'Alex Bombela', role: 'Founder & CEO',
    bio: 'Technology and product leader with 8+ years of experience delivering complex software and R&D projects. Leads VITALOOP’s product strategy, health intelligence direction and company development.',
    image: '/images/team/alex-bombela.webp', linkedin: 'https://www.linkedin.com/in/aleksey-bombela/',
  },
  {
    id: 'kate-yesipova', category: 'leadership', name: 'Kate Yesipova', role: 'Frontend Lead',
    bio: 'Frontend engineer with 4 years of React experience, including a year leading development teams. Leads the frontend experience that turns complex health intelligence into a clear and intuitive product.',
    image: '/images/team/kate-yesipova.webp', linkedin: 'https://www.linkedin.com/in/kate-yesipova-966402239',
  },
  {
    id: 'sergey-bombela', category: 'leadership', name: 'Sergey Bombela', role: 'Product Designer',
    bio: 'Product designer with 8+ years across B2B SaaS, healthcare, logistics and AI platforms. Leads VITALOOP’s product design and user experience.',
    image: '/images/team/sergey-bombela.webp', linkedin: 'https://www.linkedin.com/in/sergey-bombela',
  },
  {
    id: 'anna-bombela', category: 'leadership', name: 'Anna Bombela', role: 'People & Operations / HR',
    bio: 'Supports team development, hiring and people operations as VITALOOP grows its engineering and health expertise.',
    image: '/images/team/anna-bombela.webp', linkedin: null,
  },
  {
    id: 'senior-python-engineer', category: 'engineering', name: null, role: 'Senior Python Engineer',
    bio: 'Senior backend engineer focused on health-data processing, platform architecture, AI integration and reliability of VITALOOP’s clinical intelligence pipeline.',
    image: null, linkedin: null,
  },
  {
    id: 'senior-qa-automation-engineer', category: 'engineering', name: null, role: 'Senior QA Automation Engineer',
    bio: 'Senior QA automation specialist responsible for automated testing, regression protection and reliability across VITALOOP’s data and reporting workflows.',
    image: null, linkedin: null,
  },
  {
    id: 'nutrition-specialist-1', category: 'health', name: null, role: 'Nutrition Specialist',
    bio: 'Contributes nutrition expertise to VITALOOP’s health knowledge layer, educational guidance and practical health protocols.',
    image: null, linkedin: null,
  },
  {
    id: 'nutrition-specialist-2', category: 'health', name: null, role: 'Nutrition Specialist',
    bio: 'Supports the development and review of nutrition-focused health guidance within VITALOOP’s structured knowledge system.',
    image: null, linkedin: null,
  },
]

export function getTeamMembers(category) {
  return teamMembers.filter((member) => member.category === category)
}
