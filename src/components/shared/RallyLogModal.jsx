import { useState, useEffect } from 'react'
import { X, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils/cn'

/**
 * Props:
 *  matchId      – UUID of the match
 *  player1Id    – UUID of player/team 1 (used to resolve scorer_id)
 *  player2Id    – UUID of player/team 2
 *  player1Name  – display name for player/team 1
 *  player2Name  – display name for player/team 2
 *  onClose      – dismiss handler
 */
export default function RallyLogModal({ matchId, player1Id, player2Id, player1Name, player2Name, onClose }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchEvents() {
      const { data, error: err } = await supabase
        .from('match_events')
        .select('id, event_type, set_number, score_p1, score_p2, scorer_id, created_at')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true })
      if (err) { setError(err.message); setLoading(false); return }
      setEvents(data ?? [])
      setLoading(false)
    }
    fetchEvents()
  }, [matchId])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const bySet = events.reduce((acc, ev) => {
    const s = ev.set_number ?? 0
    if (!acc[s]) acc[s] = []
    acc[s].push(ev)
    return acc
  }, {})

  const sets = Object.keys(bySet).map(Number).sort((a, b) => a - b)
  const pointCount = events.filter(e => e.event_type === 'point').length
  const undoCount  = events.filter(e => e.event_type === 'undo').length
  const shuttleCount = events.filter(e => e.event_type === 'shuttle_change').length

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="min-w-0 flex-1 pr-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Rally Log</p>
            <h2 className="text-sm font-bold text-gray-900 truncate">
              {player1Name} <span className="text-gray-300 font-normal mx-1">vs</span> {player2Name}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Legend */}
        {!loading && !error && events.length > 0 && (
          <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-4 text-xs shrink-0">
            <span className="flex items-center gap-1.5 text-blue-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              {player1Name}
            </span>
            <span className="flex items-center gap-1.5 text-orange-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
              {player2Name}
            </span>
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-sm text-red-600 py-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">
              Không có dữ liệu rally cho trận này.
            </div>
          ) : (
            <div className="space-y-5">
              {sets.map(setNum => (
                <SetSection
                  key={setNum}
                  setNum={setNum}
                  events={bySet[setNum]}
                  player1Id={player1Id}
                  player2Id={player2Id}
                  player1Name={player1Name}
                  player2Name={player2Name}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer stats */}
        {!loading && !error && events.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400 shrink-0">
            <span>{pointCount} điểm</span>
            {undoCount > 0 && <span>{undoCount} undo</span>}
            {shuttleCount > 0 && <span>{shuttleCount} thay cầu</span>}
          </div>
        )}
      </div>
    </div>
  )
}

function SetSection({ setNum, events, player1Id, player2Id, player1Name, player2Name }) {
  const label = setNum === 0 ? 'Khởi động' : `Set ${setNum}`
  const points = events.filter(e => e.event_type === 'point')
  const lastPoint = points[points.length - 1]

  return (
    <div>
      {/* Set header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide shrink-0">{label}</span>
        {lastPoint && (
          <span className="text-xs tabular-nums text-gray-400 shrink-0">
            {lastPoint.score_p1}–{lastPoint.score_p2}
          </span>
        )}
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      <div className="space-y-0.5">
        {events.map((ev, idx) => {
          const prevPoint = idx > 0
            ? [...events].slice(0, idx).reverse().find(e => e.event_type === 'point')
            : null

          return (
            <EventRow
              key={ev.id}
              ev={ev}
              prevPoint={prevPoint}
              player1Id={player1Id}
              player2Id={player2Id}
              player1Name={player1Name}
              player2Name={player2Name}
            />
          )
        })}
      </div>
    </div>
  )
}

function EventRow({ ev, prevPoint, player1Id, player2Id, player1Name, player2Name }) {
  const { event_type, score_p1, score_p2, scorer_id } = ev

  if (event_type === 'match_start') {
    return <div className="text-xs text-blue-500 font-medium py-1 pl-1">▶ Bắt đầu trận</div>
  }

  if (event_type === 'set_end') {
    return (
      <div className="text-xs text-green-600 font-semibold py-1.5 pl-1">
        ✓ Kết thúc set · {score_p1}–{score_p2}
      </div>
    )
  }

  if (event_type === 'shuttle_change') {
    return <div className="text-xs text-purple-500 py-0.5 pl-1 italic">🏸 Thay cầu</div>
  }

  if (event_type === 'interval_end') {
    return <div className="text-xs text-gray-400 py-0.5 pl-1 text-center">— nghỉ giữa hiệp —</div>
  }

  if (event_type === 'undo') {
    return <div className="text-xs text-orange-400 py-0.5 pl-1">↩ Undo điểm</div>
  }

  if (event_type === 'redo') {
    return <div className="text-xs text-orange-400 py-0.5 pl-1">↪ Redo điểm</div>
  }

  if (event_type === 'point') {
    // Resolve who scored: prefer scorer_id, fall back to score delta
    let p1Scored = null
    if (scorer_id) {
      p1Scored = scorer_id === player1Id
    } else if (score_p1 != null && score_p2 != null && prevPoint) {
      p1Scored = score_p1 > (prevPoint.score_p1 ?? 0)
    } else if (score_p1 != null && score_p2 != null) {
      // first point in set: whichever went to 1
      p1Scored = score_p1 === 1
    }

    const isP1 = p1Scored === true
    const isP2 = p1Scored === false

    return (
      <div className={cn(
        'flex items-center gap-2 rounded px-2 py-1 text-xs',
        isP1 && 'bg-blue-50',
        isP2 && 'bg-orange-50',
      )}>
        {/* Score */}
        <span className="w-14 tabular-nums font-mono text-center shrink-0 text-gray-600 font-medium">
          {score_p1 ?? '?'}–{score_p2 ?? '?'}
        </span>

        {/* Scorer dot + name */}
        <span className={cn(
          'flex items-center gap-1 font-medium flex-1 truncate',
          isP1 && 'text-blue-600',
          isP2 && 'text-orange-600',
          !isP1 && !isP2 && 'text-gray-500',
        )}>
          <span className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            isP1 ? 'bg-blue-500' : isP2 ? 'bg-orange-500' : 'bg-gray-300',
          )} />
          {isP1 ? player1Name : isP2 ? player2Name : '—'}
        </span>
      </div>
    )
  }

  return null
}
