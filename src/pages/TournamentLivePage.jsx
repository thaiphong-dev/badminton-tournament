import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils/cn'

const STATUS_ORDER = { active: 0, calling: 1, pending: 2, completed: 3 }

export default function TournamentLivePage() {
  const { id } = useParams()
  const { t } = useI18n()

  const [tournament, setTournament] = useState(null)
  const [matches, setMatches]       = useState([])
  const [playerMap, setPlayerMap]   = useState({})
  const [loading, setLoading]       = useState(true)
  const [realtimeOk, setRealtimeOk] = useState(false)

  const fetchData = useCallback(async () => {
    const [tRes, mRes] = await Promise.all([
      supabase.from('tournaments').select('id, name, status').eq('id', id).single(),
      supabase
        .from('matches')
        .select('id, stage, match_number, status, court_number, wave_number, player1_id, player2_id, live_score_p1, live_score_p2, player1_scores, player2_scores, winner_id')
        .eq('tournament_id', id)
        .not('court_number', 'is', null)
        .order('court_number'),
    ])
    if (tRes.data) setTournament(tRes.data)
    const mList = mRes.data ?? []
    setMatches(mList)

    const pIds = [...new Set(mList.flatMap(m => [m.player1_id, m.player2_id]).filter(Boolean))]
    if (pIds.length > 0) {
      const { data: pList } = await supabase.from('players').select('id, name, club').in('id', pIds)
      setPlayerMap(Object.fromEntries((pList ?? []).map(p => [p.id, p])))
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel(`live-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'matches',
        filter: `tournament_id=eq.${id}`,
      }, (payload) => {
        setMatches(prev => {
          const updated = prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m)
          if (payload.new.court_number && !prev.find(m => m.id === payload.new.id)) {
            return [...updated, payload.new]
          }
          return updated
        })
      })
      .subscribe((status) => setRealtimeOk(status === 'SUBSCRIBED'))

    return () => {
      supabase.removeChannel(channel)
      setRealtimeOk(false)
    }
  }, [id, fetchData])

  const sorted = [...matches].sort((a, b) => {
    const oa = STATUS_ORDER[a.status] ?? 9
    const ob = STATUS_ORDER[b.status] ?? 9
    if (oa !== ob) return oa - ob
    return (a.court_number ?? 0) - (b.court_number ?? 0)
  })

  const activeCount = matches.filter(m => m.status === 'active').length

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900/80 border-b border-gray-800 px-4 py-3 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">{t('live.title')}</p>
            <h1 className="text-base font-bold text-white truncate">{tournament?.name}</h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {activeCount > 0 && (
              <span className="text-xs font-semibold text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                {activeCount} {t('common.live').toLowerCase()}
              </span>
            )}
            {realtimeOk ? (
              <span className="text-xs text-green-500 font-semibold">● {t('common.live')}</span>
            ) : (
              <span className="text-xs text-gray-600">Polling</span>
            )}
          </div>
        </div>
      </div>

      {/* Match grid */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {sorted.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-gray-500 text-lg">{t('live.noActiveMatches')}</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map(m => (
              <LiveMatchCard key={m.id} match={m} playerMap={playerMap} t={t} />
            ))}
          </div>
        )}
      </div>

      <div className="text-center pb-6 text-xs text-gray-700">
        Auto-update · no reload needed
      </div>
    </div>
  )
}

function LiveMatchCard({ match, playerMap, t }) {
  const p1   = playerMap[match.player1_id]
  const p2   = playerMap[match.player2_id]
  const live    = match.status === 'active'
  const done    = match.status === 'completed'
  const calling = match.status === 'calling'

  const s1arr = Array.isArray(match.player1_scores) ? match.player1_scores : []
  const s2arr = Array.isArray(match.player2_scores) ? match.player2_scores : []

  const borderColor = live ? 'border-green-500/40' : done ? 'border-gray-700/50' : calling ? 'border-yellow-500/40' : 'border-gray-800'
  const bgColor     = live ? 'bg-gray-800/80' : done ? 'bg-gray-900/40' : 'bg-gray-900/60'

  return (
    <div className={cn('rounded-2xl border p-4 transition-all', borderColor, bgColor, done && 'opacity-60')}>
      {/* Card header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
            {t('live.court')} {match.court_number}
          </span>
          <span className="text-gray-600 text-xs">·</span>
          <span className="text-xs text-gray-500">{t(`stage.${match.stage}`) || match.stage}</span>
        </div>
        {live && (
          <span className="text-[10px] font-bold text-green-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            {t('common.live')}
          </span>
        )}
        {calling && (
          <span className="text-[10px] font-bold text-yellow-400 animate-pulse">📞</span>
        )}
        {done && (
          <span className="text-[10px] text-gray-500">✓ {t('live.completed')}</span>
        )}
        {!live && !done && !calling && (
          <span className="text-[10px] text-gray-600">{t('live.pending')}</span>
        )}
      </div>

      {/* Set history */}
      {s1arr.length > 0 && done && (
        <div className="flex items-center gap-2 mb-2">
          {s1arr.map((s1, i) => {
            const s2 = s2arr[i] ?? 0
            return (
              <div key={i} className="text-center">
                <div className="text-xs text-gray-600">{t('live.set')}{i+1}</div>
                <div className={cn('text-sm font-bold', s1 > s2 ? 'text-white' : 'text-gray-500')}>{s1}</div>
                <div className={cn('text-sm font-bold', s2 > s1 ? 'text-white' : 'text-gray-500')}>{s2}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Players */}
      <div className="space-y-2">
        <PlayerLiveRow
          player={p1}
          liveScore={live ? (match.live_score_p1 ?? 0) : null}
          isWinner={done && match.winner_id === match.player1_id}
          accentColor="cyan"
        />
        <div className="text-center text-gray-700 text-xs font-medium">vs</div>
        <PlayerLiveRow
          player={p2}
          liveScore={live ? (match.live_score_p2 ?? 0) : null}
          isWinner={done && match.winner_id === match.player2_id}
          accentColor="amber"
        />
      </div>
    </div>
  )
}

function PlayerLiveRow({ player, liveScore, isWinner, accentColor }) {
  const nameColor = isWinner
    ? (accentColor === 'cyan' ? 'text-cyan-300' : 'text-amber-300')
    : 'text-gray-300'

  return (
    <div className={cn(
      'flex items-center justify-between rounded-xl px-2 py-1',
      isWinner && (accentColor === 'cyan' ? 'bg-cyan-900/20' : 'bg-amber-900/20'),
    )}>
      <span className={cn('text-sm font-medium truncate flex-1 min-w-0', nameColor, isWinner && 'font-bold')}>
        {player?.name ?? 'TBD'}
        {player?.club && <span className="text-gray-600 text-xs font-normal ml-1">· {player.club}</span>}
      </span>
      {liveScore !== null && (
        <span className={cn(
          'text-2xl font-black tabular-nums ml-2 shrink-0',
          accentColor === 'cyan' ? 'text-cyan-400' : 'text-amber-400',
        )}>
          {liveScore}
        </span>
      )}
      {isWinner && <span className="ml-1.5 text-sm shrink-0">🏆</span>}
    </div>
  )
}
