import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import SettingsPage from '@/pages/SettingsPage'
import JobsPage from '@/pages/JobsPage'
import HistoryPage from '@/pages/HistoryPage'
import WebhooksPage from '@/pages/WebhooksPage'
import PlaylistDetailPage from '@/pages/PlaylistDetailPage'
import RunDetailPage from '@/pages/RunDetailPage'
import Layout from '@/layouts/Layout'

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { token, logout } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true })
      return
    }
    // Verify token is still valid by calling /auth/me
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      if (res.status === 401) {
        logout()
        navigate('/login', { replace: true })
      }
    }).catch(() => {
      // Network error, let the page handle it
    })
  }, [])

  if (!token) return null
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <AuthRoute>
            <Layout />
          </AuthRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="history/run/:run_id" element={<RunDetailPage />} />
        <Route path="history/playlist/:playlist_id" element={<PlaylistDetailPage />} />
        <Route path="webhooks" element={<WebhooksPage />} />
      </Route>
    </Routes>
  )
}