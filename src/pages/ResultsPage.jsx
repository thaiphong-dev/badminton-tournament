import { useEffect, useState, useMemo, startTransition } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Trophy, Crown, Download,
  AlertCircle, Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { STATUS_LABELS, DISCIPLINE_LABELS, DISCIPLINE_ICONS, EVENT_STATUS_LABELS, EVENT_STATUS_BADGE } from '@/lib/constants'
import { exportTournamentResults } from '@/lib/utils/exportResults'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Breadcrumb from '@/components/layout/Breadcrumb'
import { cn } from '@/lib/utils/cn'

const STAGE_ORDER  = ['round_of_16', 'quarter', 'semi', 'final', 'third_place']
const STAGE_LABELS = {
  round_of_16: 'Vòng 1/8',
  quarter:     'Tứ kết',
  semi:        'Bán kết',
  final:       'Chung kết',
  third_place: 'Tranh hạng 3',
}

const STATUS_BADGE = {
  setup: 'yellow', group_stage: 'blue', knockout: 'purple', completed: 'green',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const { id, eventId } = useParams()

  const [tournament, setTournament]           = useState(null)
  const [event, setEvent]                     = useState(null)
  const [players, setPlayers]                 = useState([])
  const [knockoutMatches, setKnockoutMatches] = useState([])
  const [loading, setLoading]                 = useState(true)
  const [error, setError]                     = useState(null)
  const [exporting, setExporting]             = useState(false)

  async function fetchAll() {
    setLoading(true)
    setError(null)
    try {
      const tRes = await supabase.from('tournaments').select('*').eq('id', id).single()
      if (tRes.error) throw tRes.error
      setTournament(tRes.data)

      let ev = null
      if (eventId) {
        const eRes = await supabase.from('events').select('*').eq('id', eventId).single()
        if (eRes.error) throw eRes.error
        ev = eRes.data
        setEvent(ev)
      }

      const [pRes, mRes] = await Promise.all([
        eventId
          ? supabase.from('players').select('*').eq('event_id', eventId)
          : supabase.from('players').select('*').eq('tournament_id', id),
        eventId
          ? supabase.from('matches').select('*').eq('event_id', eventId).neq('stage', 'group').order('match_number')
          : supabase.from('matches').select('*').eq('tournament_id', id).neq('stage', 'group').order('match_number'),
      ])
      if (pRes.error) throw pRes.error
      if (mRes.error) throw mRes.error

      setPlayers(pRes.data || [])
      setKnockoutMatches(mRes.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { startTransition(() => { fetchAll() }) }, [id, eventId])

  const playerMap = useMemo(
    () => Object.fromEntries(players.map(p => [p.id, p])),
    [players]
  )

  const rankings = useMemo(() => {
    const fin   = knockoutMatches.find(m => m.stage === 'final')
    const third = knockoutMatches.find(m => m.stage === 'third_place')
    if (!fin?.winner_id) return null
    const finLoser    = fin.player1_id === fin.winner_id ? fin.player2_id : fin.player1_id
    const thirdLoser  = third?.winner_id
      ? (third.player1_id === third.winner_id ? third.player2_id : third.player1_id)
      : null
    return {
      first:  playerMap[fin.winner_id]  ?? null,
      second: playerMap[finLoser]       ?? null,
      third:  third?.winner_id ? (playerMap[third.winner_id] ?? null) : null,
      fourth: thirdLoser ? (playerMap[thirdLoser] ?? null) : null,
    }
  }, [knockoutMatches, playerMap])

  const matchesByStage = useMemo(() => {
    const map = {}
    knockoutMatches.forEach(m => {
      if (!map[m.stage]) map[m.stage] = []
      map[m.stage].push(m)
    })
    return map
  }, [knockoutMatches])

  function handleExport() {
    setExporting(true)
    try {
      exportTournamentResults(tournament, players, knockoutMatches, rankings, event ?? null)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setExporting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner size="lg" text="Đang tải..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-600 mb-4">{error}</p>
      </div>
    )
  }

  if (!tournament) return null

  const disciplineIcon  = event ? (DISCIPLINE_ICONS[event.discipline] ?? '🏸') : null
  const disciplineLabel = event ? (DISCIPLINE_LABELS[event.discipline] ?? event.name) : null
  const statusBadgeVar  = event
    ? (EVENT_STATUS_BADGE[event.status] || 'default')
    : (STATUS_BADGE[tournament.status] || 'default')
  const statusLabel = event
    ? (EVENT_STATUS_LABELS[event.status] || event.status)
    : (STATUS_LABELS[tournament.status] || tournament.status)
  const isCompleted    = (event?.status ?? tournament.status) === 'completed'
  const completedCount = knockoutMatches.filter(m => m.status === 'completed').length
  const knockoutHref   = eventId
    ? `/tournament/${id}/event/${eventId}/knockout`
    : `/tournament/${id}/knockout`

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Breadcrumb (per-event) or back link (legacy) */}
      {eventId ? (
        <Breadcrumb
          items={[
            { label: 'Trang chủ', href: '/' },
            { label: tournament.name, href: `/tournament/${id}` },
            { label: disciplineLabel, href: `/tournament/${id}/event/${eventId}/setup` },
            { label: 'Kết quả' },
          ]}
        />
      ) : (
        <Link
          to={knockoutHref}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Vòng Knockout
        </Link>
      )}

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center shrink-0 text-2xl">
              {disciplineIcon ?? <Trophy className="w-6 h-6 text-yellow-600" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">
                  {disciplineLabel ? `${disciplineLabel} — Kết quả` : tournament.name}
                </h1>
                <Badge variant={statusBadgeVar}>{statusLabel}</Badge>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {players.length} VĐV · {completedCount}/{knockoutMatches.length} trận knockout
              </p>
            </div>
          </div>

          {isCompleted && (
            <Button onClick={handleExport} loading={exporting} variant="secondary" size="sm">
              <Download className="w-4 h-4" />
              Xuất Excel
            </Button>
          )}
        </div>
      </div>

      {/* Podium */}
      {rankings ? (
        <PodiumSection rankings={rankings} />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Trophy className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Giải đấu chưa hoàn thành.</p>
          <Link
            to={knockoutHref}
            className="text-blue-600 text-sm underline mt-2 inline-block"
          >
            Quay lại nhập kết quả →
          </Link>
        </div>
      )}

      {/* Knockout results by stage */}
      {STAGE_ORDER
        .filter(s => matchesByStage[s]?.length > 0)
        .map(stage => (
          <StageResults
            key={stage}
            stage={stage}
            matches={matchesByStage[stage]}
            playerMap={playerMap}
          />
        ))}
    </div>
  )
}

// ── Podium ────────────────────────────────────────────────────────────────────

function PodiumSection({ rankings }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-linear-to-r from-yellow-400 to-amber-400 px-5 py-4 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-white" />
        <h2 className="font-bold text-white">Kết quả chung cuộc</h2>
      </div>

      <div className="p-6">
        {/* Top 3 podium blocks */}
        <div className="flex items-end justify-center gap-4 mb-6">
          <PodiumBlock rank={2} player={rankings.second} podiumH="h-20" />
          <PodiumBlock rank={1} player={rankings.first}  podiumH="h-28" gold />
          <PodiumBlock rank={3} player={rankings.third}  podiumH="h-16" />
        </div>

        {/* 4th place */}
        {rankings.fourth && (
          <div className="border-t border-gray-100 pt-4 flex items-center justify-center gap-3">
            <span className="text-sm font-medium text-gray-400">Hạng 4</span>
            <span className="text-gray-300">·</span>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700">{rankings.fourth.name}</p>
              <p className="text-xs text-gray-400">{rankings.fourth.club}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PodiumBlock({ rank, player, podiumH, gold = false }) {
  const medal = ['', '🥇', '🥈', '🥉'][rank] ?? rank
  const blockBg = gold ? 'bg-yellow-50 border-yellow-200' : rank === 2
    ? 'bg-gray-50 border-gray-200'
    : 'bg-orange-50 border-orange-200'
  const rankColor = gold ? 'text-yellow-600' : 'text-gray-500'

  return (
    <div className="flex flex-col items-center gap-2 w-36">
      {/* Badge + name */}
      <div className="text-center px-1">
        <span className="text-2xl">{medal}</span>
        <p className={cn('text-sm font-bold mt-1 truncate w-full', gold ? 'text-gray-900' : 'text-gray-700')}>
          {player?.name ?? '–'}
        </p>
        <p className="text-xs text-gray-400 truncate w-full">{player?.club ?? ''}</p>
      </div>
      {/* Podium block */}
      <div className={cn('w-full rounded-t-lg border-2 flex items-center justify-center', podiumH, blockBg)}>
        <span className={cn('text-3xl font-black', rankColor)}>{rank}</span>
      </div>
    </div>
  )
}

// ── Stage results ─────────────────────────────────────────────────────────────

function StageResults({ stage, matches, playerMap }) {
  const sorted    = [...matches].sort((a, b) => a.match_number - b.match_number)
  const completed = matches.filter(m => m.status === 'completed').length

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{STAGE_LABELS[stage]}</h3>
        <span className="text-xs text-gray-400 tabular-nums">{completed}/{matches.length} trận</span>
      </div>

      {/* Match rows */}
      <div className="divide-y divide-gray-50">
        {sorted.map(m => (
          <MatchRow key={m.id} match={m} playerMap={playerMap} />
        ))}
      </div>
    </div>
  )
}

function MatchRow({ match, playerMap }) {
  const p1   = match.player1_id ? (playerMap[match.player1_id] ?? null) : null
  const p2   = match.player2_id ? (playerMap[match.player2_id] ?? null) : null
  const done = match.status === 'completed'
  const p1Won = done && match.winner_id === match.player1_id
  const p2Won = done && match.winner_id === match.player2_id

  const s1 = Array.isArray(match.player1_scores) ? match.player1_scores : []
  const s2 = Array.isArray(match.player2_scores) ? match.player2_scores : []
  const scoreStr = s1.length > 0 ? s1.map((v, i) => `${v}–${s2[i] ?? 0}`).join('  ') : null

  return (
    <div className="px-4 py-2.5 flex items-center gap-3 text-sm">
      {/* Match number */}
      <span className="text-xs text-gray-400 w-5 shrink-0 tabular-nums">{match.match_number}</span>

      {/* Player 1 */}
      <div className={cn('flex-1 flex items-center gap-1.5 min-w-0', p1Won && 'font-semibold text-gray-900')}>
        {p1Won && <Crown className="w-3.5 h-3.5 text-yellow-500 shrink-0" />}
        <span className={cn('truncate', !p1Won && 'text-gray-600', !p1 && 'text-gray-300 italic')}>
          {p1?.name ?? 'TBD'}
        </span>
      </div>

      {/* Score */}
      <div className="shrink-0 text-center w-28">
        {done && scoreStr ? (
          <span className="text-xs font-mono text-gray-700 whitespace-nowrap">{scoreStr}</span>
        ) : done ? (
          <span className="text-xs text-gray-400">–</span>
        ) : (
          <span className="text-xs text-gray-300">chờ</span>
        )}
      </div>

      {/* Player 2 */}
      <div className={cn('flex-1 flex items-center gap-1.5 justify-end min-w-0', p2Won && 'font-semibold text-gray-900')}>
        <span className={cn('truncate', !p2Won && 'text-gray-600', !p2 && 'text-gray-300 italic')}>
          {p2?.name ?? 'TBD'}
        </span>
        {p2Won && <Crown className="w-3.5 h-3.5 text-yellow-500 shrink-0" />}
      </div>
    </div>
  )
}
