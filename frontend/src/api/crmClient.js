import api from '../lib/api.js'

function normalizeError(error) {
  const status = error?.response?.status
  const detail = error?.response?.data?.detail
  const code = error?.response?.data?.code
  const message = typeof detail === 'string' ? detail : error?.message || 'Request failed'

  const result = new Error(message)
  result.status = status
  result.code = code
  result.payload = error?.response?.data
  return result
}

async function request(method, path, payload, config = {}) {
  try {
    const response = await api.request({
      method,
      url: path,
      data: payload,
      ...config,
    })
    return response?.data
  } catch (error) {
    throw normalizeError(error)
  }
}

export const crmClient = {
  get: (path, config) => request('get', path, undefined, config),
  post: (path, data, config) => request('post', path, data, config),
  patch: (path, data, config) => request('patch', path, data, config),
}

export function isNotImplemented(error) {
  return error?.status === 404 || error?.status === 405 || error?.code === 'HTTP_ERROR'
}
