import { useEffect, useState, startTransition } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  CheckCheck, UserX, UserCheck, GitBranch, LayoutList,
  AlertCircle, Loader2, ArrowLeft, Info, Search,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { DISCIPLINE_LABELS, DISCIPLINE_ICONS } from '@/lib/constants'
import { advanceWinner } from '@/lib/utils/advanceWinner'
import { updateGroupStandingsInDB } from '@/lib/utils/standingsCalculator'
import Button from '@/components/ui/Button'
import Breadcrumb from '@/components/layout/Breadcrumb'
import { cn } from '@/lib/utils/cn'

export default function AttendancePage() {
  const { id: tournamentId, eventId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [tournament, setTournament] = useState(null)
  const [event, setEvent]           = useState(null)
  const [players, setPlayers]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [processing, setProcessing] = useState(null) // playerId being processed
  const [error, setError]           = useState(null)
  const [search, setSearch]         = useState('')

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const [tRes, eRes, pRes] = await Promise.all([
        supabase.from('tournaments').select('id, name, creator_id').eq('id', tournamentId).single(),
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase.from('players').select('*').eq('event_id', eventId).order('seed').order('name'),
      ])
      if (tRes.error) throw tRes.error
      if (eRes.error) throw eRes.error

      setTournament(tRes.data)
      const ev = eRes.data
      setEvent(ev)
      setPlayers(pRes.data || [])

      if (!ev.attendance_enabled) {
        navigate(`/tournament/${tournamentId}/event/${eventId}/setup`, { replace: true })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { startTransition(() => { fetchData() }) }, [eventId])

  // Compute W/O scores based on the event's scoring config.
  // Winner gets [pointsPerSet] (×2 sets if best-of-3), loser gets [0] (×2).
  function getForfeitScores(matchStage) {
    const rules     = event?.scoring_rules ?? {}
    const isBo3     = rules.isBestOf3 ?? ['semi', 'final', 'third_place'].includes(matchStage)
    const pts       = rules.pointsPerSet ?? 21
    const winScores = isBo3 ? [pts, pts] : [pts]
    const losScores = isBo3 ? [0,   0]   : [0]
    return { winScores, losScores }
  }

  // Process forfeit for a single absent player's pending matches
  async function processForfeitForPlayer(absentPlayerId, currentPlayers) {
    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .eq('event_id', eventId)
      .in('status', ['pending', 'active'])
      .or(`player1_id.eq.${absentPlayerId},player2_id.eq.${absentPlayerId}`)

    const updates   = []
    const forfeited = []

    for (const m of matches || []) {
      const p1Absent = m.player1_id === absentPlayerId
      const otherPlayerId = p1Absent ? m.player2_id : m.player1_id
      if (!otherPlayerId) continue

      // Don't forfeit if the other player is also absent
      const otherPlayer = currentPlayers.find(p => p.id === otherPlayerId)
      if (otherPlayer?.attendance === 'absent') continue

      const winnerId = otherPlayerId
      const { winScores, losScores } = getForfeitScores(m.stage)

      // p1Absent → player2 wins → player1_scores=losScores, player2_scores=winScores
      const p1Scores = p1Absent ? losScores : winScores
      const p2Scores = p1Absent ? winScores : losScores

      updates.push(
        supabase.from('matches').update({
          winner_id:      winnerId,
          is_forfeit:     true,
          status:         'completed',
          completed_at:   new Date().toISOString(),
          player1_scores: p1Scores,
          player2_scores: p2Scores,
        }).eq('id', m.id)
      )
      forfeited.push({
        ...m,
        winner_id:      winnerId,
        is_forfeit:     true,
        status:         'completed',
        player1_scores: p1Scores,
        player2_scores: p2Scores,
      })
    }

    if (updates.length === 0) return

    await Promise.all(updates)

    // Advance knockout forfeit winners
    for (const m of forfeited.filter(fm => fm.stage !== 'group')) {
      await advanceWinner({ ...m, tournament_id: tournamentId, event_id: eventId })
    }

    // Recalculate group standings
    const groupIds = [...new Set(
      forfeited.filter(fm => fm.stage === 'group' && fm.group_id).map(fm => fm.group_id)
    )]
    for (const gId of groupIds) {
      await updateGroupStandingsInDB(gId)
    }
  }

  async function handleAttendanceChange(playerId, newStatus) {
    const snapshot = players
    const newPlayers = players.map(p => p.id === playerId ? { ...p, attendance: newStatus } : p)
    setPlayers(newPlayers)
    setProcessing(playerId)

    try {
      const { error: err } = await supabase
        .from('players')
        .update({ attendance: newStatus })
        .eq('id', playerId)

      if (err) throw err

      // When marking absent, immediately forfeit that player's pending matches
      if (newStatus === 'absent') {
        await processForfeitForPlayer(playerId, newPlayers)
      }
    } catch (err) {
      setPlayers(snapshot)
      setError(`Lỗi cập nhật điểm danh: ${err.message}`)
    } finally {
      setProcessing(null)
    }
  }

  async function handleMarkAll() {
    const snapshot = players
    setPlayers(prev => prev.map(p => ({ ...p, attendance: 'present' })))

    const { error: err } = await supabase
      .from('players')
      .update({ attendance: 'present' })
      .eq('event_id', eventId)

    if (err) {
      setPlayers(snapshot)
      setError(`Lỗi: ${err.message}`)
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const presentCount = players.filter(p => p.attendance === 'present').length
  const absentCount  = players.filter(p => p.attendance === 'absent').length
  const pendingCount = players.filter(p => p.attendance === 'pending').length

  // Navigate back to the correct page based on event format
  const backHref = event?.format === 'knockout_only'
    ? `/tournament/${tournamentId}/event/${eventId}/knockout`
    : `/tournament/${tournamentId}/event/${eventId}/groups`
  const backLabel = event?.format === 'knockout_only' ? 'Xem sơ đồ' : 'Xem vòng bảng'
  const backIcon  = event?.format === 'knockout_only'
    ? <GitBranch className="w-4 h-4" />
    : <LayoutList className="w-4 h-4" />

  const q = search.trim().toLowerCase()
  const filteredPlayers = q
    ? players.filter(p => p.name.toLowerCase().includes(q) || (p.club ?? '').toLowerCase().includes(q))
    : players

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error && !event) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-600">{error}</p>
        <Link to="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline">← Trang chủ</Link>
      </div>
    )
  }

  const isCreator = !!profile && tournament?.creator_id === profile.id
  const canEdit   = !!profile && (isCreator || profile?.role === 'admin' || profile?.role === 'umpire')

  const disciplineIcon  = DISCIPLINE_ICONS[event?.discipline] ?? '🏸'
  const disciplineLabel = DISCIPLINE_LABELS[event?.discipline] ?? event?.name ?? '…'
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <Breadcrumb
        className="mb-6"
        items={[
          { label: 'Trang chủ', href: '/' },
          { label: tournament?.name ?? '…', href: `/tournament/${tournamentId}` },
          { label: disciplineLabel, href: `/tournament/${tournamentId}/event/${eventId}/setup` },
          { label: 'Điểm danh' },
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl leading-none">{disciplineIcon}</span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Điểm Danh VĐV</h1>
            <p className="text-sm text-gray-400">{disciplineLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkAll}
              disabled={!!processing}
            >
              <CheckCheck className="w-4 h-4" />
              Điểm danh tất cả
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => navigate(backHref)}
          >
            {backIcon}
            {backLabel}
          </Button>
        </div>
      </div>

      {/* Counter strip */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{presentCount}</p>
          <p className="text-xs text-green-600 mt-0.5">Có mặt</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{absentCount}</p>
          <p className="text-xs text-red-500 mt-0.5">Vắng mặt</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-600">{pendingCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Chờ điểm danh</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700 mb-4">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Đánh dấu vắng mặt sẽ <strong>tự động xử lý thua W/O</strong> tất cả trận đấu của VĐV đó.
          Trận đấu chỉ được kích hoạt khi cả hai VĐV đã điểm danh có mặt.
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600 text-xs">Đóng</button>
        </div>
      )}

      {/* Search */}
      {players.length > 0 && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc CLB..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 transition-colors bg-white"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Player list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {players.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            <p>Chưa có VĐV nào trong nội dung này.</p>
            <Link
              to={`/tournament/${tournamentId}/event/${eventId}/players`}
              className="text-blue-600 hover:underline mt-2 inline-block"
            >
              ← Quay lại import VĐV
            </Link>
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            Không tìm thấy VĐV nào khớp với "<span className="font-medium text-gray-600">{search}</span>"
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filteredPlayers.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                index={players.indexOf(player)}
                onChange={canEdit ? handleAttendanceChange : null}
                isProcessing={processing === player.id}
                disabled={!!processing || !canEdit}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Back to game page */}
      <div className="mt-4 flex justify-end">
        <Button onClick={() => navigate(backHref)}>
          {backIcon}
          {backLabel}
        </Button>
      </div>
    </div>
  )
}

// ── PlayerRow ─────────────────────────────────────────────────────────────────
function PlayerRow({ player, index, onChange, isProcessing, disabled }) {
  const status = player.attendance ?? 'pending'

  return (
    <li className={cn(
      'flex items-center gap-3 px-4 py-3 transition-colors',
      isProcessing ? 'bg-gray-50' : 'hover:bg-gray-50',
    )}>
      {/* Seed */}
      <span className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
        {isProcessing
          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
          : (player.seed ?? index + 1)
        }
      </span>

      {/* Name + club */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium truncate',
          status === 'absent' ? 'line-through text-gray-400' : 'text-gray-900',
        )}>
          {player.name}
        </p>
        {player.club && (
          <p className="text-xs text-gray-400 truncate">{player.club}</p>
        )}
      </div>

      {/* Status badge */}
      <AttendanceBadge status={status} />

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        {status === 'pending' && (
          <>
            <ActionBtn icon={<UserCheck className="w-3.5 h-3.5" />} label="Có mặt"  color="green" onClick={() => onChange(player.id, 'present')} disabled={disabled} />
            <ActionBtn icon={<UserX    className="w-3.5 h-3.5" />} label="Vắng"     color="red"   onClick={() => onChange(player.id, 'absent')}  disabled={disabled} />
          </>
        )}
        {status === 'present' && (
          <ActionBtn icon={<UserX className="w-3.5 h-3.5" />} label="Đánh dấu vắng"    color="red"   onClick={() => onChange(player.id, 'absent')}  disabled={disabled} />
        )}
        {status === 'absent' && (
          <ActionBtn icon={<UserCheck className="w-3.5 h-3.5" />} label="Đánh dấu có mặt" color="green" onClick={() => onChange(player.id, 'present')} disabled={disabled} />
        )}
      </div>
    </li>
  )
}

function AttendanceBadge({ status }) {
  const cls = {
    pending: 'bg-gray-100 text-gray-500',
    present: 'bg-green-100 text-green-700',
    absent:  'bg-red-100 text-red-600',
  }[status]
  const label = { pending: 'Chờ điểm danh', present: 'Có mặt', absent: 'Vắng mặt' }[status]
  return (
    <span className={cn('hidden sm:inline px-2 py-0.5 rounded-full text-xs font-medium shrink-0', cls)}>
      {label}
    </span>
  )
}

function ActionBtn({ icon, label, color, onClick, disabled }) {
  const cls = {
    green: 'bg-green-50 text-green-700 hover:bg-green-100',
    red:   'bg-red-50 text-red-600 hover:bg-red-100',
  }[color]
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40', cls)}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
