import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Maximize2, Minimize2, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function ScoreboardDisplay() {
  const { matchId } = useParams()
  const [match, setMatch]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)

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
    if (data) {
      setMatch(data)
      setLastUpdate(new Date())
    }
    setLoading(false)
  }, [matchId])

  useEffect(() => {
    fetchMatch()

    // Realtime subscription
    const channel = supabase
      .channel(`scoreboard-${matchId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'matches',
        filter: `id=eq.${matchId}`,
      }, () => fetchMatch())
      .subscribe()

    // Fallback: auto-refresh every 10s if Realtime disconnects
    const interval = setInterval(fetchMatch, 10000)

    return () => {
      supabase.removeChannel(channel)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-xl">Không tìm thấy trận đấu</p>
      </div>
    )
  }

  const p1 = match.player1
  const p2 = match.player2
  const s1arr = Array.isArray(match.player1_scores) ? match.player1_scores : []
  const s2arr = Array.isArray(match.player2_scores) ? match.player2_scores : []
  const isCompleted = match.status === 'completed'
  const liveP1 = match.live_score_p1 ?? 0
  const liveP2 = match.live_score_p2 ?? 0

  const p1Wins = s1arr.filter((s, i) => s > (s2arr[i] ?? 0)).length
  const p2Wins = s2arr.filter((s, i) => s > (s1arr[i] ?? 0)).length

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900/80 border-b border-gray-800">
        <div className="text-sm text-gray-400 font-mono">
          {match.stage?.toUpperCase()} · Trận {match.match_number}
          {isCompleted && <span className="ml-3 text-green-400 font-semibold">KẾT THÚC</span>}
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-gray-600 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              {lastUpdate.toLocaleTimeString('vi-VN', { timeStyle: 'short' })}
            </span>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="Toàn màn hình"
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main scoreboard */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">

        {/* Set history */}
        {s1arr.length > 0 && (
          <div className="flex items-center gap-3">
            {s1arr.map((s1, i) => {
              const s2 = s2arr[i] ?? 0
              return (
                <div key={i} className="text-center">
                  <div className="text-xs text-gray-500 mb-1">Set {i + 1}</div>
                  <div className={`text-2xl font-bold px-3 py-1 rounded-lg ${
                    s1 > s2 ? 'text-yellow-300 bg-yellow-900/30' : 'text-gray-400'
                  }`}>{s1}</div>
                  <div className="text-gray-600 text-sm my-0.5">–</div>
                  <div className={`text-2xl font-bold px-3 py-1 rounded-lg ${
                    s2 > s1 ? 'text-yellow-300 bg-yellow-900/30' : 'text-gray-400'
                  }`}>{s2}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Player rows */}
        <div className="w-full max-w-4xl space-y-4">
          {/* Player 1 */}
          <PlayerRow
            player={p1}
            setsWon={p1Wins}
            liveScore={liveP1}
            isWinner={isCompleted && match.winner_id === p1?.id}
            isLeading={!isCompleted && liveP1 > liveP2}
          />

          {/* VS divider */}
          <div className="text-center text-gray-700 text-xl font-bold tracking-widest">VS</div>

          {/* Player 2 */}
          <PlayerRow
            player={p2}
            setsWon={p2Wins}
            liveScore={liveP2}
            isWinner={isCompleted && match.winner_id === p2?.id}
            isLeading={!isCompleted && liveP2 > liveP1}
          />
        </div>
      </div>
    </div>
  )
}

function PlayerRow({ player, setsWon, liveScore, isWinner, isLeading }) {
  return (
    <div className={`flex items-center justify-between rounded-2xl px-8 py-5 transition-colors ${
      isWinner
        ? 'bg-yellow-900/40 border border-yellow-500/50'
        : isLeading
          ? 'bg-gray-800/80 border border-gray-600'
          : 'bg-gray-900/60 border border-gray-800'
    }`}>
      <div className="flex-1 min-w-0">
        <div className={`font-bold truncate ${
          isWinner ? 'text-yellow-300 text-5xl' : 'text-white text-5xl'
        }`}>
          {player?.name ?? 'TBD'}
        </div>
        {player?.club && (
          <div className="text-gray-500 text-xl mt-1 truncate">{player.club}</div>
        )}
      </div>
      <div className="flex items-center gap-6 shrink-0">
        {/* Sets won */}
        <div className="text-center">
          <div className="text-gray-500 text-sm mb-1">Hiệp</div>
          <div className={`text-4xl font-bold ${isWinner ? 'text-yellow-300' : 'text-gray-300'}`}>
            {setsWon}
          </div>
        </div>
        {/* Live score */}
        <div className={`text-8xl font-black tabular-nums w-36 text-right ${
          isWinner ? 'text-yellow-300' : isLeading ? 'text-white' : 'text-gray-400'
        }`}>
          {liveScore}
        </div>
        {isWinner && (
          <div className="text-3xl">🏆</div>
        )}
      </div>
    </div>
  )
}
