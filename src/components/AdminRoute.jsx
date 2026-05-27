import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
        <p className="text-sm text-gray-400 mt-3">Loading…</p>
      </div>
    </div>
  )
}

export default function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth()

  // Still resolving session or fetching profile — wait
  if (loading) return <Spinner />

  // No session
  if (!user) return <Navigate to="/login" replace />

  // Profile missing
  if (!profile) return <Navigate to="/login" replace />

  // Not admin or inactive — send to generate page
  if (profile.status !== 'active' || profile.role !== 'admin') {
    return <Navigate to="/generate" replace />
  }

  return children
}
