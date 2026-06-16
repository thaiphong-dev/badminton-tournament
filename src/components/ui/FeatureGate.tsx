import { useFeatures } from '@/lib/hooks/useFeatures'
import UpgradePrompt from '@/components/ui/UpgradePrompt'

/** Hiện children nếu user có feature, fallback nếu không */
export default function FeatureGate({ feature, fallback, silent = false, children }) {
  const { hasFeature, loading } = useFeatures()

  if (loading) return null

  if (!hasFeature(feature)) {
    if (silent) return null
    return fallback ?? <UpgradePrompt feature={feature} />
  }

  return children
}
