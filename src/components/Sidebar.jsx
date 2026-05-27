import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Hash, LayoutDashboard, FileText, Users } from 'lucide-react'

export default function Sidebar() {
  const { profile } = useAuth()
  const location = useLocation()

  const navItems = [
    { path: '/generate', label: 'Generate Number', icon: Hash },
    ...(profile?.role === 'admin'
      ? [
          { path: '/admin/dashboard', label: 'Dashboard',       icon: LayoutDashboard },
          { path: '/admin/logs',      label: 'Audit Logs',      icon: FileText },
          { path: '/admin/users',     label: 'User Management', icon: Users },
        ]
      : []),
  ]

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col shrink-0">
      <div className="p-5 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-sm shrink-0">
            SCS
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">SCS Operations</p>
            <p className="text-xs text-gray-400 leading-tight">Number Generator</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === path
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Icon size={16} className="shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <p className="text-xs text-gray-500 text-center">
          {profile?.role === 'admin' ? 'Administrator' : 'Operations User'}
        </p>
      </div>
    </aside>
  )
}
