import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useFeatureRegistry } from '@/lib/hooks/useFeatureRegistry'

/** UI chuẩn khi tính năng bị lock — hiện label từ feature_registry */
export default function UpgradePrompt({ feature, compact = false }) {
  const { getFeature } = useFeatureRegistry()
  const meta = getFeature(feature)

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-2.5 py-1.5">
        <Lock className="w-3 h-3 shrink-0" />
        {meta?.label ?? feature}
        <Link to="/plans" className="text-blue-500 hover:underline font-medium ml-0.5">
          Nâng cấp
        </Link>
      </span>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-dashed border-amber-200 rounded-xl">
      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
        <Lock className="w-4 h-4 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700">{meta?.label ?? feature}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {meta?.upgrade_hint ?? 'Nâng cấp gói để dùng tính năng này'}
        </p>
      </div>
      <Link
        to="/plans"
        className="shrink-0 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
      >
        Nâng cấp →
      </Link>
    </div>
  )
}
