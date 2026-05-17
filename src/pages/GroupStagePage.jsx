import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/hooks/useAuth'
import { useFeatures } from '@/lib/hooks/useFeatures'
import { ArrowLeft, Trophy, Users, LayoutGrid, Loader2, ClipboardList, Grid, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/hooks/useApiError'
import { STATUS_LABELS, DISCIPLINE_LABELS, DISCIPLINE_ICONS, EVENT_STATUS_LABELS, EVENT_STATUS_BADGE } from '@/lib/constants'
import { exportScheduleToExcel } from '@/lib/utils/exportResults'
import { calculateStandings } from '@/lib/utils/standingsCalculator'
import Badge from '@/components/ui/Badge'
import GroupRandomizer from '@/components/groups/GroupRandomizer'
import DrawLottery from '@/components/groups/DrawLottery'
import StandingsTable from '@/components/groups/StandingsTable'
import MatchList from '@/components/groups/MatchList'
import ScoreModal from '@/components/shared/ScoreModal'
import QualifySection from '@/components/groups/QualifySection'
import Breadcrumb from '@/components/layout/Breadcrumb'
import CourtBoard from '@/components/courts/CourtBoard'
import UmpireAssignModal from '@/components/tournament/UmpireAssignModal'
import RallyLogModal from '@/components/shared/RallyLogModal'

const STATUS_BADGE = {
  setup: 'yellow', group_stage: 'blue', knockout: 'purple', completed: 'green',
}

export default function GroupStagePage() {
  const { id, eventId } = useParams()   // eventId is undefined on legacy routes
  const navigate = useNavigate()
  const { role } = useAuth()
  const { hasFeature } = useFeatures()
  const canUseUmpire = role === 'admin' || hasFeature('umpire_assign')

  const [tournament, setTournament] = useState(null)
  const [event, setEvent]           = useState(null)
  const [players, setPlayers]       = useState([])
  const [groups, setGroups]         = useState([])
  const [matches, setMatches]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  const [activeTab, setActiveTab]   = useState({ type: 'group', idx: 0 })
  const [scoreMatch, setScoreMatch] = useState(null)
  const [drawMode, setDrawMode]     = useState('auto') // 'auto' | 'lottery'
  const [umpireMap, setUmpireMap]   = useState({})     // umpireId → { name, phone }
  const [assignMatch, setAssignMatch] = useState(null) // match to assign umpire
  const [rallyMatch, setRallyMatch]   = useState(null) // match to view rally log

  useEffect(() => {
    fetchAll()
    fetchUmpireMap()
  }, [id, eventId])

  async function fetchUmpireMap() {
    const { data } = await supabase
      .from('tournament_umpires')
      .select('umpire_id, profiles!umpire_id(id, name, phone)')
      .eq('tournament_id', id)
    const map = {}
    for (const row of data || []) {
      if (row.profiles) map[row.umpire_id] = row.profiles
    }
    setUmpireMap(map)
  }

  // ── Data fetching ───────────────────────────────────────────────────────────
  async function fetchAll() {
    setLoading(true)
    setError(null)
    try {
      // Always fetch tournament
      const tRes = await supabase.from('tournaments').select('*').eq('id', id).single()
      if (tRes.error) throw tRes.error
      setTournament(tRes.data)

      // Fetch event when in per-event route
      let ev = null
      if (eventId) {
        const eRes = await supabase.from('events').select('*').eq('id', eventId).single()
        if (eRes.error) throw eRes.error
        ev = eRes.data
        setEvent(ev)
      }

      // Scope players / groups / matches to event when available, else to tournament
      const [pRes, gRes, mRes] = await Promise.all([
        eventId
          ? supabase.from('players').select('*').eq('event_id', eventId).order('name')
          : supabase.from('players').select('*').eq('tournament_id', id).order('name'),
        eventId
          ? supabase.from('groups').select('*, group_players(*, players(id, name, club))').eq('event_id', eventId).order('group_number')
          : supabase.from('groups').select('*, group_players(*, players(id, name, club))').eq('tournament_id', id).order('group_number'),
        eventId
          ? supabase.from('matches').select('*').eq('event_id', eventId).eq('stage', 'group').order('match_number')
          : supabase.from('matches').select('*').eq('tournament_id', id).eq('stage', 'group').order('match_number'),
      ])

      if (pRes.error) throw pRes.error
      if (gRes.error) throw gRes.error
      if (mRes.error) throw mRes.error

      setPlayers(pRes.data || [])
      setGroups(gRes.data || [])
      setMatches(mRes.data || [])
    } catch (err) {
      console.error(err)
      setError('Không thể tải dữ liệu.')
    } finally {
      setLoading(false)
    }
  }

  // ── Derived data ────────────────────────────────────────────────────────────
  const playerMap    = useMemo(() => Object.fromEntries(players.map(p => [p.id, p])), [players])

  const enrichedGroups = useMemo(() => {
    return groups.map(g => {
      const gPlayers = (g.group_players || []).map(gp => gp.players).filter(Boolean)
      const gMatches = matches.filter(m => m.group_id === g.id)
      const completed = gMatches.filter(m => m.status === 'completed').length
      const total     = gMatches.length
      const standings = calculateStandings(gMatches, gPlayers, { tiebreakerMode: event?.tiebreaker_mode ?? 'bwf' })
      return { ...g, players: gPlayers, matches: gMatches, completed, total, standings }
    })
  }, [groups, matches, event?.tiebreaker_mode])

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleMatchSaved(updatedMatch) {
    setMatches(prev => prev.map(m => m.id === updatedMatch.id ? updatedMatch : m))
    setScoreMatch(null)
  }

  function handleCourtMatchUpdated(updatedMatch) {
    setMatches(prev => prev.map(m => m.id === updatedMatch.id ? updatedMatch : m))
  }

  // NR10: nhắc BTC khi tất cả trận vòng bảng xong
  const hasToastedAllDone = useRef(false)
  useEffect(() => { hasToastedAllDone.current = false }, [id])
  useEffect(() => {
    if (!matches.length || hasToastedAllDone.current) return
    const allDone = matches.every(m => m.status === 'completed' || m.status === 'bye' || m.is_forfeit)
    if (allDone) {
      hasToastedAllDone.current = true
      showToast('✓ Tất cả trận vòng bảng đã xong! Sẵn sàng chuyển sang knockout.', 'success')
    }
  }, [matches]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scoring rule for the currently open match (uses event config when available)
  const scoringRules = event?.scoring_rules ?? null

  // ── Navigation helpers ──────────────────────────────────────────────────────
  const backHref = eventId
    ? `/tournament/${id}/event/${eventId}/players`
    : `/tournament/${id}/setup`

  const backLabel = eventId ? '← Import VĐV' : '← Import VĐV'

  function handleQualifyConfirmed() {
    if (eventId) {
      navigate(`/tournament/${id}/event/${eventId}/knockout`)
    } else {
      navigate(`/tournament/${id}/knockout`)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }
  if (error) return <div className="max-w-2xl mx-auto px-4 py-24 text-center text-red-600">{error}</div>
  if (!tournament) return null

  // When in per-event mode, use event's status + config; otherwise use tournament's
  const activeEntity = event ?? tournament
  const statusBadgeVariant = event
    ? (EVENT_STATUS_BADGE[event.status] || 'default')
    : (STATUS_BADGE[tournament.status] || 'default')
  const statusLabel = event
    ? (EVENT_STATUS_LABELS[event.status] || event.status)
    : (STATUS_LABELS[tournament.status] || tournament.status)

  const hasGroups     = groups.length > 0
  const allGroupsDone = hasGroups && enrichedGroups.every(g => g.completed === g.total && g.total > 0)

  const disciplineIcon  = event ? (DISCIPLINE_ICONS[event.discipline] ?? '🏸') : null
  const disciplineLabel = event ? (DISCIPLINE_LABELS[event.discipline] ?? event.name) : null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Breadcrumb (per-event) or simple back link (legacy) */}
      {eventId ? (
        <Breadcrumb
          className="mb-6"
          items={[
            { label: 'Trang chủ', href: '/' },
            { label: tournament.name, href: `/tournament/${id}` },
            { label: disciplineLabel, href: `/tournament/${id}/event/${eventId}/setup` },
            { label: 'Vòng bảng' },
          ]}
        />
      ) : (
        <Link to={backHref} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> {backLabel}
        </Link>
      )}

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0 text-2xl">
            {disciplineIcon ?? <Trophy className="w-6 h-6 text-blue-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 truncate">
                {disciplineLabel ? `${disciplineLabel} — Vòng bảng` : tournament.name}
              </h1>
              <Badge variant={statusBadgeVariant}>{statusLabel}</Badge>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />{players.length} VĐV
              </span>
              <span className="flex items-center gap-1">
                <LayoutGrid className="w-3.5 h-3.5" />{activeEntity.num_groups ?? tournament.num_groups} bảng
              </span>
              {hasGroups && (
                <span className="text-blue-600 font-medium">
                  {enrichedGroups.reduce((s, g) => s + g.completed, 0)}/
                  {enrichedGroups.reduce((s, g) => s + g.total, 0)} trận
                </span>
              )}
            </div>
          </div>
          {matches.length > 0 && (
            <button
              onClick={() => exportScheduleToExcel(tournament, matches, event)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-1.5 transition-colors shrink-0"
              title="Xuất lịch thi đấu ra Excel"
            >
              <Download className="w-3.5 h-3.5" /> Xuất lịch
            </button>
          )}
        </div>
      </div>

      {/* ── Phase A: No groups → Randomizer or Lottery ── */}
      {!hasGroups && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          {/* Header + mode toggle */}
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">2</div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Phân bảng</h2>
                <p className="text-sm text-gray-500">Đảm bảo không trùng CLB trong cùng bảng</p>
              </div>
            </div>

            {/* Mode toggle — only show when players exist */}
            {players.length > 0 && (
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 shrink-0">
                <button
                  onClick={() => setDrawMode('auto')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    drawMode === 'auto'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  ⚡ Tự động
                </button>
                <button
                  onClick={() => setDrawMode('lottery')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    drawMode === 'lottery'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  🎰 Bốc thăm
                </button>
              </div>
            )}
          </div>

          {players.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              Chưa có VĐV.{' '}
              <Link to={backHref} className="text-blue-600 underline">Import VĐV trước</Link>
            </div>
          ) : drawMode === 'lottery' ? (
            <DrawLottery
              tournament={tournament}
              event={event}
              players={players}
              onConfirmed={fetchAll}
            />
          ) : (
            <GroupRandomizer
              tournament={tournament}
              event={event}
              players={players}
              onConfirmed={fetchAll}
            />
          )}
        </div>
      )}

      {/* ── Phase B: Groups exist → Group Stage ── */}
      {hasGroups && (
        <div className="space-y-4">
          {/* Tab bar */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-stretch border-b border-gray-200">
              {/* Group tabs */}
              <div className="flex-1 overflow-x-auto">
                <div className="flex min-w-max">
                  {enrichedGroups.map((g, idx) => {
                    const label  = String.fromCharCode(65 + idx)
                    const active = activeTab.type === 'group' && activeTab.idx === idx
                    const done   = g.completed === g.total && g.total > 0
                    return (
                      <button
                        key={g.id}
                        onClick={() => setActiveTab({ type: 'group', idx })}
                        className={`flex flex-col items-center px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                          active
                            ? 'border-blue-600 text-blue-600 bg-blue-50'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span>Bảng {label}</span>
                        <span className={`text-xs mt-0.5 ${done ? 'text-green-500' : active ? 'text-blue-400' : 'text-gray-400'}`}>
                          {done ? '✓ xong' : `${g.completed}/${g.total}`}
                        </span>
                      </button>
                    )
                  })}

                  {/* Courts tab */}
                  <button
                    onClick={() => setActiveTab({ type: 'courts' })}
                    className={`flex flex-col items-center px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab.type === 'courts'
                        ? 'border-blue-600 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-center gap-1"><Grid className="w-3.5 h-3.5" />Sân đấu</span>
                    <span className="text-xs mt-0.5 text-gray-400">
                      {event?.num_courts ?? 2} sân
                    </span>
                  </button>
                </div>
              </div>

              {/* Attendance button */}
              {event?.attendance_enabled && eventId && (
                <div className="flex items-center px-3 border-l border-gray-200 shrink-0">
                  <Link
                    to={`/tournament/${id}/event/${eventId}/attendance`}
                    className="flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 px-2.5 py-1.5 rounded-lg hover:bg-orange-50 transition-colors whitespace-nowrap"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>Điểm danh</span>
                  </Link>
                </div>
              )}
            </div>

            {activeTab.type === 'group' && enrichedGroups[activeTab.idx] && (
              <GroupView
                group={enrichedGroups[activeTab.idx]}
                groupIdx={activeTab.idx}
                playerMap={playerMap}
                onMatchClick={setScoreMatch}
                attendanceEnabled={event?.attendance_enabled ?? false}
                umpireMap={umpireMap}
                onAssignUmpire={canUseUmpire ? setAssignMatch : null}
                onViewRally={setRallyMatch}
              />
            )}
            {activeTab.type === 'courts' && (
              <CourtBoard
                event={event}
                matches={matches}
                playerMap={playerMap}
                scoringRules={scoringRules}
                onMatchUpdated={handleCourtMatchUpdated}
                onRefresh={fetchAll}
                umpireMap={umpireMap}
                onAssignUmpire={canUseUmpire ? setAssignMatch : null}
                tournamentId={id}
              />
            )}
          </div>

          {/* Qualify & go to knockout */}
          {allGroupsDone && (
            <QualifySection
              tournament={tournament}
              event={event}
              onConfirmed={handleQualifyConfirmed}
            />
          )}
        </div>
      )}

      {/* Score modal — uses event scoring_rules when available */}
      {scoreMatch && !scoreMatch.is_forfeit && (
        <ScoreModal
          match={scoreMatch}
          player1Name={playerMap[scoreMatch.player1_id]?.name ?? '?'}
          player2Name={playerMap[scoreMatch.player2_id]?.name ?? '?'}
          scoringRules={scoringRules}
          numCourts={event?.num_courts}
          onClose={() => setScoreMatch(null)}
          onSaved={handleMatchSaved}
        />
      )}

      {/* Umpire assign modal */}
      {assignMatch && (
        <UmpireAssignModal
          match={{
            ...assignMatch,
            player1_name: playerMap[assignMatch.player1_id]?.name,
            player2_name: playerMap[assignMatch.player2_id]?.name,
          }}
          tournamentId={id}
          onClose={() => setAssignMatch(null)}
          onAssigned={(matchId, umpireId) => {
            setMatches(prev => prev.map(m => m.id === matchId ? { ...m, umpire_id: umpireId } : m))
            setAssignMatch(null)
          }}
        />
      )}

      {/* Rally log modal */}
      {rallyMatch && (
        <RallyLogModal
          matchId={rallyMatch.id}
          player1Id={rallyMatch.player1_id}
          player2Id={rallyMatch.player2_id}
          player1Name={playerMap[rallyMatch.player1_id]?.name ?? '?'}
          player2Name={playerMap[rallyMatch.player2_id]?.name ?? '?'}
          onClose={() => setRallyMatch(null)}
        />
      )}
    </div>
  )
}

// ─── GroupView ────────────────────────────────────────────────────────────────

function GroupView({ group, groupIdx, playerMap, onMatchClick, attendanceEnabled = false, umpireMap = {}, onAssignUmpire = null, onViewRally = null }) {
  const label    = String.fromCharCode(65 + groupIdx)
  const done     = group.completed === group.total && group.total > 0
  const forfeits = group.matches.filter(m => m.is_forfeit).length

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-gray-900">Bảng {label}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {group.players.length} VĐV · {group.completed}/{group.total} trận đã xong
            {done && <span className="ml-2 text-green-600 font-medium">✓ Hoàn thành</span>}
            {forfeits > 0 && (
              <span className="ml-2 text-orange-500 text-xs">· {forfeits} trận W/O</span>
            )}
          </p>
        </div>
        {!done && group.completed > 0 && (
          <div className="h-1.5 w-24 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${(group.completed / group.total) * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Lịch thi đấu</p>
          <MatchList
            matches={group.matches}
            playerMap={playerMap}
            onMatchClick={onMatchClick}
            attendanceEnabled={attendanceEnabled}
            umpireMap={umpireMap}
            onAssignUmpire={onAssignUmpire}
            onViewRally={onViewRally}
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Bảng xếp hạng</p>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <StandingsTable standings={group.standings} />
          </div>
          {forfeits > 0 && (
            <p className="text-xs text-gray-400 mt-2 px-1">(*) Trận W/O: thắng do đối thủ bỏ cuộc</p>
          )}
        </div>
      </div>
    </div>
  )
}
