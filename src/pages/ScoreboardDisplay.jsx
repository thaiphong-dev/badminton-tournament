import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Maximize2, Minimize2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const STAGE_LABELS = {
  round_of_64: 'ROUND OF 64', round_of_32: 'ROUND OF 32', round_of_16: 'ROUND OF 16',
  quarter: 'QUARTER FINAL', semi: 'SEMI FINAL', final: 'FINAL',
  third_place: '3RD PLACE MATCH', group: 'GROUP STAGE',
}

export default function ScoreboardDisplay() {
  const { matchId } = useParams()
  const [match, setMatch]           = useState(null)
  const [loading, setLoading]       = useState(true)
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
    <div className="fixed inset-0 z-50 bg-[#050a14] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!match) return (
    <div className="fixed inset-0 z-50 bg-[#050a14] flex items-center justify-center">
      <p className="text-gray-500 font-mono tracking-widest text-sm">MATCH NOT FOUND</p>
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

  const stageLabel = STAGE_LABELS[match.stage] ?? match.stage?.toUpperCase().replace(/_/g, ' ')

  return (
    <div className="fixed inset-0 z-50 bg-[#050a14] text-white flex flex-col select-none overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-8 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-black tracking-[0.35em] text-yellow-500">
            {stageLabel}
          </span>
          {match.match_number && (
            <span className="text-[11px] text-white/20 font-mono tracking-widest">
              · #{match.match_number}
            </span>
          )}
        </div>

        <div className="flex items-center gap-5">
          {isCompleted ? (
            <span className="text-[10px] font-black tracking-[0.35em] text-amber-400 border border-amber-400/30 px-3 py-1">
              MATCH OVER
            </span>
          ) : realtimeOk ? (
            <span className="flex items-center gap-2 text-[10px] font-black tracking-[0.3em] text-green-400">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="text-[10px] text-white/20 tracking-[0.3em] font-mono">CONNECTING…</span>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 text-white/20 hover:text-white/60 transition-colors"
            title="Fullscreen"
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Main panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-10 gap-6">

        {/* Current set label */}
        <div className="text-[10px] font-black tracking-[0.6em] text-white/20">
          {isCompleted ? 'MATCH COMPLETED' : `SET ${currentSet} OF 3`}
        </div>

        {/* Score board */}
        <div className="w-full max-w-6xl">

          {/* Column headers — only when past sets exist */}
          {s1arr.length > 0 && (
            <div className="flex items-center pl-[4.5rem] pr-8 pb-2">
              <div className="flex-1" />
              <div className="flex items-center gap-2 mr-4">
                {s1arr.map((_, i) => (
                  <div key={i} className="w-14 text-center text-[8px] font-bold tracking-[0.25em] text-white/15">
                    SET {i + 1}
                  </div>
                ))}
              </div>
              <div className="w-32 text-right text-[8px] font-bold tracking-[0.25em] text-white/15">
                {isCompleted ? 'FINAL' : 'SCORE'}
              </div>
            </div>
          )}

          {/* Player 1 row */}
          <ScoreRow
            player={p1}
            setsWon={p1Wins}
            liveScore={liveP1}
            setScores={s1arr}
            oppSetScores={s2arr}
            isWinner={isCompleted && match.winner_id === p1?.id}
            isLeading={!isCompleted && liveP1 > liveP2}
            accent="red"
          />

          {/* Divider */}
          <div className="h-px bg-white/[0.06] mx-16 my-0" />

          {/* Player 2 row */}
          <ScoreRow
            player={p2}
            setsWon={p2Wins}
            liveScore={liveP2}
            setScores={s2arr}
            oppSetScores={s1arr}
            isWinner={isCompleted && match.winner_id === p2?.id}
            isLeading={!isCompleted && liveP2 > liveP1}
            accent="blue"
          />
        </div>

        {/* Sets tally — shown once a set is done */}
        {(p1Wins > 0 || p2Wins > 0) && (
          <div className="flex items-center gap-4 text-[10px] font-mono tracking-[0.3em] text-white/20">
            <span className={p1Wins > p2Wins ? 'text-amber-400' : ''}>
              {p1?.name?.split(' ').pop() ?? 'P1'} {p1Wins}
            </span>
            <span className="text-white/10">—</span>
            <span className={p2Wins > p1Wins ? 'text-amber-400' : ''}>
              {p2Wins} {p2?.name?.split(' ').pop() ?? 'P2'}
            </span>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="text-center pb-4 text-[9px] text-white/10 tracking-[0.4em] font-mono uppercase">
        Badminton Tournament Manager
      </div>
    </div>
  )
}

function ScoreRow({ player, setsWon, liveScore, setScores, oppSetScores, isWinner, isLeading, accent }) {
  const stripe = accent === 'red' ? 'bg-rose-500' : 'bg-sky-500'
  const stripeOpacity = isWinner || isLeading ? 'opacity-70' : 'opacity-15'

  return (
    <div className={`flex items-center gap-6 px-8 py-6 transition-colors duration-500 ${
      isWinner ? 'bg-amber-400/[0.04]' : isLeading ? 'bg-white/[0.015]' : ''
    }`}>

      {/* Accent stripe */}
      <div className={`w-1 self-stretch rounded-full shrink-0 ${stripe} ${stripeOpacity} transition-opacity duration-500`} />

      {/* Name + club */}
      <div className="flex-1 min-w-0">
        <div className={`font-black uppercase tracking-tight leading-none truncate transition-colors duration-500 ${
          isWinner ? 'text-amber-300 text-4xl md:text-5xl lg:text-6xl'
          : isLeading ? 'text-white text-4xl md:text-5xl lg:text-6xl'
          : 'text-white/50 text-4xl md:text-5xl lg:text-6xl'
        }`}>
          {player?.name ?? 'TBD'}
        </div>
        <div className="text-[11px] font-semibold tracking-[0.3em] text-white/20 uppercase mt-2 truncate">
          {player?.club ?? <span className="opacity-0">·</span>}
        </div>
      </div>

      {/* Sets won dots */}
      <div className="flex flex-col items-center gap-2 shrink-0">
        <div className="flex gap-2">
          {[0, 1].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-colors duration-500 ${
                i < setsWon ? 'bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.4)]' : 'bg-white/8'
              }`}
            />
          ))}
        </div>
        <div className="text-[8px] text-white/15 tracking-[0.25em] font-bold">SETS</div>
      </div>

      {/* Past set score boxes */}
      {setScores.length > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          {setScores.map((s, i) => {
            const opp = oppSetScores[i] ?? 0
            const won = s > opp
            return (
              <div
                key={i}
                className={`w-14 h-14 flex items-center justify-center rounded text-2xl font-black tabular-nums border transition-colors duration-300 ${
                  won
                    ? 'border-amber-500/30 text-amber-300 bg-amber-400/10'
                    : 'border-white/8 text-white/25 bg-white/[0.03]'
                }`}
              >
                {s}
              </div>
            )
          })}
        </div>
      )}

      {/* Current / final score — the big number */}
      <div className={`font-black tabular-nums leading-none text-right shrink-0 transition-colors duration-500 ${
        isWinner ? 'text-amber-300' : isLeading ? 'text-white' : 'text-white/25'
      } text-8xl md:text-9xl`}
        style={{ minWidth: '7rem' }}
      >
        {liveScore}
      </div>

      {/* Trophy for winner */}
      {isWinner ? (
        <div className="text-amber-400 text-2xl shrink-0">🏆</div>
      ) : (
        <div className="w-8 shrink-0" />
      )}
    </div>
  )
}
