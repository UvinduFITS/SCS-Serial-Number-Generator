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

export default function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()

  // Still resolving session or fetching profile — wait
  if (loading) return <Spinner />

  // No session at all — go to login
  if (!user) return <Navigate to="/login" replace />

  // Session exists but profile failed to load — go to login
  if (!profile) return <Navigate to="/login" replace />

  // Inactive account
  if (profile.status !== 'active') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm px-6">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 text-xl font-bold">
            !
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Account Inactive</h2>
          <p className="text-sm text-gray-500 mt-2">
            Your account has been deactivated. Contact an administrator.
          </p>
        </div>
      </div>
    )
  }

  return children
}
