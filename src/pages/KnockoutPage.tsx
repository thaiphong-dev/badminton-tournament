import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@/lib/hooks/useAuth'
import { useFeatures } from '@/lib/hooks/useFeatures'
import {
  ArrowLeft, Trophy, Swords, Crown,
  CheckCircle2, Clock, Pencil, Loader2, AlertCircle,
  LayoutList, GitBranch, ChevronRight, ImageDown, ClipboardList,
  Zap, Dices, ShieldCheck, Grid,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useBTCRealtime } from '@/lib/hooks/useBTCRealtime'
import { STATUS_LABELS, DISCIPLINE_LABELS, DISCIPLINE_ICONS, EVENT_STATUS_LABELS, EVENT_STATUS_BADGE } from '@/lib/constants'
import { saveKnockoutBracket } from '@/lib/utils/bracketGenerator'
import { getQualifiedPlayers } from '@/lib/utils/qualifyPlayers'
import { advanceWinner, repairBracketLinks } from '@/lib/utils/advanceWinner'
import Badge from '@/components/ui/Badge'
import { MatchBracketSkeleton } from '@/components/ui/Skeleton'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ScoreModal from '@/components/shared/ScoreModal'
import BracketView from '@/components/knockout/BracketView'
import Breadcrumb from '@/components/layout/Breadcrumb'
import DrawKnockout from '@/components/knockout/DrawKnockout'
import CourtBoard from '@/components/courts/CourtBoard'
import UmpireAssignModal from '@/components/tournament/UmpireAssignModal'
import RallyLogModal from '@/components/shared/RallyLogModal'
import { downloadElementAsImage } from '@/lib/utils/downloadImage'
import { cn } from '@/lib/utils/cn'

// ── Stage config (all possible stages, ordered largest → final) ───────────────
const ALL_STAGES = [
  { key: 'round_of_64', label: '1/32',    short: '1/32' },
  { key: 'round_of_32', label: '1/16',    short: '1/16' },
  { key: 'round_of_16', label: '1/8',     short: '1/8'  },
  { key: 'quarter',     label: 'Tứ kết',  short: 'TK'   },
  { key: 'semi',        label: 'Bán kết', short: 'BK'   },
  { key: 'final',       label: 'Chung kết + Hạng 3', short: 'CK' },
]

const STATUS_BADGE = {
  setup: 'yellow', group_stage: 'blue', knockout: 'purple', completed: 'green',
}

// ── Page ──────────────────────────────────────────────────────────────────────
// Module-level caches for active fetches to prevent concurrent duplicate queries
const activeKnockoutPageFetches = new Map<string, Promise<{
  tournament: any
  event: any
  players: any[]
  matches: any[]
  pendingSetup: boolean
}>>()
const activeUmpireMapFetches = new Map<string, Promise<any>>()

export default function KnockoutPage() {
  const { id, eventId } = useParams()
  const { profile } = useAuth()
  const { hasFeature } = useFeatures()
  const canUseUmpire = !!profile && (profile?.role === 'admin' || hasFeature('umpire_assign'))

  const [tournament, setTournament]   = useState(null)
  const [event, setEvent]             = useState(null)
  const [players, setPlayers]         = useState([])
  const [matches, setMatches]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [generating, setGenerating]   = useState(false)
  const [error, setError]             = useState(null)
  const [activeStage, setActiveStage]   = useState(null)
  const initialStageSet                 = useRef(false)
  const [scoreMatch, setScoreMatch]     = useState(null)
  const [viewMode, setViewMode]         = useState('list')  // 'list' | 'bracket'
  const [downloading, setDownloading]   = useState(false)
  const bracketRef = useRef(null)

  const [umpireMap, setUmpireMap]       = useState({})   // umpireId → { name, phone }
  const [assignMatch, setAssignMatch]   = useState(null) // match to assign umpire
  const [rallyMatch, setRallyMatch]     = useState(null) // match to view rally log

  // Lottery draw mode for knockout_only (when no matches yet)
  const [pendingSetup, setPendingSetup] = useState(false)   // true = needs user to choose mode
  const [drawMode, setDrawMode]         = useState('auto')  // 'auto' | 'lottery'

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

  useEffect(() => {
    fetchAll()
    fetchUmpireMap()
  }, [id, eventId])

  // Realtime: cập nhật bracket khi umpire lưu kết quả từ xa
  const handleRealtimeMatchUpdate = useCallback(async (updatedMatch) => {
    // Cập nhật local state ngay lập tức
    setMatches(prev => prev.map(m => m.id === updatedMatch.id ? { ...m, ...updatedMatch } : m))

    if (updatedMatch.status === 'completed') {
      // Advance winner vào slot kế tiếp trong bracket (giống handleScoreSaved)
      try {
        await advanceWinner(updatedMatch)
      } catch (err) {
        console.error('[KnockoutPage] advanceWinner error:', err)
      }
      // Refetch toàn bộ knockout matches để bracket hiển thị đúng
      const freshQ = eventId
        ? supabase.from('matches').select('*').eq('event_id', eventId).neq('stage', 'group').order('match_number')
        : supabase.from('matches').select('*').eq('tournament_id', id).neq('stage', 'group').order('match_number')
      const { data: freshRaw } = await freshQ
      const fresh = freshRaw ? deduplicateMatches(freshRaw) : null
      if (fresh) setMatches(fresh)
    }
  }, [id, eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Khi CourtBoard đang hiện (activeStage==='courts'), nó đã subscribe với '-board' suffix
  // và sẽ gọi handleRealtimeMatchUpdate qua onExternalMatchUpdate — tránh 2 subscriptions song song.
  useBTCRealtime(activeStage !== 'courts' ? id : null, handleRealtimeMatchUpdate)

  async function fetchUmpireMap() {
    if (!id) return
    const activePromise = activeUmpireMapFetches.get(id)
    if (activePromise) {
      setUmpireMap(await activePromise)
      return
    }

    const newPromise = supabase
      .from('tournament_umpires')
      .select('umpire_id, profiles!umpire_id(id, name, phone)')
      .eq('tournament_id', id)
      .then(({ data }) => {
        const map = {}
        for (const row of data || []) {
          if (row.profiles) map[row.umpire_id] = row.profiles
        }
        return map
      })
      .finally(() => {
        if (activeUmpireMapFetches.get(id) === newPromise) {
          activeUmpireMapFetches.delete(id)
        }
      })

    activeUmpireMapFetches.set(id, newPromise)
    setUmpireMap(await newPromise)
  }

  // ── Fetch ───────────────────────────────────────────────────────────────────
  async function fetchAll(force = false) {
    if (!id) return
    setLoading(true)
    setError(null)
    const cacheKey = `${id}-${eventId || 'none'}`
    try {
      let fetchPromise = !force ? activeKnockoutPageFetches.get(cacheKey) : null
      if (!fetchPromise) {
        fetchPromise = (async () => {
          const tRes = await supabase.from('tournaments').select('*').eq('id', id).single()
          if (tRes.error) throw tRes.error

          // Fetch event when in per-event route
          let ev = null
          if (eventId) {
            const eRes = await supabase.from('events').select('*').eq('id', eventId).single()
            if (eRes.error) throw eRes.error
            ev = eRes.data
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

          let knockoutMatches = mRes.data || []
          let eventObj = ev
          let tournamentObj = tRes.data
          let pendingSetupVal = false

          // ── Deduplicate: keep one match per (stage, match_number) ────────────────
          const deduped      = deduplicateMatches(knockoutMatches)
          const keptIds      = new Set(deduped.map(m => m.id))
          const duplicateIds = knockoutMatches.filter(m => !keptIds.has(m.id)).map(m => m.id)
          if (duplicateIds.length > 0 && profile?.id && tRes.data.creator_id === profile.id) {
            await supabase.rpc('delete_duplicate_matches', {
              p_creator_id:    profile.id,
              p_tournament_id: id,
              p_match_ids:     duplicateIds,
            })
            knockoutMatches = deduped
          } else if (duplicateIds.length > 0) {
            knockoutMatches = deduped
          }

          if (knockoutMatches.length === 0) {
            const format = ev?.format ?? 'group_then_knockout'
            if (format === 'knockout_only' && (pRes.data || []).length > 0) {
              // Let user choose: auto-generate or lottery draw
              pendingSetupVal = true
            }
          } else {
            await repairBracketLinks(knockoutMatches, id, eventId ?? null)

            // Re-fetch after repair
            const refetchQ = eventId
              ? supabase.from('matches').select('*').eq('event_id', eventId).neq('stage', 'group').order('match_number')
              : supabase.from('matches').select('*').eq('tournament_id', id).neq('stage', 'group').order('match_number')
            const { data: repaired } = await refetchQ
            knockoutMatches = repaired || knockoutMatches

            // Belt-and-suspenders: fix completion status if missed
            const finalDone = knockoutMatches.find(m => m.stage === 'final' && m.status === 'completed')
            if (finalDone) {
              if (eventId && ev?.status === 'knockout') {
                const { data: fixedEv } = await supabase
                  .from('events').update({ status: 'completed' }).eq('id', eventId).select().single()
                if (fixedEv) eventObj = fixedEv
              } else if (!eventId && tRes.data?.status === 'knockout') {
                const { data: fixed } = await supabase
                  .from('tournaments')
                  .update({ status: 'completed', completed_at: new Date().toISOString() })
                  .eq('id', id).select().single()
                if (fixed) tournamentObj = fixed
              }
            }
          }

          return {
            tournament: tournamentObj,
            event: eventObj,
            players: pRes.data || [],
            matches: knockoutMatches,
            pendingSetup: pendingSetupVal,
          }
        })().finally(() => {
          if (activeKnockoutPageFetches.get(cacheKey) === fetchPromise) {
            activeKnockoutPageFetches.delete(cacheKey)
          }
        })

        if (!force) {
          activeKnockoutPageFetches.set(cacheKey, fetchPromise)
        }
      }

      const res = await fetchPromise
      setTournament(res.tournament)
      setEvent(res.event)
      setPlayers(res.players)
      setMatches(res.matches)
      setPendingSetup(res.pendingSetup)

      // Post-fetch check: if no matches and format is not knockout_only, auto-generate bracket
      if (res.matches.length === 0 && !res.pendingSetup) {
        await generateBracket(res.tournament, res.players, res.event)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Generate bracket ────────────────────────────────────────────────────────
  async function generateBracket(t, allPlayers, ev = null) {
    setGenerating(true)
    try {
      const evId   = ev?.id ?? null
      const format = ev?.format ?? 'group_then_knockout'

      let qualified
      if (format === 'knockout_only') {
        // Pure knockout: seed imported players directly (by creation order → seed 1…N)
        if (allPlayers.length === 0)
          throw new Error('Chưa có VĐV nào. Hãy import VĐV trước.')
        qualified = [...allPlayers]
          .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
          .map((p, i) => ({
            player_id:   p.id,
            seed:        i + 1,
            player_name: p.name,
            club:        p.club,
          }))
      } else {
        const numFirst  = ev?.num_first_place_qualify  ?? t.num_first_place_qualify  ?? 12
        const numSecond = ev?.num_second_place_qualify ?? t.num_second_place_qualify ?? 4
        qualified = await getQualifiedPlayers(t.id, numFirst, numSecond, evId)
        if (qualified.length === 0)
          throw new Error('Chưa có VĐV đủ điều kiện. Hoàn thành vòng bảng trước.')
      }

      const saved = await saveKnockoutBracket(qualified, t.id, evId)
      setMatches(saved)

      // For knockout_only, advance event status to 'knockout' (no group stage transition)
      if (format === 'knockout_only' && evId && ev?.status === 'setup') {
        const { data: updatedEv } = await supabase
          .from('events').update({ status: 'knockout' }).eq('id', evId).select().single()
        if (updatedEv) setEvent(updatedEv)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  // ── Handlers for lottery draw setup ────────────────────────────────────────
  async function handleAutoGenerate() {
    setPendingSetup(false)
    await generateBracket(tournament, players, event)
  }

  function handleDrawKnockoutConfirmed(savedMatches) {
    setMatches(savedMatches)
    setPendingSetup(false)
    setDrawMode('auto')
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

  // Show only stages that actually have matches in this bracket
  const visibleStages = useMemo(() => {
    if (matches.length === 0) return ALL_STAGES.slice(2) // default: show from 1/8
    return ALL_STAGES.filter(s =>
      s.key === 'final' || (byStage[s.key] || []).length > 0
    )
  }, [byStage, matches.length])

  // Auto-select the first visible stage — runs once when real matches first arrive
  useEffect(() => {
    if (matches.length > 0 && !initialStageSet.current) {
      initialStageSet.current = true
      setActiveStage(visibleStages[0]?.key ?? null)
    }
  }, [matches.length, visibleStages])

  const champion = useMemo(() => {
    const fin = byStage['final']?.[0]
    if (fin?.status === 'completed' && fin.winner_id) return playerMap[fin.winner_id]
    return null
  }, [byStage, playerMap])

  // ── Render ──────────────────────────────────────────────────────────────────
  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-500">Đang tạo cây knockout...</p>
      </div>
    )
  }
  if (loading) {
    return <MatchBracketSkeleton />
  }

  const disciplineIcon  = event ? (DISCIPLINE_ICONS[event.discipline] ?? '🏸') : null
  const disciplineLabel = event ? (DISCIPLINE_LABELS[event.discipline] ?? event.name) : null
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

  const isCreator = !!profile && tournament?.creator_id === profile.id
  const canManage = isCreator || profile?.role === 'admin'    // setup, export
  const canScore  = canManage || profile?.role === 'umpire'   // score entry

  // ── Lottery draw setup (knockout_only, no bracket yet) — creator/admin only ─
  if (pendingSetup && canManage) {
    const disciplineIcon2  = event ? (DISCIPLINE_ICONS[event.discipline] ?? '🏸') : null
    const disciplineLabel2 = event ? (DISCIPLINE_LABELS[event.discipline] ?? event.name) : null

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {eventId ? (
          <Breadcrumb
            className="mb-6"
            items={[
              { label: 'Trang chủ', href: '/' },
              { label: tournament?.name, href: `/tournament/${id}` },
              { label: disciplineLabel2, href: `/tournament/${id}/event/${eventId}/setup` },
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
              {disciplineIcon2 ?? <Swords className="w-6 h-6 text-purple-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 truncate">
                {disciplineLabel2 ? `${disciplineLabel2} — Tạo Bracket Knockout` : tournament?.name}
              </h1>
              <p className="text-sm text-gray-500 mt-1">{players.length} VĐV · Chọn cách phân hạt giống</p>
            </div>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm font-semibold text-gray-700 mb-4">Chọn cách phân hạt giống:</p>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <button
              onClick={() => setDrawMode('auto')}
              className={cn(
                'flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                drawMode === 'auto'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 bg-white hover:border-gray-300',
              )}
            >
              <Zap className={cn('w-6 h-6', drawMode === 'auto' ? 'text-purple-600' : 'text-gray-400')} />
              <span className={cn('font-semibold text-sm', drawMode === 'auto' ? 'text-purple-700' : 'text-gray-600')}>
                Tự động
              </span>
              <span className="text-xs text-gray-400 text-center">Phân hạt giống theo thứ tự import</span>
            </button>
            <button
              onClick={() => setDrawMode('lottery')}
              className={cn(
                'flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                drawMode === 'lottery'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 bg-white hover:border-gray-300',
              )}
            >
              <Dices className={cn('w-6 h-6', drawMode === 'lottery' ? 'text-purple-600' : 'text-gray-400')} />
              <span className={cn('font-semibold text-sm', drawMode === 'lottery' ? 'text-purple-700' : 'text-gray-600')}>
                Bốc thăm
              </span>
              <span className="text-xs text-gray-400 text-center">Bốc từng VĐV vào hạt giống ngẫu nhiên</span>
            </button>
          </div>

          {drawMode === 'auto' ? (
            <button
              onClick={handleAutoGenerate}
              className="w-full py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Tạo Bracket Tự Động
            </button>
          ) : (
            <DrawKnockout
              tournament={tournament}
              event={event}
              players={players}
              onConfirmed={handleDrawKnockoutConfirmed}
            />
          )}
        </div>
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
                {/* Courts tab */}
                <button
                  onClick={() => setActiveStage('courts')}
                  className={cn(
                    'flex flex-col items-center px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                    activeStage === 'courts'
                      ? 'border-purple-600 text-purple-600 bg-purple-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50',
                  )}
                >
                  <span className="flex items-center gap-1"><Grid className="w-3.5 h-3.5" />Sân đấu</span>
                  <span className="text-xs mt-0.5 text-gray-400">
                    {event?.num_courts ?? 2} sân
                  </span>
                </button>

                {visibleStages.map(stage => {
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

          {/* Attendance button (when enabled) */}
          {event?.attendance_enabled && eventId && matches.length > 0 && (
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
        <div className={viewMode === 'bracket' || activeStage === 'courts' ? '' : 'p-6'}>
          {viewMode === 'bracket' ? (
            <div className="p-6">
              <BracketView
                matches={matches}
                playerMap={playerMap}
                onMatchClick={canScore ? (m) => { if (!m.is_forfeit) setScoreMatch(m) } : null}
                containerRef={bracketRef}
                tournamentName={tournament?.name}
              />
            </div>
          ) : activeStage === 'courts' ? (
            <CourtBoard
              event={event}
              matches={matches}
              playerMap={playerMap}
              scoringRules={event?.scoring_rules ?? null}
              onMatchUpdated={m => setMatches(prev => prev.map(p => p.id === m.id ? m : p))}
              onRefresh={fetchAll}
              umpireMap={umpireMap}
              onAssignUmpire={canUseUmpire ? setAssignMatch : null}
              tournamentId={id}
              onExternalMatchUpdate={handleRealtimeMatchUpdate}
            />
          ) : activeStage === 'final' ? (
            <FinalsView
              finalMatch={byStage['final']?.[0]}
              thirdMatch={byStage['third_place']?.[0]}
              playerMap={playerMap}
              onMatchClick={canScore ? setScoreMatch : null}
              attendanceEnabled={event?.attendance_enabled ?? false}
              umpireMap={umpireMap}
              onAssignUmpire={canUseUmpire ? setAssignMatch : null}
              onViewRally={setRallyMatch}
            />
          ) : (
            <StageMatchList
              matches={byStage[activeStage] || []}
              playerMap={playerMap}
              onMatchClick={canScore ? setScoreMatch : null}
              attendanceEnabled={event?.attendance_enabled ?? false}
              umpireMap={umpireMap}
              onAssignUmpire={canUseUmpire ? setAssignMatch : null}
              onViewRally={setRallyMatch}
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

// ── StageMatchList ─────────────────────────────────────────────────────────────

function StageMatchList({ matches, playerMap, onMatchClick, attendanceEnabled = false, umpireMap = {}, onAssignUmpire = null, onViewRally = null }) {
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
          attendanceEnabled={attendanceEnabled}
          umpireName={umpireMap[match.umpire_id]?.name ?? null}
          onAssignUmpire={onAssignUmpire ? () => onAssignUmpire(match) : null}
          onViewRally={onViewRally && match.status === 'completed' && match.umpire_id ? () => onViewRally(match) : null}
        />
      ))}
    </div>
  )
}

// ── FinalsView ────────────────────────────────────────────────────────────────

function FinalsView({ finalMatch, thirdMatch, playerMap, onMatchClick, attendanceEnabled = false, umpireMap = {}, onAssignUmpire = null, onViewRally = null }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">🏆 Chung kết</p>
        {finalMatch
          ? <KnockoutMatchCard match={finalMatch} label="Chung kết" playerMap={playerMap} onClick={() => onMatchClick(finalMatch)} highlight attendanceEnabled={attendanceEnabled} umpireName={umpireMap[finalMatch.umpire_id]?.name ?? null} onAssignUmpire={onAssignUmpire ? () => onAssignUmpire(finalMatch) : null} onViewRally={onViewRally && finalMatch.status === 'completed' && finalMatch.umpire_id ? () => onViewRally(finalMatch) : null} />
          : <EmptyMatchCard label="Chung kết" />
        }
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">🥉 Tranh hạng 3</p>
        {thirdMatch
          ? <KnockoutMatchCard match={thirdMatch} label="Tranh hạng 3" playerMap={playerMap} onClick={() => onMatchClick(thirdMatch)} attendanceEnabled={attendanceEnabled} umpireName={umpireMap[thirdMatch.umpire_id]?.name ?? null} onAssignUmpire={onAssignUmpire ? () => onAssignUmpire(thirdMatch) : null} onViewRally={onViewRally && thirdMatch.status === 'completed' && thirdMatch.umpire_id ? () => onViewRally(thirdMatch) : null} />
          : <EmptyMatchCard label="Tranh hạng 3" />
        }
      </div>
    </div>
  )
}

// ── KnockoutMatchCard ─────────────────────────────────────────────────────────

function KnockoutMatchCard({ match, label, playerMap, onClick, highlight = false, attendanceEnabled = false, umpireName = null, onAssignUmpire = null, onViewRally = null }) {
  const p1 = match.player1_id ? (playerMap[match.player1_id] ?? { name: '?', club: '' }) : null
  const p2 = match.player2_id ? (playerMap[match.player2_id] ?? { name: '?', club: '' }) : null
  const done    = match.status === 'completed'
  const isBye   = done && !!match.winner_id && (!match.player1_id || !match.player2_id)
  const isForfeit = !!match.is_forfeit

  // Attendance gating
  const p1Att = attendanceEnabled ? (playerMap[match.player1_id]?.attendance ?? 'present') : 'present'
  const p2Att = attendanceEnabled ? (playerMap[match.player2_id]?.attendance ?? 'present') : 'present'
  const isAttendanceLocked = attendanceEnabled && !done && !!(
    (match.player1_id && p1Att === 'pending') ||
    (match.player2_id && p2Att === 'pending')
  )

  const canClick = !!(p1 && p2) && !isBye && !isForfeit && !isAttendanceLocked

  const scores1 = Array.isArray(match.player1_scores) ? match.player1_scores : []
  const scores2 = Array.isArray(match.player2_scores) ? match.player2_scores : []

  const p1Won = done && match.winner_id === match.player1_id
  const p2Won = done && match.winner_id === match.player2_id

  // Who forfeited (loser in a forfeit match)
  const forfeitLoserId = isForfeit
    ? (match.winner_id === match.player1_id ? match.player2_id : match.player1_id)
    : null
  const forfeitLoser = forfeitLoserId ? (playerMap[forfeitLoserId] ?? null) : null

  return (
    <div
      onClick={canClick ? onClick : undefined}
      role={canClick ? 'button' : undefined}
      tabIndex={canClick ? 0 : undefined}
      onKeyDown={canClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() } : undefined}
      className={cn(
        'group w-full text-left border-2 rounded-xl p-4 transition-all',
        highlight && !isForfeit && 'border-yellow-300 bg-yellow-50',
        isForfeit && 'border-orange-200 bg-orange-50/30',
        isAttendanceLocked && 'border-amber-200 bg-amber-50/30',
        !highlight && !isForfeit && !isAttendanceLocked && done && 'border-green-200 bg-green-50/40 hover:border-blue-300 hover:bg-blue-50',
        !highlight && !isForfeit && !isAttendanceLocked && !done && canClick && 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm cursor-pointer',
        !highlight && !isForfeit && !isAttendanceLocked && !done && !canClick && 'border-dashed border-gray-200 bg-gray-50 cursor-default opacity-60',
      )}
    >
      {/* Label */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{label}</p>

      {/* Player 1 */}
      <PlayerRow
        player={p1}
        scores={scores1}
        opponentScores={scores2}
        isWinner={p1Won}
        isForfeitLoser={isForfeit && match.player1_id === forfeitLoserId}
        placeholder={isBye && !p1 ? 'BYE' : 'Chờ kết quả...'}
        isByeSlot={isBye && !p1}
        isForfeit={isForfeit}
      />

      <div className="text-center text-xs text-gray-300 my-1 font-medium">vs</div>

      {/* Player 2 */}
      <PlayerRow
        player={p2}
        scores={scores2}
        opponentScores={scores1}
        isWinner={p2Won}
        isForfeitLoser={isForfeit && match.player2_id === forfeitLoserId}
        placeholder={isBye && !p2 ? 'BYE' : 'Chờ kết quả...'}
        isByeSlot={isBye && !p2}
        isForfeit={isForfeit}
      />

      {/* Status hint */}
      <div className="mt-3 text-xs flex items-center gap-1">
        {isForfeit ? (
          <>
            <span className="font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">W/O</span>
            <span className="text-orange-600 truncate">
              {forfeitLoser ? `${forfeitLoser.name} không thi đấu` : 'Xử thua bỏ cuộc'}
            </span>
          </>
        ) : isAttendanceLocked ? (
          <>
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-amber-600">Chờ điểm danh VĐV</span>
          </>
        ) : done ? (
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

      {/* Umpire / rally row */}
      {(onAssignUmpire || onViewRally) && (
        <div
          className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100"
          onClick={e => e.stopPropagation()}
        >
          {onAssignUmpire ? (
            <>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <ShieldCheck className="w-3 h-3" />
                {umpireName
                  ? <span className="text-gray-600 font-medium">{umpireName}</span>
                  : <span className="italic">Chưa phân công TT</span>
                }
              </span>
              <div className="flex items-center gap-2">
                {onViewRally && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onViewRally() }}
                    className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium px-2 py-0.5 rounded hover:bg-purple-50 transition-colors"
                  >
                    Rally
                  </button>
                )}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onAssignUmpire() }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-0.5 rounded hover:bg-blue-50 transition-colors"
                >
                  {umpireName ? 'Đổi TT' : 'Phân công'}
                </button>
              </div>
            </>
          ) : onViewRally ? (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onViewRally() }}
              className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium px-2 py-0.5 rounded hover:bg-purple-50 transition-colors"
            >
              Xem Rally Log
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}

function PlayerRow({ player, scores, opponentScores, isWinner, placeholder, isByeSlot, isForfeitLoser = false, isForfeit = false }) {
  const scoreText = !isForfeit && scores && scores.length > 0
    ? scores.map((s, i) => `${s}–${opponentScores?.[i] ?? 0}`).join('  ')
    : null

  if (!player) {
    return (
      <div className={cn('flex items-center gap-2 py-1', isByeSlot ? 'opacity-70' : 'opacity-40')}>
        <div className={cn('w-2 h-2 rounded-full shrink-0', isByeSlot ? 'bg-gray-200' : 'bg-gray-300')} />
        <span className={cn(
          'text-xs',
          isByeSlot
            ? 'text-gray-400 font-semibold tracking-wide uppercase'
            : 'text-gray-400 italic',
        )}>
          {placeholder}
        </span>
      </div>
    )
  }

  return (
    <div className={cn(
      'flex items-center justify-between gap-2 py-1 rounded-lg',
      isWinner && !isForfeitLoser && 'bg-green-100 px-2 -mx-2',
      isForfeitLoser && 'opacity-40',
    )}>
      <div className="flex items-center gap-2 min-w-0">
        {isWinner
          ? <Crown className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
          : <div className="w-3.5 h-3.5 shrink-0" />
        }
        <div className="min-w-0">
          <p className={cn(
            'text-sm truncate',
            isWinner ? 'font-bold text-gray-900' : 'font-medium text-gray-700',
            isForfeitLoser && 'line-through text-gray-400',
          )}>
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
