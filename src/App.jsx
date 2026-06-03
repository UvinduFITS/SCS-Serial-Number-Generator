import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Login from './pages/Login'
import GenerateNumber from './pages/GenerateNumber'
import Dashboard from './pages/Dashboard'
import AdminLogs from './pages/AdminLogs'
import UserManagement from './pages/UserManagement'

export default function App() {
  return (
    <BrowserRouter basename="/scsoperations">
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/generate"
            element={
              <ProtectedRoute>
                <GenerateNumber />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <Dashboard />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/logs"
            element={
              <AdminRoute>
                <AdminLogs />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <UserManagement />
              </AdminRoute>
            }
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/generate" replace />} />
          <Route path="*" element={<Navigate to="/generate" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
