import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useProfile(userId) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setProfile(data)
        setLoading(false)
      })
  }, [userId])

  return { profile, loading, error }
}
