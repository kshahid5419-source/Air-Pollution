// In production, set VITE_API_URL to your backend origin.
// For same-origin reverse-proxy setups, leave it empty so requests go to /api.
const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, options)
  const data = await response.json().catch(() => ({ detail: 'Invalid server response' }))
  if (!response.ok) {
    const detail = data.detail
    const message = Array.isArray(detail)
      ? detail.map((d) => d.msg || JSON.stringify(d)).join('; ')
      : detail || 'Request failed'
    throw new Error(message)
  }
  return data
}

export const getJSON = (path) => request(path)
export const postJSON = (path, body) =>
  request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
