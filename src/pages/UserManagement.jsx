import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import Button from '../components/Button'
import Input from '../components/Input'
import Select from '../components/Select'
import { useAuth } from '../hooks/useAuth'
import { UserPlus, X, ShieldCheck, ShieldOff, RotateCcw, Users, Trash2, AlertTriangle } from 'lucide-react'

const ROLE_OPTIONS = [
  { value: 'operations', label: 'Operations User' },
  { value: 'admin', label: 'Administrator' },
]

function Toast({ message, type }) {
  return (
    <div
      className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium
        transition-all animate-fade-in ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}
    >
      {message}
    </div>
  )
}

const defaultNew = { full_name: '', email: '', role: 'operations', password: '' }

export default function UserManagement() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newUser, setNewUser] = useState({ ...defaultNew })
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const [actionBusy, setActionBusy] = useState({})
  const [toast, setToast] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { id, email, full_name }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4500)
  }

  // ── Delete user ────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteConfirm) return
    const { id, email } = deleteConfirm

    setActionBusy((b) => ({ ...b, [id + '_delete']: true }))
    const { error } = await supabase.rpc('admin_delete_user', { p_user_id: id })

    if (error) {
      showToast(error.message, 'error')
    } else {
      setUsers((us) => us.filter((u) => u.id !== id))
      showToast(`User ${email} deleted permanently`)
    }
    setActionBusy((b) => ({ ...b, [id + '_delete']: false }))
    setDeleteConfirm(null)
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setUsers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // ── Create User via RPC + send welcome email ───────────────
  async function handleCreateUser() {
    setCreateError('')

    if (!newUser.email.trim()) { setCreateError('Email is required.'); return }
    if (!newUser.password) { setCreateError('Password is required.'); return }
    if (newUser.password.length < 8) { setCreateError('Password must be at least 8 characters.'); return }

    setCreateLoading(true)
    try {
      // 1. Create the user
      const { error } = await supabase.rpc('admin_create_user', {
        p_email:     newUser.email.trim(),
        p_password:  newUser.password,
        p_full_name: newUser.full_name.trim() || null,
        p_role:      newUser.role,
      })

      if (error) throw new Error(error.message)

      // 2. Send welcome email via Edge Function
      let emailStatus = ''
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-welcome-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              email:     newUser.email.trim(),
              full_name: newUser.full_name.trim() || null,
              password:  newUser.password,
              role:      newUser.role,
              login_url: 'https://fitsexpress.com/scsoperations',
            }),
          }
        )
        const payload = await res.json()
        if (!res.ok) emailStatus = ` (email failed: ${payload.error || 'unknown error'})`
      } catch (emailErr) {
        emailStatus = ` (email failed: ${emailErr.message})`
      }

      showToast(`User ${newUser.email} created${emailStatus || ' and welcome email sent'}`,
                emailStatus ? 'error' : 'success')

      setShowModal(false)
      setNewUser({ ...defaultNew })
      fetchUsers()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreateLoading(false)
    }
  }

  // ── Toggle Active / Inactive ──────────────────────────────
  async function toggleStatus(userId, current) {
    const next = current === 'active' ? 'inactive' : 'active'
    setActionBusy((b) => ({ ...b, [userId + '_status']: true }))
    const { error } = await supabase
      .from('profiles')
      .update({ status: next })
      .eq('id', userId)
    if (error) {
      showToast(error.message, 'error')
    } else {
      setUsers((us) => us.map((u) => (u.id === userId ? { ...u, status: next } : u)))
      showToast(`User ${next === 'active' ? 'activated' : 'deactivated'}`)
    }
    setActionBusy((b) => ({ ...b, [userId + '_status']: false }))
  }

  // ── Change Role ───────────────────────────────────────────
  async function changeRole(userId, newRole) {
    setActionBusy((b) => ({ ...b, [userId + '_role']: true }))
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)
    if (error) {
      showToast(error.message, 'error')
    } else {
      setUsers((us) => us.map((u) => (u.id === userId ? { ...u, role: newRole } : u)))
      showToast('Role updated')
    }
    setActionBusy((b) => ({ ...b, [userId + '_role']: false }))
  }

  // ── Password Reset ────────────────────────────────────────
  async function sendPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    if (error) showToast(error.message, 'error')
    else showToast(`Password reset email sent to ${email}`)
  }

  return (
    <Layout>
      {toast && <Toast {...toast} />}

      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-gray-500 shrink-0" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
              <p className="text-sm text-gray-500 mt-0.5">{users.length} registered user{users.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <Button onClick={() => { setShowModal(true); setCreateError('') }} className="shrink-0">
            <UserPlus size={15} />
            Add User
          </Button>
        </div>

        {/* User table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-700">Full Name</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Email</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Role</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Created</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
                        Loading users…
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400">No users found.</td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isSelf = u.id === currentUser?.id
                    return (
                      <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {u.full_name || <span className="text-gray-400 italic">—</span>}
                          {isSelf && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">
                              You
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{u.email}</td>

                        {/* Role selector */}
                        <td className="px-4 py-3">
                          <select
                            value={u.role}
                            onChange={(e) => changeRole(u.id, e.target.value)}
                            disabled={isSelf || !!actionBusy[u.id + '_role']}
                            className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white
                              focus:outline-none focus:ring-1 focus:ring-blue-500
                              disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="operations">Operations</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>

                        {/* Status badge */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                              u.status === 'active'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-600'
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>

                        {/* Action buttons */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {/* Toggle active / inactive */}
                            <button
                              onClick={() => toggleStatus(u.id, u.status)}
                              disabled={isSelf || !!actionBusy[u.id + '_status']}
                              title={u.status === 'active' ? 'Deactivate user' : 'Activate user'}
                              className={`p-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                u.status === 'active'
                                  ? 'text-red-500 hover:bg-red-50'
                                  : 'text-green-600 hover:bg-green-50'
                              }`}
                            >
                              {u.status === 'active'
                                ? <ShieldOff size={15} />
                                : <ShieldCheck size={15} />
                              }
                            </button>

                            {/* Send password reset */}
                            <button
                              onClick={() => sendPasswordReset(u.email)}
                              title="Send password reset email"
                              className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                            >
                              <RotateCcw size={15} />
                            </button>

                            {/* Delete user (permanent) */}
                            <button
                              onClick={() => setDeleteConfirm({ id: u.id, email: u.email, full_name: u.full_name })}
                              disabled={isSelf || !!actionBusy[u.id + '_delete']}
                              title={isSelf ? "You cannot delete your own account" : "Delete user permanently"}
                              className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Delete Confirmation Modal ─────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} className="text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Delete User Permanently?</h3>
                  <p className="text-sm text-gray-500 mt-2">
                    You are about to permanently delete{' '}
                    <span className="font-semibold text-gray-800">
                      {deleteConfirm.full_name || deleteConfirm.email}
                    </span>
                    . This action <strong>cannot be undone</strong>.
                  </p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3 text-xs text-red-700">
                    <strong>Note:</strong> Their generated reference numbers in the audit log will remain (with their email preserved), but they will no longer be able to log in.
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 bg-gray-50 rounded-b-2xl border-t border-gray-100">
              <Button
                onClick={confirmDelete}
                loading={!!actionBusy[deleteConfirm.id + '_delete']}
                variant="danger"
                className="flex-1"
              >
                <Trash2 size={14} />
                Delete Permanently
              </Button>
              <Button
                onClick={() => setDeleteConfirm(null)}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add User Modal ─────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Modal header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Add New User</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              <Input
                label="Full Name"
                type="text"
                value={newUser.full_name}
                onChange={(e) => setNewUser((u) => ({ ...u, full_name: e.target.value }))}
                placeholder="Jane Doe"
                autoComplete="off"
              />
              <Input
                label="Email Address *"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                placeholder="jane@scs.com"
                autoComplete="off"
                required
              />
              <Select
                label="Role *"
                value={newUser.role}
                onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))}
                options={ROLE_OPTIONS}
              />
              <Input
                label="Temporary Password *"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                required
              />

              {createError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {createError}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 px-6 py-4 bg-gray-50 rounded-b-2xl border-t border-gray-100">
              <Button
                onClick={handleCreateUser}
                loading={createLoading}
                className="flex-1"
              >
                Create User
              </Button>
              <Button
                onClick={() => setShowModal(false)}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
