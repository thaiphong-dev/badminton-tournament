import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

let cachedRegistry = null

export function invalidateFeatureRegistryCache() { cachedRegistry = null }

export function useFeatureRegistry() {
  const [registry, setRegistry] = useState(cachedRegistry ?? {})

  useEffect(() => {
    if (cachedRegistry) return
    supabase.from('app_config').select('value').eq('key', 'feature_registry').maybeSingle()
      .then(({ data }) => {
        cachedRegistry = data?.value ?? {}
        setRegistry(cachedRegistry)
      })
  }, [])

  function getFeature(key) {
    return registry[key] ?? null
  }

  function getAllFeatures() {
    return Object.entries(registry).map(([key, meta]) => ({ key, ...meta }))
  }

  return { registry, getFeature, getAllFeatures }
}
