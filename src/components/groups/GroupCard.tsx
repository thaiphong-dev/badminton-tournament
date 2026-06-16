import { cn } from '@/lib/utils/cn'

// Club color palette – cycles through colors per unique club name
const CLUB_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-green-100 text-green-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
  'bg-yellow-100 text-yellow-700',
  'bg-red-100 text-red-700',
]

// Build a stable club→color map from the full player list
export function buildClubColorMap(allPlayers) { // eslint-disable-line react-refresh/only-export-components
  const clubs = [...new Set(allPlayers.map(p => p.club).filter(c => c !== 'Tự do'))]
  return Object.fromEntries(clubs.map((c, i) => [c, CLUB_COLORS[i % CLUB_COLORS.length]]))
}

export default function GroupCard({ group, groupIndex, clubColorMap = {}, compact = false }) {
  const label = String.fromCharCode(65 + groupIndex) // A, B, C …

  return (
    <div className={cn(
      'bg-white border border-gray-200 rounded-xl overflow-hidden',
      compact ? '' : 'shadow-sm hover:shadow-md transition-shadow'
    )}>
      {/* Header */}
      <div className="bg-linear-to-r from-blue-600 to-blue-500 px-4 py-2.5 flex items-center justify-between">
        <span className="text-white font-bold text-sm tracking-wide">Bảng {label}</span>
        <span className="text-blue-100 text-xs">{group.length} VĐV</span>
      </div>

      {/* Players */}
      <ul className="divide-y divide-gray-50">
        {group.map((player, idx) => {
          const isTuDo = player.club === 'Tự do'
          const colorClass = isTuDo
            ? 'bg-gray-100 text-gray-500'
            : (clubColorMap[player.club] ?? CLUB_COLORS[0])

          return (
            <li key={player.id || player._key || idx} className="px-4 py-2.5 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <span className="text-xs text-gray-400 w-4 shrink-0 pt-0.5">{idx + 1}</span>
                <span className="text-sm font-medium text-gray-900 leading-snug">{player.name}</span>
              </div>
              <span className={cn('text-xs px-2 py-0.5 rounded-full shrink-0 font-medium mt-0.5', colorClass)}>
                {player.club}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
