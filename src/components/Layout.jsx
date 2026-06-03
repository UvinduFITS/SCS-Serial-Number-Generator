import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import Sidebar from './Sidebar'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../lib/auth'

export default function Layout({ children }) {
  const { profile } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shrink-0">
          <h1 className="text-base font-semibold text-gray-800">
            SCS Operations - Serial Number Generator For FITS
          </h1>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-800 leading-tight">
                {profile?.full_name || profile?.email}
              </p>
              <p className="text-xs text-gray-400 leading-tight">
                {profile?.role === 'admin' ? 'Administrator' : 'Operations User'}
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-gray-400 hover:text-red-600 transition-colors text-sm"
              title="Log out"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
