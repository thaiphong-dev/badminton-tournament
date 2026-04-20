import { Crown, Medal } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// Rank icons / row highlights
function RankCell({ rank, total }) {
  if (rank === 1) return (
    <span className="inline-flex items-center gap-1 font-bold text-yellow-600">
      <Crown className="w-3.5 h-3.5" /> 1
    </span>
  )
  if (rank === 2) return (
    <span className="inline-flex items-center gap-1 font-semibold text-blue-600">
      <Medal className="w-3.5 h-3.5" /> 2
    </span>
  )
  return <span className="text-gray-400">{rank}</span>
}

export default function StandingsTable({ standings, numQualify = 2 }) {
  if (!standings || standings.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-gray-400">
        Chưa có trận nào hoàn thành
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-8">#</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">VĐV</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-12" title="Điểm">Đ</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-10" title="Thắng">T</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-10" title="Thua">B</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-14" title="Điểm ghi">+</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-14" title="Điểm mất">-</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-16" title="Hiệu số">+/-</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {standings.map((s, idx) => {
            const willQualify = s.rank <= numQualify
            return (
              <tr
                key={s.player_id}
                className={cn(
                  'transition-colors',
                  s.rank === 1 && 'bg-yellow-50',
                  s.rank === 2 && 'bg-blue-50',
                  s.rank > 2 && 'hover:bg-gray-50',
                )}
              >
                <td className="px-3 py-2.5">
                  <RankCell rank={s.rank} total={standings.length} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col">
                    <span className={cn('font-medium', willQualify ? 'text-gray-900' : 'text-gray-600')}>
                      {s.player_name}
                    </span>
                    <span className="text-xs text-gray-400">{s.club}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className={cn(
                    'font-bold text-base',
                    s.rank === 1 && 'text-yellow-600',
                    s.rank === 2 && 'text-blue-600',
                    s.rank > 2 && 'text-gray-700',
                  )}>
                    {s.points}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center text-green-600 font-medium">{s.wins}</td>
                <td className="px-3 py-2.5 text-center text-red-400">{s.losses}</td>
                <td className="px-3 py-2.5 text-center text-gray-600">{s.score_for}</td>
                <td className="px-3 py-2.5 text-center text-gray-600">{s.score_against}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={cn(
                    'font-medium text-xs',
                    s.score_diff > 0 && 'text-green-600',
                    s.score_diff < 0 && 'text-red-500',
                    s.score_diff === 0 && 'text-gray-400',
                  )}>
                    {s.score_diff > 0 ? `+${s.score_diff}` : s.score_diff}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-4 px-3 py-2 border-t border-gray-100 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Nhất bảng
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Nhì bảng
        </span>
        <span className="ml-auto">Đ=điểm · T=thắng · B=thua · +/-=hiệu số</span>
      </div>
    </div>
  )
}
