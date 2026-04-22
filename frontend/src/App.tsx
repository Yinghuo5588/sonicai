import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuth'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import SettingsPage from '@/pages/SettingsPage'
import JobsPage from '@/pages/JobsPage'
import HistoryPage from '@/pages/HistoryPage'
import WebhooksPage from '@/pages/WebhooksPage'
import Layout from '@/layouts/Layout'

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
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
        <Route path="webhooks" element={<WebhooksPage />} />
      </Route>
    </Routes>
  )
}