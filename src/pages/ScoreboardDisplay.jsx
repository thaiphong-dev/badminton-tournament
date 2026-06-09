import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Maximize2, Minimize2, Wifi, WifiOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils/cn'

const STAGE_LABELS = {
  round_of_64: 'Round of 64', round_of_32: 'Round of 32', round_of_16: 'Round of 16',
  quarter: 'Quarter Final', semi: 'Semi Final', final: 'Final',
  third_place: '3rd Place Match', group: 'Group Stage',
}

export default function ScoreboardDisplay() {
  const { matchId } = useParams()
  const [match,      setMatch]      = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [realtimeOk, setRealtimeOk] = useState(false)

  const fetchMatch = useCallback(async () => {
    const { data } = await supabase
      .from('matches')
      .select(`
        id, stage, match_number, status,
        live_score_p1, live_score_p2,
        player1_scores, player2_scores,
        winner_id,
        player1:players!player1_id(id, name, club),
        player2:players!player2_id(id, name, club)
      `)
      .eq('id', matchId)
      .single()
    if (data) setMatch(data)
    setLoading(false)
  }, [matchId])

  useEffect(() => {
    fetchMatch()
    const channel = supabase
      .channel(`scoreboard-${matchId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'matches',
        filter: `id=eq.${matchId}`,
      }, () => fetchMatch())
      .subscribe(status => setRealtimeOk(status === 'SUBSCRIBED'))
    const interval = setInterval(fetchMatch, 30000)
    return () => {
      supabase.removeChannel(channel)
      setRealtimeOk(false)
      clearInterval(interval)
    }
  }, [matchId, fetchMatch])

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setFullscreen(false)
    }
  }

  if (loading) return (
    <div className="fixed inset-0 bg-[#0c0c14] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!match) return (
    <div className="fixed inset-0 bg-[#0c0c14] flex items-center justify-center">
      <p className="text-white/30 font-mono tracking-[0.3em] text-sm uppercase">Match not found</p>
    </div>
  )

  const p1 = match.player1
  const p2 = match.player2
  const s1arr = Array.isArray(match.player1_scores) ? match.player1_scores : []
  const s2arr = Array.isArray(match.player2_scores) ? match.player2_scores : []
  const isCompleted = match.status === 'completed'
  const liveP1 = match.live_score_p1 ?? 0
  const liveP2 = match.live_score_p2 ?? 0
  const p1Wins = s1arr.filter((s, i) => s > (s2arr[i] ?? 0)).length
  const p2Wins = s2arr.filter((s, i) => s > (s1arr[i] ?? 0)).length
  const currentSet = s1arr.length + (isCompleted ? 0 : 1)
  const stageLabel = STAGE_LABELS[match.stage] ?? match.stage?.replace(/_/g, ' ')

  const p1IsWinner  = isCompleted && match.winner_id === p1?.id
  const p2IsWinner  = isCompleted && match.winner_id === p2?.id
  const p1IsLeading = !isCompleted && liveP1 > liveP2
  const p2IsLeading = !isCompleted && liveP2 > liveP1

  return (
    <div className="fixed inset-0 bg-[#0c0c14] text-white flex flex-col select-none overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-8 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          {/* Stage */}
          <span className="text-xs font-bold text-amber-400 uppercase tracking-[0.2em]">
            {stageLabel}
          </span>
          {match.match_number && (
            <span className="text-xs text-white/20 font-mono">· #{match.match_number}</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {isCompleted ? (
            <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.25em] text-amber-400 uppercase">
              <span>🏆</span> Match Completed
            </span>
          ) : realtimeOk ? (
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-400 tracking-[0.25em] uppercase">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              Live
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[10px] text-white/20">
              <WifiOff className="w-3 h-3" /> Connecting…
            </span>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 text-white/20 hover:text-white/50 transition-colors"
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Main scoreboard ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-3">

        {/* Set status label */}
        <p className="text-[10px] font-bold text-white/20 tracking-[0.5em] uppercase mb-2">
          {isCompleted ? 'Match Completed' : `Set ${currentSet}`}
        </p>

        {/* ── Player rows ── */}
        <div className="w-full max-w-5xl space-y-3">

          {/* Column header row (only when sets played) */}
          {s1arr.length > 0 && (
            <div className="flex items-center pr-4 mb-1 opacity-40">
              <div className="w-2 shrink-0 mr-4" />
              <div className="flex-1 min-w-0" />
              {/* set dots spacer */}
              <div className="w-20 shrink-0 mr-6" />
              {/* set score headers */}
              <div className="flex items-center gap-2 mr-6">
                {s1arr.map((_, i) => (
                  <div key={i} className="w-12 text-center text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase">
                    Set {i + 1}
                  </div>
                ))}
              </div>
              {/* live score spacer */}
              <div className="w-28 text-right text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase">
                {isCompleted ? 'Final' : 'Score'}
              </div>
              <div className="w-8 shrink-0" />
            </div>
          )}

          <PlayerRow
            player={p1}
            setsWon={p1Wins}
            liveScore={liveP1}
            setScores={s1arr}
            oppSetScores={s2arr}
            isWinner={p1IsWinner}
            isLeading={p1IsLeading}
            color="rose"
          />

          {/* VS divider */}
          <div className="flex items-center gap-4 px-4">
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-[10px] font-black text-white/10 tracking-[0.4em]">VS</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          <PlayerRow
            player={p2}
            setsWon={p2Wins}
            liveScore={liveP2}
            setScores={s2arr}
            oppSetScores={s1arr}
            isWinner={p2IsWinner}
            isLeading={p2IsLeading}
            color="sky"
          />
        </div>

        {/* Sets tally */}
        {(p1Wins > 0 || p2Wins > 0) && (
          <div className="mt-4 flex items-center gap-6">
            <span className={cn('text-xs font-bold font-mono tracking-widest', p1Wins > p2Wins ? 'text-amber-400' : 'text-white/20')}>
              {p1?.name?.split(' ').pop()} {p1Wins}
            </span>
            <span className="text-white/10 text-xs">—</span>
            <span className={cn('text-xs font-bold font-mono tracking-widest', p2Wins > p1Wins ? 'text-amber-400' : 'text-white/20')}>
              {p2Wins} {p2?.name?.split(' ').pop()}
            </span>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-center pb-3 gap-2">
        <span className="text-[9px] text-white/[0.08] tracking-[0.4em] font-mono uppercase">
          Badminton Tournament Manager
        </span>
      </div>
    </div>
  )
}

/* ── Single player row ─────────────────────────────────────────────────────── */
function PlayerRow({ player, setsWon, liveScore, setScores, oppSetScores, isWinner, isLeading, color }) {
  const accentBar = color === 'rose' ? 'bg-rose-500' : 'bg-sky-400'

  return (
    <div className={cn(
      'flex items-center gap-4 px-4 py-5 rounded-2xl border transition-all duration-500',
      isWinner  ? 'bg-amber-400/[0.06] border-amber-400/20'  :
      isLeading ? 'bg-white/[0.04] border-white/[0.08]' :
                  'bg-white/[0.02] border-white/[0.04]',
    )}>

      {/* Color accent bar */}
      <div className={cn(
        'w-1 self-stretch rounded-full shrink-0 transition-opacity duration-500',
        accentBar,
        isWinner || isLeading ? 'opacity-80' : 'opacity-20',
      )} />

      {/* Name + club */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'font-black uppercase tracking-tight leading-none truncate transition-all duration-500',
          isWinner  ? 'text-amber-300 text-5xl md:text-6xl lg:text-7xl' :
          isLeading ? 'text-white text-5xl md:text-6xl lg:text-7xl' :
                      'text-white/40 text-5xl md:text-6xl lg:text-7xl',
        )}>
          {player?.name ?? 'TBD'}
        </p>
        {player?.club && (
          <p className="text-xs font-semibold tracking-[0.25em] text-white/20 uppercase mt-2 truncate">
            {player.club}
          </p>
        )}
      </div>

      {/* Sets won indicators */}
      <div className="flex flex-col items-center gap-1.5 shrink-0 w-16">
        <div className="flex gap-2">
          {[0, 1].map(i => (
            <div key={i} className={cn(
              'w-4 h-4 rounded-full transition-all duration-500',
              i < setsWon
                ? 'bg-amber-400 shadow-[0_0_10px_2px_rgba(251,191,36,0.4)]'
                : 'bg-white/8',
            )} />
          ))}
        </div>
        <span className="text-[8px] text-white/15 font-bold tracking-[0.2em] uppercase">Sets</span>
      </div>

      {/* Past set scores */}
      {setScores.length > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          {setScores.map((s, i) => {
            const opp = oppSetScores[i] ?? 0
            const won = s > opp
            return (
              <div key={i} className={cn(
                'w-12 h-12 flex items-center justify-center rounded-xl text-xl font-black tabular-nums border transition-all duration-300',
                won
                  ? 'border-amber-500/30 text-amber-300 bg-amber-400/10'
                  : 'border-white/6 text-white/20 bg-transparent',
              )}>
                {s}
              </div>
            )
          })}
        </div>
      )}

      {/* Live / final score — the hero number */}
      <div className={cn(
        'font-black tabular-nums leading-none text-right shrink-0 transition-all duration-500',
        'text-8xl md:text-9xl',
        isWinner  ? 'text-amber-300' :
        isLeading ? 'text-white' :
                    'text-white/25',
      )} style={{ minWidth: '6.5rem' }}>
        {liveScore}
      </div>

      {/* Trophy or spacer */}
      {isWinner
        ? <span className="text-3xl shrink-0">🏆</span>
        : <div className="w-8 shrink-0" />
      }
    </div>
  )
}
