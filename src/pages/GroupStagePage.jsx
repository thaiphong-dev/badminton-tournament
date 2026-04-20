import { useEffect, useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trophy, Users, LayoutGrid } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { STATUS_LABELS } from '@/lib/constants'
import { calculateStandings } from '@/lib/utils/standingsCalculator'
import { buildClubColorMap } from '@/components/groups/GroupCard'
import Badge from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import GroupRandomizer from '@/components/groups/GroupRandomizer'
import StandingsTable from '@/components/groups/StandingsTable'
import MatchList from '@/components/groups/MatchList'
import ScoreModal from '@/components/shared/ScoreModal'
import QualifySection from '@/components/groups/QualifySection'

const STATUS_BADGE = {
  setup: 'yellow', group_stage: 'blue', knockout: 'purple', completed: 'green',
}

export default function GroupStagePage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [tournament, setTournament] = useState(null)
  const [players, setPlayers] = useState([])      // all players
  const [groups, setGroups] = useState([])         // groups with group_players
  const [matches, setMatches] = useState([])       // all group-stage matches
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // UI state
  const [selectedGroupIdx, setSelectedGroupIdx] = useState(0)
  const [scoreMatch, setScoreMatch] = useState(null)  // match being scored

  useEffect(() => { fetchAll() }, [id])

  // ── Data fetching ───────────────────────────────────────────────────────────
  async function fetchAll() {
    setLoading(true)
    setError(null)
    try {
      const [tRes, pRes, gRes, mRes] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', id).single(),
        supabase.from('players').select('*').eq('tournament_id', id).order('name'),
        supabase
          .from('groups')
          .select('*, group_players(*, players(id, name, club))')
          .eq('tournament_id', id)
          .order('group_number'),
        supabase
          .from('matches')
          .select('*')
          .eq('tournament_id', id)
          .eq('stage', 'group')
          .order('match_number'),
      ])

      if (tRes.error) throw tRes.error
      if (pRes.error) throw pRes.error
      if (gRes.error) throw gRes.error
      if (mRes.error) throw mRes.error

      setTournament(tRes.data)
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

  // player id → player object (for name lookup in MatchList)
  const playerMap = useMemo(
    () => Object.fromEntries(players.map(p => [p.id, p])),
    [players]
  )

  const clubColorMap = useMemo(() => buildClubColorMap(players), [players])

  // Enrich each group with its players list and match stats
  const enrichedGroups = useMemo(() => {
    return groups.map(g => {
      const gPlayers = (g.group_players || [])
        .map(gp => gp.players)
        .filter(Boolean)

      const gMatches = matches.filter(m => m.group_id === g.id)
      const completed = gMatches.filter(m => m.status === 'completed').length
      const total = gMatches.length

      const standings = calculateStandings(gMatches, gPlayers)

      return { ...g, players: gPlayers, matches: gMatches, completed, total, standings }
    })
  }, [groups, matches])

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleMatchSaved(updatedMatch) {
    // Optimistically update local match list
    setMatches(prev => prev.map(m => m.id === updatedMatch.id ? updatedMatch : m))
    setScoreMatch(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return <div className="flex justify-center py-24"><LoadingSpinner size="lg" text="Đang tải..." /></div>
  if (error)   return <div className="max-w-2xl mx-auto px-4 py-24 text-center text-red-600">{error}</div>
  if (!tournament) return null

  const hasGroups = groups.length > 0
  const isGroupStage = tournament.status === 'group_stage'

  const allGroupsDone = hasGroups && enrichedGroups.every(g => g.completed === g.total && g.total > 0)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Back */}
      <Link
        to={`/tournament/${id}/setup`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Import VĐV
      </Link>

      {/* Tournament header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 truncate">{tournament.name}</h1>
              <Badge variant={STATUS_BADGE[tournament.status] || 'default'}>
                {STATUS_LABELS[tournament.status]}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{players.length} VĐV</span>
              <span className="flex items-center gap-1"><LayoutGrid className="w-3.5 h-3.5" />{tournament.num_groups} bảng</span>
              {hasGroups && (
                <span className="text-blue-600 font-medium">
                  {enrichedGroups.reduce((s, g) => s + g.completed, 0)}/
                  {enrichedGroups.reduce((s, g) => s + g.total, 0)} trận
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Phase A: No groups → Randomizer ── */}
      {!hasGroups && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">2</div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Phân bảng ngẫu nhiên</h2>
              <p className="text-sm text-gray-500">Đảm bảo không trùng CLB trong cùng bảng</p>
            </div>
          </div>
          {players.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              Chưa có VĐV.{' '}
              <Link to={`/tournament/${id}/setup`} className="text-blue-600 underline">Import VĐV trước</Link>
            </div>
          ) : (
            <GroupRandomizer
              tournament={tournament}
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
            <div className="overflow-x-auto">
              <div className="flex border-b border-gray-200 min-w-max">
                {enrichedGroups.map((g, idx) => {
                  const label = String.fromCharCode(65 + idx)
                  const active = idx === selectedGroupIdx
                  const done = g.completed === g.total && g.total > 0

                  return (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGroupIdx(idx)}
                      className={`flex flex-col items-center px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        active
                          ? 'border-blue-600 text-blue-600 bg-blue-50'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>Bảng {label}</span>
                      <span className={`text-xs mt-0.5 ${
                        done ? 'text-green-500' : active ? 'text-blue-400' : 'text-gray-400'
                      }`}>
                        {done ? '✓ xong' : `${g.completed}/${g.total}`}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Selected group content */}
            {enrichedGroups[selectedGroupIdx] && (
              <GroupView
                group={enrichedGroups[selectedGroupIdx]}
                groupIdx={selectedGroupIdx}
                playerMap={playerMap}
                onMatchClick={setScoreMatch}
              />
            )}
          </div>

          {/* Qualify & go to knockout */}
          {allGroupsDone && (
            <QualifySection
              tournament={tournament}
              onConfirmed={() => navigate(`/tournament/${id}/knockout`)}
            />
          )}
        </div>
      )}

      {/* Score modal */}
      {scoreMatch && (
        <ScoreModal
          match={scoreMatch}
          player1Name={playerMap[scoreMatch.player1_id]?.name ?? '?'}
          player2Name={playerMap[scoreMatch.player2_id]?.name ?? '?'}
          onClose={() => setScoreMatch(null)}
          onSaved={handleMatchSaved}
        />
      )}
    </div>
  )
}

// ─── GroupView: matches + standings for one group ─────────────────────────────

function GroupView({ group, groupIdx, playerMap, onMatchClick }) {
  const label = String.fromCharCode(65 + groupIdx)
  const done = group.completed === group.total && group.total > 0

  return (
    <div className="p-5">
      {/* Group header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-gray-900">Bảng {label}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {group.players.length} VĐV · {group.completed}/{group.total} trận đã xong
            {done && <span className="ml-2 text-green-600 font-medium">✓ Hoàn thành</span>}
          </p>
        </div>
        {!done && group.completed > 0 && (
          <div className="text-right">
            <div className="h-1.5 w-24 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${(group.completed / group.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Two-column layout: Matches | Standings */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Matches */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Lịch thi đấu</p>
          <MatchList
            matches={group.matches}
            playerMap={playerMap}
            onMatchClick={onMatchClick}
          />
        </div>

        {/* Standings */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Bảng xếp hạng</p>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <StandingsTable standings={group.standings} />
          </div>
        </div>
      </div>
    </div>
  )
}
