import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Trophy, Swords, Crown,
  CheckCircle2, Clock, Pencil, Loader2, AlertCircle,
  LayoutList, GitBranch, ChevronRight, ImageDown,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { STATUS_LABELS, DISCIPLINE_LABELS, DISCIPLINE_ICONS, EVENT_STATUS_LABELS, EVENT_STATUS_BADGE } from '@/lib/constants'
import { saveKnockoutBracket } from '@/lib/utils/bracketGenerator'
import { getQualifiedPlayers } from '@/lib/utils/qualifyPlayers'
import { advanceWinner, repairBracketLinks } from '@/lib/utils/advanceWinner'
import Badge from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ScoreModal from '@/components/shared/ScoreModal'
import BracketView from '@/components/knockout/BracketView'
import Breadcrumb from '@/components/layout/Breadcrumb'
import { downloadElementAsImage } from '@/lib/utils/downloadImage'
import { cn } from '@/lib/utils/cn'

// ── Stage config ──────────────────────────────────────────────────────────────
const STAGES = [
  { key: 'round_of_16', label: '1/8',      short: '1/8',   count: 8 },
  { key: 'quarter',     label: 'Tứ kết',   short: 'TK',    count: 4 },
  { key: 'semi',        label: 'Bán kết',  short: 'BK',    count: 2 },
  { key: 'final',       label: 'Chung kết + Hạng 3', short: 'CK', count: 2 },
]

const STATUS_BADGE = {
  setup: 'yellow', group_stage: 'blue', knockout: 'purple', completed: 'green',
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function KnockoutPage() {
  const { id, eventId } = useParams()

  const [tournament, setTournament]   = useState(null)
  const [event, setEvent]             = useState(null)
  const [players, setPlayers]         = useState([])
  const [matches, setMatches]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [generating, setGenerating]   = useState(false)
  const [error, setError]             = useState(null)
  const [activeStage, setActiveStage]   = useState('round_of_16')
  const [scoreMatch, setScoreMatch]     = useState(null)
  const [viewMode, setViewMode]         = useState('list')  // 'list' | 'bracket'
  const [downloading, setDownloading]   = useState(false)
  const bracketRef = useRef(null)

  async function handleDownloadBracket() {
    if (!bracketRef.current) return
    setDownloading(true)
    try {
      const safeName = (tournament?.name ?? 'bracket').replace(/[\\/:*?"<>|]/g, '_')
      await downloadElementAsImage(bracketRef.current, `${safeName}_so_do.png`)
    } finally {
      setDownloading(false)
    }
  }

  useEffect(() => { fetchAll() }, [id, eventId])

  // ── Fetch ───────────────────────────────────────────────────────────────────
  async function fetchAll() {
    setLoading(true)
    setError(null)
    try {
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

      let knockoutMatches = mRes.data || []

      // ── Deduplicate: keep one match per (stage, match_number) ────────────────
      const deduped      = deduplicateMatches(knockoutMatches)
      const keptIds      = new Set(deduped.map(m => m.id))
      const duplicateIds = knockoutMatches.filter(m => !keptIds.has(m.id)).map(m => m.id)
      if (duplicateIds.length > 0) {
        await supabase.from('matches').delete().in('id', duplicateIds)
        knockoutMatches = deduped
      }

      if (knockoutMatches.length === 0) {
        await generateBracket(tRes.data, pRes.data || [], ev)
      } else {
        await repairBracketLinks(knockoutMatches, id, eventId ?? null)

        // Re-fetch after repair
        const refetchQ = eventId
          ? supabase.from('matches').select('*').eq('event_id', eventId).neq('stage', 'group').order('match_number')
          : supabase.from('matches').select('*').eq('tournament_id', id).neq('stage', 'group').order('match_number')
        const { data: repaired } = await refetchQ
        const repairedMatches = repaired || knockoutMatches
        setMatches(repairedMatches)

        // Belt-and-suspenders: fix completion status if missed
        const finalDone = repairedMatches.find(m => m.stage === 'final' && m.status === 'completed')
        if (finalDone) {
          if (eventId && ev?.status === 'knockout') {
            const { data: fixedEv } = await supabase
              .from('events').update({ status: 'completed' }).eq('id', eventId).select().single()
            if (fixedEv) setEvent(fixedEv)
          } else if (!eventId && tRes.data?.status === 'knockout') {
            const { data: fixed } = await supabase
              .from('tournaments')
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .eq('id', id).select().single()
            if (fixed) setTournament(fixed)
          }
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Generate bracket ────────────────────────────────────────────────────────
  async function generateBracket(t, allPlayers, ev = null) {
    setGenerating(true)
    try {
      const config = ev ?? t
      const numFirst  = config.num_first_place_qualify  ?? 12
      const numSecond = config.num_second_place_qualify ?? 4
      const evId = ev?.id ?? null

      const qualified = await getQualifiedPlayers(t.id, numFirst, numSecond, evId)
      if (qualified.length === 0) throw new Error('Chưa có VĐV đủ điều kiện. Hoàn thành vòng bảng trước.')

      const saved = await saveKnockoutBracket(qualified, t.id, evId)
      setMatches(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  // ── Dedup helper: keep one match per (stage, match_number) ────────────────
  function deduplicateMatches(matches) {
    const byKey = {}
    matches.forEach(m => {
      const key = `${m.stage}:${m.match_number}`
      const existing = byKey[key]
      if (!existing) {
        byKey[key] = m
      } else {
        const keepNew =
          (m.status === 'completed' && existing.status !== 'completed') ||
          (m.status === existing.status && m.id < existing.id)
        byKey[key] = keepNew ? m : existing
      }
    })
    return Object.values(byKey)
  }

  // ── Player lookup map ───────────────────────────────────────────────────────
  const playerMap = useMemo(
    () => Object.fromEntries(players.map(p => [p.id, p])),
    [players]
  )

  // ── Score saved handler ─────────────────────────────────────────────────────
  async function handleScoreSaved(updatedMatch) {
    try {
      const { data: full } = await supabase.from('matches').select('*').eq('id', updatedMatch.id).single()
      if (full) await advanceWinner(full)
    } catch (err) {
      console.error('advanceWinner error:', err)
    }

    // Reload all knockout matches (deduplicated)
    const freshQ = eventId
      ? supabase.from('matches').select('*').eq('event_id', eventId).neq('stage', 'group').order('match_number')
      : supabase.from('matches').select('*').eq('tournament_id', id).neq('stage', 'group').order('match_number')
    const { data: freshRaw } = await freshQ
    const fresh = freshRaw ? deduplicateMatches(freshRaw) : null

    if (fresh) {
      setMatches(fresh)

      const finalDone = fresh.find(m => m.stage === 'final' && m.status === 'completed')
      if (finalDone) {
        if (eventId) {
          // Belt-and-suspenders for event status
          const { data: updatedEv } = await supabase
            .from('events').update({ status: 'completed' }).eq('id', eventId).eq('status', 'knockout').select().single()
          if (updatedEv) setEvent(updatedEv)
        } else {
          await supabase
            .from('tournaments')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', id).eq('status', 'knockout')
        }
      }

      // Refresh tournament + event status
      const { data: t } = await supabase.from('tournaments').select('*').eq('id', id).single()
      if (t) setTournament(t)
      if (eventId) {
        const { data: ev } = await supabase.from('events').select('*').eq('id', eventId).single()
        if (ev) setEvent(ev)
      }
    }

    setScoreMatch(null)
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const byStage = useMemo(() => {
    const map = {}
    matches.forEach(m => {
      if (!map[m.stage]) map[m.stage] = []
      map[m.stage].push(m)
    })
    return map
  }, [matches])

  const champion = useMemo(() => {
    const fin = byStage['final']?.[0]
    if (fin?.status === 'completed' && fin.winner_id) return playerMap[fin.winner_id]
    return null
  }, [byStage, playerMap])

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading || generating) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-500">
          {generating ? 'Đang tạo cây knockout...' : 'Đang tải...'}
        </p>
      </div>
    )
  }

  const disciplineIcon  = event ? (DISCIPLINE_ICONS[event.discipline] ?? '🏸') : null
  const disciplineLabel = event ? (DISCIPLINE_LABELS[event.discipline] ?? event.name) : null
  const activeStatus    = event?.status ?? tournament?.status
  const statusBadgeVar  = event
    ? (EVENT_STATUS_BADGE[event.status] || 'default')
    : (STATUS_BADGE[tournament?.status] || 'default')
  const statusLabel = event
    ? (EVENT_STATUS_LABELS[event.status] || event.status)
    : (STATUS_LABELS[tournament?.status] || tournament?.status)
  const resultsHref = eventId
    ? `/tournament/${id}/event/${eventId}/results`
    : `/tournament/${id}/results`

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-600 mb-4">{error}</p>
        <Link
          to={eventId ? `/tournament/${id}/event/${eventId}/groups` : `/tournament/${id}/groups`}
          className="text-blue-600 underline text-sm"
        >
          Quay lại vòng bảng
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Breadcrumb (per-event) or back link (legacy) */}
      {eventId ? (
        <Breadcrumb
          className="mb-6"
          items={[
            { label: 'Trang chủ', href: '/' },
            { label: tournament?.name, href: `/tournament/${id}` },
            { label: disciplineLabel, href: `/tournament/${id}/event/${eventId}/setup` },
            { label: 'Knockout' },
          ]}
        />
      ) : (
        <Link
          to={`/tournament/${id}/groups`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Vòng bảng
        </Link>
      )}

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center shrink-0 text-2xl">
            {disciplineIcon ?? <Swords className="w-6 h-6 text-purple-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 truncate">
                {disciplineLabel ? `${disciplineLabel} — Knockout` : tournament?.name}
              </h1>
              <Badge variant={statusBadgeVar}>{statusLabel}</Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">Vòng Knockout · {matches.length} trận</p>
          </div>
        </div>
      </div>

      {/* Champion banner + results CTA */}
      {champion && (
        <div className="mb-6 space-y-3">
          <div className="bg-linear-to-r from-yellow-400 to-amber-400 rounded-xl p-5 flex items-center gap-4 shadow-md">
            <Crown className="w-10 h-10 text-white shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-yellow-100 text-sm font-medium">🏆 Vô địch</p>
              <p className="text-white text-2xl font-bold truncate">{champion.name}</p>
              <p className="text-yellow-100 text-sm">{champion.club}</p>
            </div>
            <Link
              to={resultsHref}
              className="shrink-0 flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Xem kết quả <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* View toggle + content */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Tab bar + view toggle */}
        <div className="flex items-stretch border-b border-gray-200">
          {viewMode === 'list' && (
            <div className="flex-1 overflow-x-auto">
              <div className="flex min-w-max">
                {STAGES.map(stage => {
                  const stageMatches = byStage[stage.key] || []
                  const done  = stageMatches.filter(m => m.status === 'completed').length
                  const total = stageMatches.length
                  const active = activeStage === stage.key
                  const isFinalsTab = stage.key === 'final'
                  const extraDone = isFinalsTab ? (byStage['third_place']?.[0]?.status === 'completed' ? 1 : 0) : 0

                  return (
                    <button
                      key={stage.key}
                      onClick={() => setActiveStage(stage.key)}
                      className={cn(
                        'flex flex-col items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                        active
                          ? 'border-purple-600 text-purple-600 bg-purple-50'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50',
                      )}
                    >
                      <span>{stage.label}</span>
                      <span className={cn(
                        'text-xs mt-0.5',
                        done + extraDone === total + (isFinalsTab ? 1 : 0) && total > 0
                          ? 'text-green-500'
                          : active ? 'text-purple-400' : 'text-gray-400',
                      )}>
                        {isFinalsTab
                          ? `${done + extraDone}/${total + 1}`
                          : `${done}/${total}`}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {viewMode === 'bracket' && (
            <div className="flex-1 flex items-center justify-between px-4 py-2">
              <span className="text-sm font-medium text-purple-600 flex items-center gap-1.5">
                <GitBranch className="w-4 h-4" /> Sơ đồ giải đấu
              </span>
              <button
                onClick={handleDownloadBracket}
                disabled={downloading}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-purple-600 bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                {downloading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <ImageDown className="w-3.5 h-3.5" />
                }
                Tải ảnh
              </button>
            </div>
          )}

          {/* View mode switcher */}
          <div className="flex items-center gap-1 px-3 border-l border-gray-200 shrink-0">
            <button
              onClick={() => setViewMode('list')}
              title="Danh sách"
              className={cn(
                'p-1.5 rounded transition-colors',
                viewMode === 'list'
                  ? 'bg-purple-100 text-purple-600'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
              )}
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('bracket')}
              title="Sơ đồ"
              className={cn(
                'p-1.5 rounded transition-colors',
                viewMode === 'bracket'
                  ? 'bg-purple-100 text-purple-600'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
              )}
            >
              <GitBranch className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {viewMode === 'bracket' ? (
            <BracketView
              matches={matches}
              playerMap={playerMap}
              onMatchClick={setScoreMatch}
              containerRef={bracketRef}
              tournamentName={tournament?.name}
            />
          ) : activeStage === 'final' ? (
            <FinalsView
              finalMatch={byStage['final']?.[0]}
              thirdMatch={byStage['third_place']?.[0]}
              playerMap={playerMap}
              onMatchClick={setScoreMatch}
            />
          ) : (
            <StageMatchList
              matches={byStage[activeStage] || []}
              playerMap={playerMap}
              onMatchClick={setScoreMatch}
            />
          )}
        </div>
      </div>

      {/* Score modal */}
      {scoreMatch && (
        <ScoreModal
          match={scoreMatch}
          player1Name={playerMap[scoreMatch.player1_id]?.name ?? 'TBD'}
          player2Name={playerMap[scoreMatch.player2_id]?.name ?? 'TBD'}
          scoringRules={event?.scoring_rules ?? null}
          onClose={() => setScoreMatch(null)}
          onSaved={handleScoreSaved}
        />
      )}
    </div>
  )
}

// ── StageMatchList ─────────────────────────────────────────────────────────────

function StageMatchList({ matches, playerMap, onMatchClick }) {
  if (matches.length === 0) {
    return <p className="text-center py-12 text-sm text-gray-400">Chưa có dữ liệu cho vòng này.</p>
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
      {matches.map((match, idx) => (
        <KnockoutMatchCard
          key={match.id}
          match={match}
          label={`Trận ${idx + 1}`}
          playerMap={playerMap}
          onClick={() => onMatchClick(match)}
        />
      ))}
    </div>
  )
}

// ── FinalsView ────────────────────────────────────────────────────────────────

function FinalsView({ finalMatch, thirdMatch, playerMap, onMatchClick }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">🏆 Chung kết</p>
        {finalMatch
          ? <KnockoutMatchCard match={finalMatch} label="Chung kết" playerMap={playerMap} onClick={() => onMatchClick(finalMatch)} highlight />
          : <EmptyMatchCard label="Chung kết" />
        }
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">🥉 Tranh hạng 3</p>
        {thirdMatch
          ? <KnockoutMatchCard match={thirdMatch} label="Tranh hạng 3" playerMap={playerMap} onClick={() => onMatchClick(thirdMatch)} />
          : <EmptyMatchCard label="Tranh hạng 3" />
        }
      </div>
    </div>
  )
}

// ── KnockoutMatchCard ─────────────────────────────────────────────────────────

function KnockoutMatchCard({ match, label, playerMap, onClick, highlight = false }) {
  const p1   = match.player1_id ? (playerMap[match.player1_id] ?? { name: '?', club: '' }) : null
  const p2   = match.player2_id ? (playerMap[match.player2_id] ?? { name: '?', club: '' }) : null
  const done = match.status === 'completed'
  const canClick = !!(p1 && p2)  // only clickable when both players are known

  const scores1 = Array.isArray(match.player1_scores) ? match.player1_scores : []
  const scores2 = Array.isArray(match.player2_scores) ? match.player2_scores : []
  const scoreText = scores1.length > 0
    ? scores1.map((s, i) => `${s}–${scores2[i] ?? 0}`).join('  ')
    : null

  const p1Won = done && match.winner_id === match.player1_id
  const p2Won = done && match.winner_id === match.player2_id

  return (
    <button
      onClick={canClick ? onClick : undefined}
      disabled={!canClick}
      className={cn(
        'group w-full text-left border-2 rounded-xl p-4 transition-all',
        highlight && 'border-yellow-300 bg-yellow-50',
        !highlight && done && 'border-green-200 bg-green-50/40 hover:border-blue-300 hover:bg-blue-50',
        !highlight && !done && canClick && 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm',
        !highlight && !done && !canClick && 'border-dashed border-gray-200 bg-gray-50 cursor-default opacity-60',
      )}
    >
      {/* Label */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{label}</p>

      {/* Player 1 */}
      <PlayerRow
        player={p1}
        score={scoreText ? scores1 : null}
        scores={scores1}
        opponentScores={scores2}
        isWinner={p1Won}
        placeholder="Chờ kết quả..."
      />

      <div className="text-center text-xs text-gray-300 my-1 font-medium">vs</div>

      {/* Player 2 */}
      <PlayerRow
        player={p2}
        scores={scores2}
        opponentScores={scores1}
        isWinner={p2Won}
        placeholder="Chờ kết quả..."
      />

      {/* Status hint */}
      <div className="mt-3 text-xs flex items-center gap-1">
        {done ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            <span className="text-green-600">Hoàn thành</span>
            <Pencil className="w-3 h-3 text-blue-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </>
        ) : canClick ? (
          <>
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-purple-500">Chạm để nhập điểm</span>
          </>
        ) : (
          <span className="text-gray-400">Chờ vòng trước...</span>
        )}
      </div>
    </button>
  )
}

function PlayerRow({ player, scores, opponentScores, isWinner, placeholder }) {
  const scoreText = scores && scores.length > 0
    ? scores.map((s, i) => `${s}–${opponentScores?.[i] ?? 0}`).join('  ')
    : null

  if (!player) {
    return (
      <div className="flex items-center gap-2 py-1 opacity-40">
        <div className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
        <span className="text-xs text-gray-400 italic">{placeholder}</span>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-between gap-2 py-1 rounded-lg', isWinner && 'bg-green-100 px-2 -mx-2')}>
      <div className="flex items-center gap-2 min-w-0">
        {isWinner
          ? <Crown className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
          : <div className="w-3.5 h-3.5 shrink-0" />
        }
        <div className="min-w-0">
          <p className={cn('text-sm truncate', isWinner ? 'font-bold text-gray-900' : 'font-medium text-gray-700')}>
            {player.name}
          </p>
          <p className="text-xs text-gray-400 truncate">{player.club}</p>
        </div>
      </div>
      {scoreText && (
        <span className={cn('text-sm font-bold shrink-0 tabular-nums', isWinner ? 'text-gray-900' : 'text-gray-400')}>
          {scoreText}
        </span>
      )}
    </div>
  )
}

function EmptyMatchCard({ label }) {
  return (
    <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center opacity-50">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-xs text-gray-300 mt-1">Chờ dữ liệu</p>
    </div>
  )
}
