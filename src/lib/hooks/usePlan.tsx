import { useState, useEffect, useContext, createContext, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'

const PlanContext = createContext(null)

export function PlanProvider({ children }) {
  const { profile, role } = useAuth()
  const [planData, setPlanData] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [trigger, setTrigger]   = useState(0)

  useEffect(() => {
    if (!profile?.id || (role !== 'creator' && role !== 'admin')) {
      setLoading(false)
      setPlanData(null)
      return
    }
    setLoading(true)
    supabase.rpc('get_creator_plan', { p_creator_id: profile.id })
      .then(({ data }) => {
        setPlanData(data)
        setLoading(false)
      })
  }, [profile?.id, role, trigger])

  const refresh = useCallback(() => setTrigger(t => t + 1), [])

  return (
    <PlanContext.Provider value={{ planData, loading, refresh }}>
      {children}
    </PlanContext.Provider>
  )
}

export function usePlan() {
  const ctx = useContext(PlanContext)
  if (!ctx) throw new Error('usePlan must be used within PlanProvider')
  return ctx
}
