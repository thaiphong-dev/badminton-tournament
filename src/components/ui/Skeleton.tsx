import { cn } from '@/lib/utils/cn'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-gray-200/80 dark:bg-gray-700/50', className)}
      {...props}
    />
  )
}

export function SkeletonLine({ className, width = 'full', ...props }: SkeletonProps & { width?: 'full' | '3/4' | '1/2' | '1/4' }) {
  const widths = {
    full: 'w-full',
    '3/4': 'w-3/4',
    '1/2': 'w-1/2',
    '1/4': 'w-1/4',
  }
  return <Skeleton className={cn('h-4', widths[width], className)} {...props} />
}

export function SkeletonCircle({ className, size = 'md', ...props }: SkeletonProps & { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  }
  return <Skeleton className={cn('rounded-full shrink-0', sizes[size], className)} {...props} />
}

// ── Composite Skeletons ──────────────────────────────────────────────────────

// 1. Tournament Card Skeleton (for Home.tsx list)
export function TournamentCardSkeleton() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <SkeletonCircle size="sm" />
          <div className="space-y-2 flex-1">
            <SkeletonLine width="3/4" className="h-5" />
            <SkeletonLine width="1/2" className="h-3.5" />
          </div>
        </div>
        <Skeleton className="w-16 h-6 rounded-full" />
      </div>
      <div className="space-y-2 pt-2 border-t border-gray-50">
        <SkeletonLine width="full" className="h-3.5" />
        <SkeletonLine width="3/4" className="h-3.5" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="w-24 h-4" />
        <Skeleton className="w-16 h-8 rounded-lg" />
      </div>
    </div>
  )
}

// 2. Tournament Overview Skeleton
export function TournamentOverviewSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="w-12 h-4" />
        <span className="text-gray-300">/</span>
        <Skeleton className="w-24 h-4" />
      </div>

      {/* Header banner skeleton */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-4">
          <SkeletonCircle size="md" className="rounded-xl" />
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <SkeletonLine width="1/2" className="h-6" />
              <Skeleton className="w-16 h-5 rounded-full" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="w-32 h-4" />
              <Skeleton className="w-40 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2 shadow-xs">
            <Skeleton className="w-10 h-4" />
            <Skeleton className="w-16 h-6" />
          </div>
        ))}
      </div>

      {/* Tabs list skeleton */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        <Skeleton className="w-24 h-8 rounded" />
        <Skeleton className="w-24 h-8 rounded" />
        <Skeleton className="w-24 h-8 rounded" />
      </div>

      {/* Content skeleton */}
      <div className="grid sm:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3 shadow-xs">
            <div className="flex justify-between items-center">
              <Skeleton className="w-32 h-5" />
              <Skeleton className="w-16 h-5 rounded-full" />
            </div>
            <SkeletonLine width="3/4" />
            <SkeletonLine width="1/2" />
            <div className="flex justify-end pt-2">
              <Skeleton className="w-24 h-9 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 3. Match Bracket Skeleton (for KnockoutPage.tsx)
export function MatchBracketSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div className="space-y-2 flex-1">
          <SkeletonLine width="1/2" className="h-6" />
          <SkeletonLine width="1/4" className="h-4" />
        </div>
        <Skeleton className="w-24 h-10 rounded-xl" />
      </div>

      {/* Bracket Rounds visual structure */}
      <div className="overflow-x-auto py-8">
        <div className="flex gap-12 min-w-max px-4">
          {/* Round of 4 */}
          <div className="flex flex-col justify-around gap-16 w-56">
            <div className="text-center font-medium text-xs text-gray-400 mb-2">Bán kết</div>
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <SkeletonLine width="1/2" className="h-4" />
                  <Skeleton className="w-6 h-4" />
                </div>
                <div className="border-t border-gray-100 my-1.5" />
                <div className="flex items-center justify-between">
                  <SkeletonLine width="3/4" className="h-4" />
                  <Skeleton className="w-6 h-4" />
                </div>
              </div>
            ))}
          </div>

          {/* Connective lines helper representation */}
          <div className="flex flex-col justify-center gap-32 w-56">
            <div className="text-center font-medium text-xs text-gray-400 mb-2">Chung kết</div>
            <div className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <SkeletonLine width="1/2" className="h-4" />
                <Skeleton className="w-6 h-4" />
              </div>
              <div className="border-t border-gray-100 my-1.5" />
              <div className="flex items-center justify-between">
                <SkeletonLine width="1/2" className="h-4" />
                <Skeleton className="w-6 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 4. Group Table Skeleton (for GroupStagePage.tsx)
export function GroupTableSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2 flex-1">
          <SkeletonLine width="1/2" className="h-6" />
          <SkeletonLine width="1/4" className="h-4" />
        </div>
      </div>

      {/* Grid of groups */}
      <div className="grid md:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <Skeleton className="w-24 h-6 rounded" />
            {/* Table Mock */}
            <div className="space-y-2">
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <Skeleton className="w-8 h-4" />
                <Skeleton className="w-32 h-4" />
                <Skeleton className="w-10 h-4" />
                <Skeleton className="w-10 h-4" />
              </div>
              {[...Array(3)].map((_, r) => (
                <div key={r} className="flex justify-between py-1.5">
                  <Skeleton className="w-4 h-4" />
                  <Skeleton className="w-24 h-4" />
                  <Skeleton className="w-6 h-4" />
                  <Skeleton className="w-6 h-4" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 5. Dashboard Table Skeleton (for Admin / General tables)
export function DashboardTableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <Skeleton className="w-32 h-6" />
        <Skeleton className="w-48 h-8 rounded-xl" />
      </div>
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {[...Array(cols)].map((_, i) => (
              <th key={i} className="px-6 py-3 text-left">
                <Skeleton className="w-16 h-4" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {[...Array(rows)].map((_, r) => (
            <tr key={r}>
              {[...Array(cols)].map((_, c) => (
                <td key={c} className="px-6 py-4">
                  <SkeletonLine width={c === 0 ? '1/4' : c === 1 ? '3/4' : '1/2'} className="h-4" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
