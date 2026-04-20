import { CheckCircle2, Clock, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export default function MatchList({ matches, playerMap, onMatchClick }) {
  if (!matches || matches.length === 0) {
    return <div className="text-center py-8 text-sm text-gray-400">Chưa có trận đấu nào</div>
  }

  // Group by round number
  const byRound = matches.reduce((acc, m) => {
    const r = m.round_number ?? 1
    if (!acc[r]) acc[r] = []
    acc[r].push(m)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {Object.entries(byRound).map(([round, roundMatches]) => (
        <div key={round}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
            Lượt {round}
          </p>
          <div className="space-y-2">
            {roundMatches.map(match => (
              <MatchCard
                key={match.id}
                match={match}
                playerMap={playerMap}
                onClick={() => onMatchClick(match)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function MatchCard({ match, playerMap, onClick }) {
  const p1   = playerMap[match.player1_id] ?? { name: '?', club: '' }
  const p2   = playerMap[match.player2_id] ?? { name: '?', club: '' }
  const done = match.status === 'completed'

  const scores1 = Array.isArray(match.player1_scores) ? match.player1_scores : []
  const scores2 = Array.isArray(match.player2_scores) ? match.player2_scores : []

  // For multi-set matches show all sets; group stage only has 1
  const scoreDisplay = scores1.map((s, i) => `${s}–${scores2[i] ?? 0}`).join('  ')

  const p1Won = done && match.winner_id === match.player1_id
  const p2Won = done && match.winner_id === match.player2_id

  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full text-left border rounded-xl px-4 py-3 transition-all cursor-pointer',
        done
          ? 'bg-green-50/60 border-green-200 hover:border-blue-300 hover:bg-blue-50'
          : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm',
      )}
    >
      <div className="flex items-center gap-3">

        {/* Player 1 */}
        <div className={cn('flex-1 min-w-0', p1Won && 'font-semibold')}>
          <p className={cn('text-sm truncate', p1Won ? 'text-gray-900' : 'text-gray-700')}>
            {p1.name}
          </p>
          <p className="text-xs text-gray-400 truncate">{p1.club}</p>
        </div>

        {/* Score / VS */}
        <div className="flex items-center gap-2 shrink-0">
          {done ? (
            <span className="text-sm font-bold text-gray-700 tabular-nums">{scoreDisplay}</span>
          ) : (
            <span className="text-gray-300 text-sm font-medium px-2">vs</span>
          )}
        </div>

        {/* Player 2 */}
        <div className={cn('flex-1 min-w-0 text-right', p2Won && 'font-semibold')}>
          <p className={cn('text-sm truncate', p2Won ? 'text-gray-900' : 'text-gray-700')}>
            {p2.name}
          </p>
          <p className="text-xs text-gray-400 truncate">{p2.club}</p>
        </div>

        {/* Status icon */}
        <div className="shrink-0 ml-1 relative w-5 h-5 flex items-center justify-center">
          {done ? (
            <>
              {/* Default: green check */}
              <CheckCircle2 className="w-4 h-4 text-green-500 group-hover:opacity-0 transition-opacity absolute" />
              {/* Hover: blue pencil */}
              <Pencil className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity absolute" />
            </>
          ) : (
            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </div>

      {/* Hint line */}
      <p className={cn(
        'text-xs mt-1.5 flex items-center gap-1',
        done
          ? 'text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity'
          : 'text-blue-500',
      )}>
        {done
          ? <><Pencil className="w-3 h-3" /> Chạm để chỉnh sửa</>
          : <><Clock className="w-3 h-3" /> Chạm để nhập điểm</>
        }
      </p>
    </button>
  )
}
