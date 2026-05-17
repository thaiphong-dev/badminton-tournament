import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Layers } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useFeatures } from '@/lib/hooks/useFeatures'
import { useBTCRealtime } from '@/lib/hooks/useBTCRealtime'
import { DISCIPLINE_ICONS } from '@/lib/constants'
import { cn } from '@/lib/utils/cn'
import CourtBoard from '@/components/courts/CourtBoard'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function TournamentCourtsPage() {
  const { id }       = useParams()
  const { profile }  = useAuth()
  const { canUse }   = useFeatures()
  const canUseUmpire = canUse?.('umpire_system') ?? false

  const [tournament,       setTournament]       = useState(null)
  const [events,           setEvents]           = useState([])
  const [umpireMap,        setUmpireMap]        = useState({})
  const [selectedEventId,  setSelectedEventId]  = useState(null)
  const [eventData,        setEventData]        = useState({}) // { [eventId]: { matches, playerMap } }
  const [loading,          setLoading]          = useState(true)
  const [assignMatch,      setAssignMatch]      = useState(null) // eslint-disable-line no-unused-vars

  // ── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => { fetchBase() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchBase() {
    setLoading(true)
    const [tRes, evRes, umpRes] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).single(),
      supabase.from('events').select('*').eq('tournament_id', id).order('created_at'),
      supabase.from('tournament_umpires')
        .select('umpire_id, profiles!umpire_id(id, name, phone)')
        .eq('tournament_id', id),
    ])

    if (tRes.data) setTournament(tRes.data)

    const evs = evRes.data ?? []
    setEvents(evs)

    const map = {}
    for (const row of umpRes.data ?? []) {
      if (row.profiles) map[row.umpire_id] = row.profiles
    }
    setUmpireMap(map)

    // Fetch all event data in parallel, then pick first with active match as default
    const results = await Promise.all(evs.map(ev => fetchEventData(ev.id, true)))

    // Select first event that has active/calling match; otherwise first event
    let defaultId = evs[0]?.id ?? null
    for (let i = 0; i < evs.length; i++) {
      const d = results[i]
      if (d?.matches.some(m => m.status === 'active' || m.status === 'calling')) {
        defaultId = evs[i].id
        break
      }
    }
    setSelectedEventId(defaultId)
    setLoading(false)
  }

  // Returns the data object (also sets state)
  async function fetchEventData(eventId, returnData = false) {
    const [pRes, mRes] = await Promise.all([
      supabase.from('players').select('*').eq('event_id', eventId),
      supabase.from('matches').select('*').eq('event_id', eventId).order('match_number'),
    ])
    const players   = pRes.data ?? []
    const matches   = mRes.data ?? []
    const playerMap = Object.fromEntries(players.map(p => [p.id, p]))
    const data      = { matches, playerMap }
    setEventData(prev => ({ ...prev, [eventId]: data }))
    return returnData ? data : undefined
  }

  // ── Match update handler (from CourtBoard) ────────────────────────────────

  function handleMatchUpdated(eventId, updatedMatch) {
    setEventData(prev => {
      const ed = prev[eventId]
      if (!ed) return prev
      return {
        ...prev,
        [eventId]: {
          ...ed,
          matches: ed.matches.map(m => m.id === updatedMatch.id ? updatedMatch : m),
        },
      }
    })
  }

  // ── Realtime: update whichever event the match belongs to ─────────────────

  const handleRealtimeMatchUpdate = useCallback((updatedMatch) => {
    if (!updatedMatch?.event_id) return
    setEventData(prev => {
      const ed = prev[updatedMatch.event_id]
      if (!ed) return prev
      return {
        ...prev,
        [updatedMatch.event_id]: {
          ...ed,
          matches: ed.matches.map(m => m.id === updatedMatch.id ? { ...m, ...updatedMatch } : m),
        },
      }
    })
  }, [])

  useBTCRealtime(id, handleRealtimeMatchUpdate, null, '-courts')

  // ── Derived ───────────────────────────────────────────────────────────────

  const selectedEvent = events.find(e => e.id === selectedEventId) ?? null
  const selectedData  = selectedEventId ? (eventData[selectedEventId] ?? null) : null

  // Count active+calling across all events for header badge
  const totalActive = Object.values(eventData)
    .flatMap(d => d.matches)
    .filter(m => m.status === 'active' || m.status === 'calling').length

  if (loading) return (
    <div className="flex justify-center py-20"><LoadingSpinner /></div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link
          to={`/tournament/${id}`}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600 shrink-0" />
            <h1 className="text-lg font-bold text-gray-900 truncate">{tournament?.name}</h1>
            {totalActive > 0 && (
              <span className="shrink-0 px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-700 animate-pulse">
                {totalActive} đang đấu
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5 ml-6">Quản lý sân — tất cả nội dung</p>
        </div>
      </div>

      {/* ── Event tabs ── */}
      {events.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {events.map(ev => {
            const ed       = eventData[ev.id]
            const hasActive = ed?.matches.some(m => m.status === 'active' || m.status === 'calling')
            const isSelected = ev.id === selectedEventId
            return (
              <button
                key={ev.id}
                onClick={() => setSelectedEventId(ev.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0',
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600',
                )}
              >
                <span>{DISCIPLINE_ICONS[ev.discipline] ?? '🏸'}</span>
                <span>{ev.name ?? ev.discipline}</span>
                {hasActive && (
                  <span className={cn(
                    'w-2 h-2 rounded-full animate-pulse shrink-0',
                    isSelected ? 'bg-orange-300' : 'bg-orange-400',
                  )} />
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ── CourtBoard for selected event ── */}
      {events.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">Giải chưa có nội dung nào.</p>
          <Link
            to={`/tournament/${id}`}
            className="mt-3 inline-block text-sm text-blue-600 hover:underline"
          >
            ← Quay lại tổng quan
          </Link>
        </div>
      ) : selectedEvent && selectedData ? (
        <CourtBoard
          key={selectedEventId}
          event={selectedEvent}
          matches={selectedData.matches}
          playerMap={selectedData.playerMap}
          scoringRules={selectedEvent.scoring_rules ?? null}
          onMatchUpdated={m => handleMatchUpdated(selectedEventId, m)}
          onRefresh={() => fetchEventData(selectedEventId)}
          umpireMap={umpireMap}
          onAssignUmpire={canUseUmpire ? setAssignMatch : null}
          tournamentId={id}
        />
      ) : (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      )}
    </div>
  )
}
