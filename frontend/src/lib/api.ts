const API_BASE = '/api'

class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    body?: unknown
  ) {
    super(detail || `HTTP ${status}`)
    this.name = 'ApiError'
  }
}

async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('sonicai_access_token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (res.status === 401) {
    // Clear token and reload to login
    localStorage.removeItem('sonicai_access_token')
    localStorage.removeItem('sonicai_refresh_token')
    window.location.href = '/login'
    throw new ApiError(401, 'Unauthorized')
  }

  const body = await res.json().catch(() => ({}) as T)
  if (!res.ok) {
    const detail = (body as any)?.detail || `HTTP ${res.status}`
    throw new ApiError(res.status, detail, body)
  }

  return body as T
}

export { apiFetch, ApiError }
export default apiFetch
