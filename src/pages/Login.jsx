import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import Button from '../components/Button'
import Input from '../components/Input'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  // Navigate only after BOTH user AND profile are fully loaded
  useEffect(() => {
    if (user && profile) {
      if (profile.status === 'active') {
        navigate('/generate', { replace: true })
      } else {
        setError('Your account is inactive. Contact an administrator.')
      }
    }
  }, [user, profile, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        setError(signInError.message || 'Invalid email or password.')
      }
      // Do NOT navigate here — useEffect above handles it
      // once onAuthStateChange fires and profile is fetched

    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white text-lg mx-auto mb-4 shadow-md">
              SCS
            </div>
            <h1 className="text-2xl font-bold text-gray-900">SCS Operations 2026</h1>
            <p className="text-gray-500 text-sm mt-1">Serial Number Generator System</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@scs.com"
              autoComplete="email"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full py-2.5 mt-2">
              Sign In
            </Button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-400 mt-5">
          SCS Operations Internal System — Authorized Users Only
        </p>
      </div>
    </div>
  )
}
