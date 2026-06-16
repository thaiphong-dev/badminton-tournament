import { useMemo } from 'react'
import { Crown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Visual knockout bracket tree.
 *
 * Layout (left → right): [extra rounds...] → R16 → QF → SF → Final + 3rd Place
 *
 * Supports dynamic bracket sizes: 4, 8, 16, 32, 64 players.
 * Extra rounds (round_of_32, round_of_64) are prepended as columns to the left.
 */

// All possible pre-final rounds in order, largest first
const ROUND_DEFS = [
  { key: 'round_of_64', label: 'Vòng 1/32' },
  { key: 'round_of_32', label: 'Vòng 1/16' },
  { key: 'round_of_16', label: 'Vòng 1/8'  },
  { key: 'quarter',     label: 'Tứ kết'    },
  { key: 'semi',        label: 'Bán kết'   },
]

/**
 * containerRef – forward a ref here to use for image download from the parent.
 * tournamentName – shown as a title in the downloaded image.
 */
export default function BracketView({ matches, playerMap, onMatchClick, containerRef, tournamentName, rowHeight = 80 }) {
  const byStage = useMemo(() => {
    const map = {}
    matches.forEach(m => {
      if (!map[m.stage]) map[m.stage] = []
      map[m.stage].push(m)
    })
    Object.values(map).forEach(arr => arr.sort((a, b) => a.match_number - b.match_number))
    return map
  }, [matches])

  const fin   = byStage['final']?.[0]       ?? null
  const third = byStage['third_place']?.[0] ?? null

  // Only show rounds that actually have matches
  const visibleRounds = ROUND_DEFS.filter(r => (byStage[r.key] || []).length > 0)

  const firstCount     = visibleRounds.length > 0 ? (byStage[visibleRounds[0].key] || []).length : 8
  const BRACKET_HEIGHT = Math.max(rowHeight * 8, firstCount * rowHeight)

  return (
    <div className="bg-white rounded-xl overflow-x-auto pb-4">
      {/* inline-block wrapper = capture target */}
      <div ref={containerRef} className="inline-block bg-white p-4 rounded-xl">
        {tournamentName && (
          <p className="text-center text-sm font-semibold text-gray-500 mb-3 tracking-wide uppercase whitespace-nowrap">
            {tournamentName} · Sơ đồ giải đấu
          </p>
        )}
        <div className="flex items-stretch min-w-max" style={{ height: BRACKET_HEIGHT }}>

          {/* ── Dynamic pre-final rounds ── */}
          {visibleRounds.map((round, idx) => {
            const roundMatches = byStage[round.key] || []
            const nextCount    = idx + 1 < visibleRounds.length
              ? (byStage[visibleRounds[idx + 1].key] || []).length
              : 0
            const connectorCount = nextCount  // connectors = next round match count

            return (
              <div key={round.key} className="flex items-stretch">
                <RoundColumn label={round.label}>
                  {roundMatches.map((m, i) => (
                    <BracketCard
                      key={m.id}
                      match={m}
                      label={`T${i + 1}`}
                      playerMap={playerMap}
                      onClick={() => onMatchClick(m)}
                    />
                  ))}
                </RoundColumn>
                {connectorCount > 0 && <Connector count={connectorCount} />}
              </div>
            )
          })}

          {/* ── Final + 3rd Place ── */}
          <div className="flex flex-col" style={{ width: 180 }}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center pb-2 shrink-0">
              Chung kết
            </p>
            <div className="flex-1 flex flex-col justify-center gap-3">
              {fin ? (
                <BracketCard
                  match={fin}
                  label="Chung kết"
                  playerMap={playerMap}
                  onClick={() => onMatchClick(fin)}
                  gold
                />
              ) : (
                <PlaceholderCard label="Chung kết" />
              )}
              {third ? (
                <BracketCard
                  match={third}
                  label="Hạng 3"
                  playerMap={playerMap}
                  onClick={() => onMatchClick(third)}
                />
              ) : (
                <PlaceholderCard label="Hạng 3" />
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}


// ── Round column wrapper ──────────────────────────────────────────────────────

function RoundColumn({ label, children }) {
  return (
    <div className="flex flex-col" style={{ width: 180 }}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center pb-2 shrink-0">
        {label}
      </p>
      <div className="flex-1 flex flex-col justify-around">
        {children}
      </div>
    </div>
  )
}

// ── Connector column (bracket lines) ─────────────────────────────────────────
// count = number of bracket pairs (each pair = two halves: ⌐ and └)

function Connector({ count }) {
  return (
    <div
      className="flex flex-col self-stretch shrink-0"
      style={{ paddingTop: 24, width: 28 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex-1 flex flex-col">
          <div className="flex-1 border-r-2 border-b-2 border-gray-200" />
          <div className="flex-1 border-r-2 border-t-2 border-gray-200" />
        </div>
      ))}
    </div>
  )
}

// ── Bracket card ──────────────────────────────────────────────────────────────

function BracketCard({ match, label, playerMap, onClick, gold = false }) {
  const p1     = match.player1_id ? (playerMap[match.player1_id] ?? null) : null
  const p2     = match.player2_id ? (playerMap[match.player2_id] ?? null) : null
  const done   = match.status === 'completed'
  const isBye  = done && !!match.winner_id && (!match.player1_id || !match.player2_id)
  const canClick = !!(p1 && p2) && !isBye

  const scores1 = Array.isArray(match.player1_scores) ? match.player1_scores : []
  const scores2 = Array.isArray(match.player2_scores) ? match.player2_scores : []
  const p1Won = done && match.winner_id === match.player1_id
  const p2Won = done && match.winner_id === match.player2_id

  return (
    <button
      onClick={canClick ? onClick : undefined}
      disabled={!canClick}
      className={cn(
        'group w-full text-left border-2 rounded-lg px-2 pt-1.5 pb-2 mx-1 transition-all select-none',
        gold && done   && 'border-yellow-300 bg-yellow-50 hover:border-yellow-400',
        gold && !done  && 'border-yellow-200 bg-white hover:border-yellow-300',
        !gold && done     && canClick && 'border-green-200 bg-green-50/40 hover:border-blue-300',
        !gold && !done    && canClick && 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm',
        !gold && !canClick            && 'border-dashed border-gray-200 bg-gray-50 opacity-60 cursor-default',
      )}
    >
      <p className="text-gray-400 text-xs mb-1 font-medium">{label}</p>

      <PlayerLine
        player={p1}
        scores={scores1}
        opScores={scores2}
        isWinner={p1Won}
        isByeSlot={isBye && !p1}
      />

      <div className="text-center text-gray-300 text-xs leading-none my-0.5">vs</div>

      <PlayerLine
        player={p2}
        scores={scores2}
        opScores={scores1}
        isWinner={p2Won}
        isByeSlot={isBye && !p2}
      />
    </button>
  )
}

function PlayerLine({ player, scores, opScores, isWinner, isByeSlot }) {
  const scoreText = scores?.length > 0
    ? scores.map((s, i) => `${s}-${opScores?.[i] ?? 0}`).join(' ')
    : null

  return (
    <div className={cn(
      'flex items-center justify-between gap-1 rounded px-1 py-0.5',
      isWinner && 'bg-green-100',
    )}>
      <div className="flex items-center gap-1 min-w-0">
        {isWinner
          ? <Crown className="w-3 h-3 text-yellow-500 shrink-0" />
          : <div className="w-3 h-3 shrink-0" />
        }
        <span className={cn(
          'text-xs truncate',
          isWinner                  && 'font-bold text-gray-900',
          !isWinner && player       && 'text-gray-700',
          !player && isByeSlot      && 'font-semibold text-gray-400 uppercase tracking-wide',
          !player && !isByeSlot     && 'text-gray-300 italic',
        )}>
          {player?.name ?? (isByeSlot ? 'BYE' : 'TBD')}
        </span>
      </div>
      {scoreText && (
        <span className={cn(
          'text-xs shrink-0 tabular-nums',
          isWinner ? 'font-bold text-gray-800' : 'text-gray-400',
        )}>
          {scoreText}
        </span>
      )}
    </div>
  )
}

function PlaceholderCard({ label }) {
  return (
    <div className="border-2 border-dashed border-gray-200 rounded-lg px-2 py-3 mx-1 text-center opacity-50">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-xs text-gray-300 mt-0.5">Chờ dữ liệu</p>
    </div>
  )
}
