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

// ── Token refresh mechanism ───────────────────────────────────────────────────

let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise

  isRefreshing = true
  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem('sonicai_refresh_token')
    if (!refreshToken) return false

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      if (!res.ok) return false

      const data = await res.json()
      localStorage.setItem('sonicai_access_token', data.access_token)
      localStorage.setItem('sonicai_refresh_token', data.refresh_token)
      return true
    } catch {
      return false
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

function forceLogout() {
  localStorage.removeItem('sonicai_access_token')
  localStorage.removeItem('sonicai_refresh_token')
  window.location.href = '/login'
}

// ── API fetch ─────────────────────────────────────────────────────────────────

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

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  // 401: attempt token refresh once
  if (res.status === 401) {
    const refreshed = await tryRefreshToken()
    if (refreshed) {
      const newToken = localStorage.getItem('sonicai_access_token')
      const retryHeaders = {
        ...headers,
        Authorization: `Bearer ${newToken}`,
      }
      res = await fetch(`${API_BASE}${path}`, { ...options, headers: retryHeaders })
    }

    if (res.status === 401) {
      forceLogout()
      throw new ApiError(401, 'Unauthorized')
    }
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
