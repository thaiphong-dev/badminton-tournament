import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils/cn'
import { Wifi, WifiOff, Clock, CheckCircle2, PhoneCall } from 'lucide-react'

const STAGE_LABELS = {
  round_of_64: '1/32', round_of_32: '1/16', round_of_16: '1/8',
  quarter: 'Tứ kết', semi: 'Bán kết', final: 'Chung kết',
  third_place: 'Hạng 3', group: 'Vòng bảng',
}

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

    return () => { supabase.removeChannel(channel); setRealtimeOk(false) }
  }, [id, fetchData])

  const live      = matches.filter(m => m.status === 'active')
  const calling   = matches.filter(m => m.status === 'calling')
  const pending   = matches.filter(m => m.status === 'pending')
  const completed = matches.filter(m => m.status === 'completed')
    .sort((a, b) => (b.match_number ?? 0) - (a.match_number ?? 0))

  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">{t('live.title')}</p>
            <h1 className="text-sm font-bold text-gray-900 truncate">{tournament?.name}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {live.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                {live.length} sân đang đấu
              </span>
            )}
            {realtimeOk
              ? <Wifi className="w-4 h-4 text-green-500 shrink-0" />
              : <WifiOff className="w-4 h-4 text-gray-300 shrink-0" />
            }
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-6">

        {matches.length === 0 && (
          <div className="text-center py-24 text-gray-400">{t('live.noActiveMatches')}</div>
        )}

        {/* ── ĐANG THI ĐẤU ── */}
        {live.length > 0 && (
          <section>
            <SectionHeader
              dot="bg-green-500 animate-pulse"
              label="Đang thi đấu"
              count={live.length}
              countCls="bg-green-100 text-green-700"
            />
            <div className="space-y-3">
              {live
                .sort((a, b) => (a.court_number ?? 0) - (b.court_number ?? 0))
                .map(m => <LiveCard key={m.id} match={m} playerMap={playerMap} t={t} />)
              }
            </div>
          </section>
        )}

        {/* ── VÀO SÂN ── */}
        {calling.length > 0 && (
          <section>
            <SectionHeader
              dot="bg-amber-500 animate-pulse"
              label="Chuẩn bị vào sân"
              count={calling.length}
              countCls="bg-amber-100 text-amber-700"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {calling
                .sort((a, b) => (a.court_number ?? 0) - (b.court_number ?? 0))
                .map(m => <CompactCard key={m.id} match={m} playerMap={playerMap} variant="calling" t={t} />)
              }
            </div>
          </section>
        )}

        {/* ── CHỜ THI ĐẤU ── */}
        {pending.length > 0 && (
          <section>
            <SectionHeader
              dot="bg-gray-400"
              label="Chờ thi đấu"
              count={pending.length}
              countCls="bg-gray-100 text-gray-500"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {pending
                .sort((a, b) => (a.court_number ?? 0) - (b.court_number ?? 0))
                .map(m => <CompactCard key={m.id} match={m} playerMap={playerMap} variant="pending" t={t} />)
              }
            </div>
          </section>
        )}

        {/* ── ĐÃ KẾT THÚC ── */}
        {completed.length > 0 && (
          <section>
            <SectionHeader
              dot="bg-gray-300"
              label="Đã kết thúc"
              count={completed.length}
              countCls="bg-gray-100 text-gray-400"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {completed.map(m => <CompactCard key={m.id} match={m} playerMap={playerMap} variant="done" t={t} />)}
            </div>
          </section>
        )}

      </div>

      <p className="text-center pb-6 text-xs text-gray-300">Auto-update · no reload needed</p>
    </div>
  )
}

function SectionHeader({ dot, label, count, countCls }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={cn('w-2 h-2 rounded-full shrink-0', dot)} />
      <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wider">{label}</h2>
      <span className={cn('ml-1 text-xs font-bold px-1.5 py-0.5 rounded-full', countCls)}>{count}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

/* ── Live card: large, prominent ─────────────────────────────────────────── */
function LiveCard({ match, playerMap, t }) {
  const p1    = playerMap[match.player1_id]
  const p2    = playerMap[match.player2_id]
  const s1arr = Array.isArray(match.player1_scores) ? match.player1_scores : []
  const s2arr = Array.isArray(match.player2_scores) ? match.player2_scores : []
  const score1 = match.live_score_p1 ?? 0
  const score2 = match.live_score_p2 ?? 0
  const leading1 = score1 > score2
  const leading2 = score2 > score1

  return (
    <div className="bg-white border-2 border-green-400 rounded-2xl overflow-hidden shadow-sm">
      {/* top bar */}
      <div className="bg-green-50 border-b border-green-100 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs font-bold text-green-700 uppercase tracking-wide">
            Sân {match.court_number}
          </span>
          <span className="text-green-300 text-xs">·</span>
          <span className="text-xs text-green-600">
            {STAGE_LABELS[match.stage] ?? (t(`stage.${match.stage}`) || match.stage)}
          </span>
        </div>
        {/* set history inline */}
        {s1arr.length > 0 && (
          <div className="flex items-center gap-1.5">
            {s1arr.map((s1, i) => {
              const s2 = s2arr[i] ?? 0
              return (
                <div key={i} className="text-center min-w-[28px]">
                  <div className="text-[9px] text-green-400 font-bold leading-none mb-0.5">H{i+1}</div>
                  <div className="text-xs leading-none">
                    <span className={cn('font-bold', s1 > s2 ? 'text-gray-900' : 'text-gray-400')}>{s1}</span>
                    <span className="text-gray-300 mx-0.5">-</span>
                    <span className={cn('font-bold', s2 > s1 ? 'text-gray-900' : 'text-gray-400')}>{s2}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* score area */}
      <div className="px-4 py-3">
        {/* player 1 */}
        <div className={cn('flex items-center justify-between rounded-xl px-3 py-2 mb-1.5', leading1 ? 'bg-blue-50' : '')}>
          <span className={cn('text-sm truncate flex-1 min-w-0', leading1 ? 'font-bold text-gray-900' : 'text-gray-500')}>
            {p1?.name ?? 'TBD'}
            {p1?.club && <span className="text-gray-400 text-xs font-normal ml-1.5">· {p1.club}</span>}
          </span>
          <span className={cn('text-3xl font-black tabular-nums ml-3 shrink-0 w-10 text-right', leading1 ? 'text-blue-600' : 'text-gray-400')}>
            {score1}
          </span>
        </div>

        <div className="text-center text-[10px] text-gray-300 font-medium mb-1.5">VS</div>

        {/* player 2 */}
        <div className={cn('flex items-center justify-between rounded-xl px-3 py-2', leading2 ? 'bg-amber-50' : '')}>
          <span className={cn('text-sm truncate flex-1 min-w-0', leading2 ? 'font-bold text-gray-900' : 'text-gray-500')}>
            {p2?.name ?? 'TBD'}
            {p2?.club && <span className="text-gray-400 text-xs font-normal ml-1.5">· {p2.club}</span>}
          </span>
          <span className={cn('text-3xl font-black tabular-nums ml-3 shrink-0 w-10 text-right', leading2 ? 'text-amber-500' : 'text-gray-400')}>
            {score2}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── Compact card: calling / pending / done ──────────────────────────────── */
function CompactCard({ match, playerMap, variant, t }) {
  const p1   = playerMap[match.player1_id]
  const p2   = playerMap[match.player2_id]
  const done = variant === 'done'

  const s1arr = Array.isArray(match.player1_scores) ? match.player1_scores : []
  const s2arr = Array.isArray(match.player2_scores) ? match.player2_scores : []

  const borderCls = variant === 'calling' ? 'border-amber-300' : 'border-gray-200'
  const bgCls     = variant === 'calling' ? 'bg-amber-50/40' : 'bg-white'

  return (
    <div className={cn('rounded-xl border px-3 py-3 transition-all', borderCls, bgCls, done && 'opacity-60')}>
      {/* header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
            Sân {match.court_number}
          </span>
          <span className="text-gray-300 text-[10px]">·</span>
          <span className="text-[11px] text-gray-400">
            {STAGE_LABELS[match.stage] ?? (t(`stage.${match.stage}`) || match.stage)}
          </span>
        </div>
        {variant === 'calling' && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 animate-pulse">
            <PhoneCall className="w-3 h-3" /> Vào sân
          </span>
        )}
        {variant === 'pending' && (
          <span className="flex items-center gap-1 text-[10px] text-gray-400">
            <Clock className="w-3 h-3" /> Chờ
          </span>
        )}
        {done && (
          <span className="flex items-center gap-1 text-[10px] text-green-600">
            <CheckCircle2 className="w-3 h-3" /> Xong
          </span>
        )}
      </div>

      {/* set scores for done */}
      {done && s1arr.length > 0 && (
        <div className="flex items-center gap-2 mb-2 px-1">
          {s1arr.map((s1, i) => {
            const s2 = s2arr[i] ?? 0
            return (
              <div key={i} className="text-[10px] text-gray-500 font-mono">
                <span className={cn(s1 > s2 ? 'font-bold text-gray-800' : '')}>{s1}</span>
                <span className="text-gray-300">-</span>
                <span className={cn(s2 > s1 ? 'font-bold text-gray-800' : '')}>{s2}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* players */}
      <div className="space-y-1">
        <PlayerCompactRow
          player={p1}
          isWinner={done && match.winner_id === match.player1_id}
          isDone={done}
        />
        <div className="text-center text-[10px] text-gray-300">vs</div>
        <PlayerCompactRow
          player={p2}
          isWinner={done && match.winner_id === match.player2_id}
          isDone={done}
        />
      </div>
    </div>
  )
}

function PlayerCompactRow({ player, isWinner, isDone }) {
  return (
    <div className="flex items-center gap-1.5 px-1">
      {isWinner && <span className="text-[11px] shrink-0">🏆</span>}
      <span className={cn(
        'text-xs truncate',
        isWinner ? 'font-bold text-gray-900' : isDone ? 'text-gray-400' : 'text-gray-600',
      )}>
        {player?.name ?? 'TBD'}
      </span>
    </div>
  )
}
