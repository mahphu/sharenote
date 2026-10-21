// ============================================
// SHARENOTE — REST client for the self-hosted backend (server/)
// ============================================

export async function api(path, { method = 'GET', body } = {}) {
  const hasBody = body !== undefined
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(body) : undefined
  })

  const data = res.status === 204 ? null : await res.json().catch(() => null)

  if (!res.ok) {
    const error = new Error(data?.error || `Request failed (${res.status})`)
    error.status = res.status
    throw error
  }
  return data
}
