import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Trophy, Users, ChevronRight, Loader2, Settings, LayoutList,
  GitBranch, Star, AlertCircle, Plus, X, Crown, MapPin, Calendar, ClipboardList,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  DISCIPLINE_LABELS, DISCIPLINE_ICONS, DISCIPLINE_LIST,
  EVENT_STATUS_LABELS, EVENT_STATUS_BADGE,
  STATUS_LABELS,
} from '@/lib/constants'
import { isTournamentComplete } from '@/lib/utils/eventHelpers'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Breadcrumb from '@/components/layout/Breadcrumb'
import { cn } from '@/lib/utils/cn'

// ── Helper: CTA route for an event ───────────────────────────────────────────
function eventRoute(tournamentId, eventId, status) {
  const base = `/tournament/${tournamentId}/event/${eventId}`
  switch (status) {
    case 'setup':       return `${base}/setup`
    case 'attendance':  return `${base}/attendance`
    case 'group_stage': return `${base}/groups`
    case 'knockout':    return `${base}/knockout`
    case 'completed':   return `${base}/results`
    default:            return `${base}/setup`
  }
}

function eventCTA(status) {
  switch (status) {
    case 'setup':       return 'Cấu hình'
    case 'attendance':  return 'Điểm danh'
    case 'group_stage': return 'Vòng bảng'
    case 'knockout':    return 'Knockout'
    case 'completed':   return 'Kết quả'
    default:            return 'Xem'
  }
}

function eventCTAIcon(status) {
  switch (status) {
    case 'setup':       return <Settings className="w-4 h-4" />
    case 'attendance':  return <ClipboardList className="w-4 h-4" />
    case 'group_stage': return <LayoutList className="w-4 h-4" />
    case 'knockout':    return <GitBranch className="w-4 h-4" />
    case 'completed':   return <Star className="w-4 h-4" />
    default:            return <ChevronRight className="w-4 h-4" />
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TournamentOverview() {
  const { id } = useParams()
  const [tournament, setTournament]   = useState(null)
  const [events, setEvents]           = useState([])
  const [matchStatsMap, setMatchStatsMap] = useState({})  // eventId → { total, completed }
  const [championMap, setChampionMap] = useState({})      // eventId → playerName
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    fetchData(true)

    const channel = supabase
      .channel(`tournament-overview-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events', filter: `tournament_id=eq.${id}` },
        () => fetchData(false)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` },
        (payload) => { if (payload.new) setTournament(payload.new) }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  async function fetchData(showLoading = true) {
    if (showLoading) setLoading(true)
    setError(null)
    try {
      const [tRes, eRes, mRes] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', id).single(),
        supabase.from('events').select('*').eq('tournament_id', id).order('sort_order'),
        supabase.from('matches').select('event_id, status, stage, winner_id').eq('tournament_id', id),
      ])
      if (tRes.error) throw tRes.error
      if (eRes.error) throw eRes.error

      setTournament(tRes.data)
      setEvents(eRes.data || [])

      // ── Build match stats per event ──────────────────────────────────────
      const stats = {}
      const finalWinners = {}  // eventId → winner_id
      for (const m of mRes.data || []) {
        if (!m.event_id) continue
        if (!stats[m.event_id]) stats[m.event_id] = { total: 0, completed: 0 }
        stats[m.event_id].total++
        if (m.status === 'completed') stats[m.event_id].completed++
        if (m.stage === 'final' && m.status === 'completed' && m.winner_id) {
          finalWinners[m.event_id] = m.winner_id
        }
      }
      setMatchStatsMap(stats)

      // ── Fetch champion names ─────────────────────────────────────────────
      const winnerIds = [...new Set(Object.values(finalWinners))]
      if (winnerIds.length > 0) {
        const { data: players } = await supabase
          .from('players').select('id, name').in('id', winnerIds)
        const playerMap = Object.fromEntries((players || []).map(p => [p.id, p.name]))
        setChampionMap(
          Object.fromEntries(
            Object.entries(finalWinners).map(([evId, pId]) => [evId, playerMap[pId] ?? null])
          )
        )
      } else {
        setChampionMap({})
      }
    } catch (err) {
      setError(err.message)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error || !tournament) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-600">{error || 'Không tìm thấy giải đấu.'}</p>
        <Link to="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline">← Trang chủ</Link>
      </div>
    )
  }

  const allDone        = isTournamentComplete(events)
  const usedDisciplines = new Set(events.map(e => e.discipline))
  const canAddEvent    = !allDone && usedDisciplines.size < DISCIPLINE_LIST.length

  // ── Quick stats ──────────────────────────────────────────────────────────
  const totalMatches     = Object.values(matchStatsMap).reduce((s, v) => s + v.total, 0)
  const completedMatches = Object.values(matchStatsMap).reduce((s, v) => s + v.completed, 0)
  const completedEvents  = events.filter(e => e.status === 'completed').length

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Breadcrumb */}
      <Breadcrumb
        className="mb-6"
        items={[
          { label: 'Trang chủ', href: '/' },
          { label: tournament.name },
        ]}
      />

      {/* Completed banner */}
      {allDone && (
        <div className="bg-linear-to-r from-yellow-400 to-orange-400 rounded-2xl px-6 py-4 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-white shrink-0" />
            <div>
              <p className="text-white font-bold">🎉 Giải đấu đã kết thúc!</p>
              <p className="text-yellow-100 text-sm">Tất cả nội dung thi đấu đã tìm ra nhà vô địch</p>
            </div>
          </div>
          <Link
            to={`/tournament/${id}/results`}
            className="shrink-0 flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            Xem tổng kết <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Tournament header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-gray-900">{tournament.name}</h1>
              <Badge variant={allDone ? 'green' : tournament.status === 'knockout' ? 'purple' : tournament.status === 'group_stage' ? 'blue' : 'yellow'}>
                {STATUS_LABELS[tournament.status] || tournament.status}
              </Badge>
            </div>

            {/* Meta row */}
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mb-3">
              {tournament.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />{tournament.location}
                </span>
              )}
              {tournament.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(tournament.start_date).toLocaleDateString('vi-VN')}
                  {tournament.end_date ? ` – ${new Date(tournament.end_date).toLocaleDateString('vi-VN')}` : ''}
                </span>
              )}
            </div>

            {/* Quick stats */}
            {events.length > 0 && (
              <div className="flex items-center gap-5 text-sm">
                <span className="text-gray-600">
                  <span className="font-semibold text-gray-900">{completedEvents}</span>
                  <span className="text-gray-400">/{events.length}</span>
                  <span className="text-gray-500 ml-1">nội dung xong</span>
                </span>
                {totalMatches > 0 && (
                  <span className="text-gray-600">
                    <span className="font-semibold text-gray-900">{completedMatches}</span>
                    <span className="text-gray-400">/{totalMatches}</span>
                    <span className="text-gray-500 ml-1">trận</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick event switcher strip (shown when 2+ active events) */}
      {events.filter(e => e.status !== 'setup').length >= 2 && (
        <div className="bg-white border border-gray-200 rounded-xl mb-4 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="flex min-w-max divide-x divide-gray-100">
              {events.filter(e => e.status !== 'setup').map(ev => {
                const icon  = DISCIPLINE_ICONS[ev.discipline] ?? '🏸'
                const label = DISCIPLINE_LABELS[ev.discipline] ?? ev.name
                const href  = eventRoute(id, ev.id, ev.status)
                const stripColor = {
                  completed: 'bg-green-400', knockout: 'bg-purple-400',
                  group_stage: 'bg-blue-400', attendance: 'bg-orange-400',
                }[ev.status] ?? 'bg-gray-200'
                return (
                  <Link
                    key={ev.id}
                    to={href}
                    className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 transition-colors group whitespace-nowrap"
                  >
                    <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', stripColor)} />
                    <span className="text-base leading-none">{icon}</span>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">
                      {label}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 transition-colors" />
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Section header: events + add button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">
          Nội dung thi đấu ({events.length})
        </h2>
        {canAddEvent && (
          <Button size="sm" variant="secondary" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" />
            Thêm nội dung
          </Button>
        )}
      </div>

      {/* Events grid */}
      {events.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-300 rounded-2xl">
          <p className="text-gray-400 text-sm mb-4">Chưa có nội dung thi đấu nào</p>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" />
            Thêm nội dung
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map(event => (
            <EventCard
              key={event.id}
              event={event}
              tournamentId={id}
              matchStats={matchStatsMap[event.id] ?? null}
              champion={championMap[event.id] ?? null}
            />
          ))}
        </div>
      )}

      {/* Add Event Modal */}
      {showAddModal && (
        <AddEventModal
          tournamentId={id}
          usedDisciplines={usedDisciplines}
          onClose={() => setShowAddModal(false)}
          onAdded={() => { setShowAddModal(false); fetchData(false) }}
        />
      )}
    </div>
  )
}

// ── Event card ────────────────────────────────────────────────────────────────
function EventCard({ event, tournamentId, matchStats, champion }) {
  const icon     = DISCIPLINE_ICONS[event.discipline] ?? '🏸'
  const label    = DISCIPLINE_LABELS[event.discipline] ?? event.name
  const ctaHref  = eventRoute(tournamentId, event.id, event.status)
  const progress = matchStats && matchStats.total > 0
    ? Math.round((matchStats.completed / matchStats.total) * 100)
    : null

  const stripColor = {
    completed:   'bg-green-400',
    knockout:    'bg-purple-400',
    group_stage: 'bg-blue-400',
    attendance:  'bg-orange-400',
    setup:       'bg-gray-200',
  }[event.status] ?? 'bg-gray-200'

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-blue-200 transition-all group">
      {/* Status strip */}
      <div className={`h-1.5 ${stripColor}`} />

      <div className="p-5">
        {/* Icon + name + badge */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl leading-none shrink-0">{icon}</span>
            <p className="font-semibold text-gray-900 text-sm truncate">{label}</p>
          </div>
          <Badge variant={EVENT_STATUS_BADGE[event.status] || 'default'} className="shrink-0">
            {EVENT_STATUS_LABELS[event.status] || event.status}
          </Badge>
        </div>

        {/* Champion row */}
        {event.status === 'completed' && champion && (
          <div className="flex items-center gap-1.5 mb-3 bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-1.5">
            <Crown className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
            <span className="text-xs font-semibold text-yellow-800 truncate">{champion}</span>
          </div>
        )}

        {/* Progress bar */}
        {progress !== null && event.status !== 'setup' && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>{matchStats.completed}/{matchStats.total} trận</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  event.status === 'completed' ? 'bg-green-400' : 'bg-blue-400'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Config summary */}
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
          {event.format === 'group_then_knockout' ? (
            <>
              <span className="flex items-center gap-1">
                <LayoutList className="w-3.5 h-3.5" />
                {event.num_groups ?? '–'} bảng
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {(event.num_first_place_qualify ?? 0) + (event.num_second_place_qualify ?? 0)} vào knockout
              </span>
            </>
          ) : event.format === 'knockout_only' ? (
            <span className="flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5" />
              Loại trực tiếp
            </span>
          ) : (
            <span className="text-gray-300 italic">Chưa cấu hình</span>
          )}
        </div>

        {/* CTA */}
        <Link
          to={ctaHref}
          className="flex items-center justify-between w-full px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors"
        >
          <span className="flex items-center gap-1.5">
            {eventCTAIcon(event.status)}
            {eventCTA(event.status)}
          </span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  )
}

// ── Add Event Modal ───────────────────────────────────────────────────────────
function AddEventModal({ tournamentId, usedDisciplines, onClose, onAdded }) {
  const [selected, setSelected] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  const available = DISCIPLINE_LIST.filter(d => !usedDisciplines.has(d.value))

  async function handleAdd() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const disc = DISCIPLINE_LIST.find(d => d.value === selected)
      const { error: err } = await supabase.from('events').insert({
        tournament_id: tournamentId,
        discipline:    selected,
        name:          disc?.label ?? selected,
        status:        'setup',
      })
      if (err) throw err
      onAdded()
    } catch (err) {
      setError(`Lỗi: ${err.message}`)
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Thêm nội dung thi đấu</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Discipline list */}
        <div className="px-6 py-4 space-y-2">
          {available.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Tất cả 5 nội dung đã được thêm.
            </p>
          ) : (
            available.map(d => (
              <button
                key={d.value}
                onClick={() => setSelected(d.value)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors',
                  selected === d.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                )}
              >
                <span className="text-xl">{d.icon}</span>
                <span className="font-medium text-gray-800 text-sm">{d.label}</span>
                {selected === d.value && (
                  <span className="ml-auto w-4 h-4 rounded-full bg-blue-500 shrink-0" />
                )}
              </button>
            ))
          )}

          {error && (
            <p className="text-sm text-red-600 mt-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Hủy</Button>
          <Button
            onClick={handleAdd}
            loading={saving}
            disabled={!selected || saving}
            className="flex-1"
          >
            Thêm
          </Button>
        </div>
      </div>
    </div>
  )
}
