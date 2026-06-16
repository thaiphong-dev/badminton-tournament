import { useCallback } from 'react'
import { usePlan } from '@/lib/hooks/usePlan'
import { useAuth } from '@/lib/hooks/useAuth'

export function useFeatures() {
  const { planData, loading } = usePlan()
  const { role } = useAuth()

  const hasFeature = useCallback((key) => {
    if (role === 'admin') return true
    if (!planData) return false
    return planData.feature_lookup?.[key] === true
  }, [planData, role])

  return {
    hasFeature,
    features:  planData?.features  ?? [],
    planSlug:  planData?.plan?.slug ?? 'free',
    loading,
  }
}
