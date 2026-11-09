// By default requests go to same-origin /api (served by Netlify Functions).
// Set VITE_API_URL only if you want to point at a separately hosted backend,
// e.g. VITE_API_URL=http://127.0.0.1:8000 for the local Python API.
const API = import.meta.env.VITE_API_URL ?? ''

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
