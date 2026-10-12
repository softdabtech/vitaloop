import api from '../lib/api.js'

export async function listLabPlanItems() {
  const { data } = await api.get('/lab-plan/items')
  return data
}

export async function addLabPlanItem(payload) {
  const { data } = await api.post('/lab-plan/items', payload)
  return data
}
