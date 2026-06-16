import { Trophy, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export default function MatchSummaryScreen({ state, player1, player2, saving, onConfirm }) {
  const { completedSets } = state
  const p1Sets  = completedSets.filter(s => s.p1 > s.p2).length
  const p2Sets  = completedSets.filter(s => s.p2 > s.p1).length
  const winner  = p1Sets > p2Sets ? player1 : player2
  const winSets = Math.max(p1Sets, p2Sets)
  const losSets = Math.min(p1Sets, p2Sets)

  return (
    <div className="fixed inset-0 bg-surface flex flex-col items-center justify-center px-6 overflow-y-auto py-8">
      <div className="w-full max-w-sm flex flex-col items-center gap-5">

        {/* Winner */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-amber-50 border-2 border-amber-400 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-10 h-10 text-amber-500" />
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Trận đấu kết thúc</p>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">{winner?.name}</h1>
          <p className="text-base font-semibold text-gray-500">
            Thắng <span className="text-blue-600 font-bold">{winSets}</span> – {losSets}
          </p>
        </div>

        {/* Set breakdown */}
        <div className="w-full bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          {/* Header */}
          <div className="flex items-center px-5 py-3 bg-gray-50 border-b border-gray-100">
            <span className="flex-1 text-left text-xs font-bold text-gray-500 uppercase tracking-wide truncate">{player1?.name}</span>
            <span className="w-11 text-center text-xs font-bold text-gray-400">Set</span>
            <span className="flex-1 text-right text-xs font-bold text-gray-500 uppercase tracking-wide truncate">{player2?.name}</span>
          </div>
          {completedSets.map((s, i) => {
            const p1Won = s.p1 > s.p2
            return (
              <div key={i} className="flex items-center px-5 py-4 border-b border-gray-50 last:border-0">
                <span className={cn('flex-1 text-left text-xl font-black font-mono', p1Won ? 'text-blue-600' : 'text-gray-300')}>
                  {s.p1}
                </span>
                <span className="w-11 text-center text-xs font-bold text-gray-300">S{i + 1}</span>
                <span className={cn('flex-1 text-right text-xl font-black font-mono', !p1Won ? 'text-blue-600' : 'text-gray-300')}>
                  {s.p2}
                </span>
              </div>
            )
          })}
        </div>

        {/* Shuttle count */}
        <p className="text-sm text-gray-400 font-medium">
          Tổng số cầu đã sử dụng:{' '}
          <span className="text-blue-600 font-bold">{state.shuttleCount || 0}</span> quả
        </p>

        {/* Save button */}
        <button
          onClick={onConfirm}
          disabled={saving}
          className="w-full py-5 rounded-2xl font-extrabold text-lg bg-amber-400 text-gray-900 shadow-lg shadow-amber-100 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving
            ? <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            : 'Lưu kết quả'
          }
        </button>
      </div>
    </div>
  )
}
