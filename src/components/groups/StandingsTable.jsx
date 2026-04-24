import { Crown, Medal, Info } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

function RankCell({ rank }) {
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

function DiffCell({ value }) {
  return (
    <span className={cn(
      'font-medium text-xs',
      value > 0 && 'text-green-600',
      value < 0 && 'text-red-500',
      value === 0 && 'text-gray-400',
    )}>
      {value > 0 ? `+${value}` : value}
    </span>
  )
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
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-10" title="Điểm tích lũy (2đ/thắng)">Đ</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-10" title="Số trận thắng">T</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-10" title="Số trận thua">B</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-12" title="Hiệu số hiệp (set thắng − set thua)">H</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-12" title="Tổng điểm ghi được">+</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-12" title="Tổng điểm để mất">−</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-14" title="Hiệu số điểm (ghi − mất)">+/−</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {standings.map(s => {
            const willQualify = s.rank <= numQualify
            // sets_diff: new field; fall back to wins-losses for old data
            const setsDiff = s.sets_diff ?? (s.wins - s.losses)
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
                  <RankCell rank={s.rank} />
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
                <td className="px-3 py-2.5 text-center"><DiffCell value={setsDiff} /></td>
                <td className="px-3 py-2.5 text-center text-gray-500 text-xs">{s.score_for}</td>
                <td className="px-3 py-2.5 text-center text-gray-500 text-xs">{s.score_against}</td>
                <td className="px-3 py-2.5 text-center"><DiffCell value={s.score_diff} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div className="border-t border-gray-100 px-3 py-2 space-y-1">
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Nhất bảng
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Nhì bảng
          </span>
          <span className="ml-auto">Đ=điểm · T=thắng · B=thua · H=hiệu số hiệp · +/−=hiệu số điểm</span>
        </div>
        <div className="flex items-start gap-1 text-xs text-gray-400">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          <span>Thứ tự xếp hạng: <strong className="text-gray-500">Thắng</strong> → <strong className="text-gray-500">Đối đầu trực tiếp</strong> → <strong className="text-gray-500">H (hiệu số hiệp)</strong> → <strong className="text-gray-500">+/− (hiệu số điểm)</strong></span>
        </div>
      </div>
    </div>
  )
}
