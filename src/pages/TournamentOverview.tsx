import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/hooks/useAuth'
import { useFeatures } from '@/lib/hooks/useFeatures'
import FeatureGate from '@/components/ui/FeatureGate'
import {
  Trophy, Users, ChevronRight, Loader2, Settings, LayoutList,
  GitBranch, Star, AlertCircle, Plus, X, Crown, MapPin, Calendar, ClipboardList,
  ShieldCheck, UserCheck, Ban, Copy, TrendingUp, Layers,
  Clock, Gift, FileText, QrCode, ExternalLink, CheckCircle2, Edit2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  DISCIPLINE_LABELS, DISCIPLINE_ICONS, DISCIPLINE_LIST,
  EVENT_STATUS_BADGE,
} from '@/lib/constants'

const GENDER_RULES = {
  mens_singles:   ['male'],
  womens_singles: ['female'],
  mens_doubles:   ['male'],
  womens_doubles: ['female'],
  mixed_doubles:  ['male', 'female'],
}

function genderLabel(allowed) {
  if (allowed?.length === 1) return allowed[0] === 'male' ? 'Nam' : 'Nữ'
  return 'Nam hoặc Nữ'
}
import { isTournamentComplete, isAgeEligible, getAgeCategoryLabel } from '@/lib/utils/eventHelpers'
import { useI18n } from '@/i18n'
import { TournamentOverviewSkeleton } from '@/components/ui/Skeleton'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Breadcrumb from '@/components/layout/Breadcrumb'
import { cn } from '@/lib/utils/cn'
import UmpireManagement from '@/components/tournament/UmpireManagement'
import RegistrationReview from '@/components/tournament/RegistrationReview'
import RegistrationModal from '@/components/athlete/RegistrationModal'

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
// Module-level caches for active fetches to prevent concurrent duplicate queries
const activeOverviewPageFetches = new Map<string, Promise<{
  tournament: any
  events: any[]
  matchStatsMap: Record<string, { total: number, completed: number }>
  championMap: Record<string, string>
  playerCounts: Record<string, number>
}>>()
const activePendingCountFetches = new Map<string, Promise<number>>()
const activeMyRegFetches = new Map<string, Promise<Set<string>>>()
const activeAthleteProfileFetches = new Map<string, Promise<{ gender: any, dob: any }>>()

export default function TournamentOverview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile, role } = useAuth()
  const { hasFeature } = useFeatures()
  const { t } = useI18n()
  const [tournament, setTournament]   = useState(null)
  const [events, setEvents]           = useState([])
  const [matchStatsMap, setMatchStatsMap] = useState<Record<string, { total: number, completed: number }>>({})
  const [championMap, setChampionMap] = useState<Record<string, string>>({})
  const [eventPlayerCounts, setEventPlayerCounts] = useState<Record<string, number>>({})
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [activeTab, setActiveTab]     = useState('events')
  const [pendingCount, setPendingCount] = useState(0)
  const [showQrModal, setShowQrModal]   = useState(false)
  const [myRegEventIds, setMyRegEventIds] = useState(new Set())
  const [showRegModal, setShowRegModal]   = useState(false)
  const [athleteGender, setAthleteGender] = useState(undefined) // undefined = not loaded yet
  const [athleteDob,    setAthleteDob]    = useState(undefined) // undefined = not loaded yet
  const [showAutoOpenRegModal, setShowAutoOpenRegModal] = useState(false)

  useEffect(() => {
    if (!tournament || !events.length || !profile?.id) return
    const isCreator = tournament.creator_id === profile.id
    if (!isCreator) return

    const allConfigured = events.every(e => e.setup_complete || (eventPlayerCounts[e.id] || 0) > 0)
    const regClosed = !tournament.registration_open
    const promptedKey = `prompted_reg_open_${tournament.id}`
    const alreadyPrompted = localStorage.getItem(promptedKey) === 'true'

    if (allConfigured && regClosed && !alreadyPrompted) {
      setShowAutoOpenRegModal(true)
      localStorage.setItem(promptedKey, 'true')
    }
  }, [tournament, events, profile?.id, eventPlayerCounts])

  async function handleAutoOpenRegistration() {
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ registration_open: true })
        .eq('id', tournament.id)
      if (error) throw error
      setTournament(prev => prev ? { ...prev, registration_open: true } : null)
      setShowAutoOpenRegModal(false)
    } catch (err) {
      console.error('Lỗi khi mở đăng ký:', err)
    }
  }

  useEffect(() => {
    fetchData(true, false)

    const channel = supabase
      .channel(`tournament-overview-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events', filter: `tournament_id=eq.${id}` },
        () => fetchData(false, true)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` },
        (payload) => { if (payload.new) setTournament(payload.new) }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  useEffect(() => {
    if (!id) return
    let activePromise = activePendingCountFetches.get(id)
    if (!activePromise) {
      activePromise = Promise.resolve(supabase
        .from('tournament_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', id)
        .eq('status', 'pending')
      )
        .then(({ count }) => count ?? 0)
        .finally(() => {
          if (activePendingCountFetches.get(id) === activePromise) {
            activePendingCountFetches.delete(id)
          }
        })
      activePendingCountFetches.set(id, activePromise)
    }
    activePromise.then(count => setPendingCount(count))
  }, [id])

  useEffect(() => {
    if (!id || !profile?.id || profile.role !== 'athlete') return
    const cacheKey = `${id}-${profile.id}`
    let activePromise = activeMyRegFetches.get(cacheKey)
    if (!activePromise) {
      activePromise = Promise.resolve(supabase
        .from('tournament_registrations')
        .select('event_id')
        .eq('tournament_id', id)
        .eq('athlete_id', profile.id)
      )
        .then(({ data }) => new Set((data || []).map(r => r.event_id)))
        .finally(() => {
          if (activeMyRegFetches.get(cacheKey) === activePromise) {
            activeMyRegFetches.delete(cacheKey)
          }
        })
      activeMyRegFetches.set(cacheKey, activePromise)
    }
    activePromise.then(set => setMyRegEventIds(set))
  }, [id, profile?.id, profile?.role])

  useEffect(() => {
    if (!profile?.id || profile.role !== 'athlete') return
    const key = profile.id
    let activePromise = activeAthleteProfileFetches.get(key)
    if (!activePromise) {
      activePromise = Promise.resolve(supabase
        .from('profiles')
        .select('gender, dob')
        .eq('id', profile.id)
        .single()
      )
        .then(({ data }) => ({
          gender: data?.gender ?? null,
          dob: data?.dob ?? null,
        }))
        .finally(() => {
          if (activeAthleteProfileFetches.get(key) === activePromise) {
            activeAthleteProfileFetches.delete(key)
          }
        })
      activeAthleteProfileFetches.set(key, activePromise)
    }
    activePromise.then(res => {
      setAthleteGender(res.gender)
      setAthleteDob(res.dob)
    })
  }, [profile?.id, profile?.role])

  async function fetchData(showLoading = true, force = false) {
    if (!id) return
    if (showLoading) setLoading(true)
    setError(null)
    try {
      let fetchPromise = !force ? activeOverviewPageFetches.get(id) : null
      if (!fetchPromise) {
        fetchPromise = (async () => {
          const [tRes, eRes, mRes, pRes] = await Promise.all([
            supabase.from('tournaments').select('*').eq('id', id).single(),
            supabase.from('events').select('*').eq('tournament_id', id).order('sort_order'),
            supabase.from('matches').select('event_id, status, stage, winner_id').eq('tournament_id', id),
            supabase.from('players').select('id, event_id').eq('tournament_id', id),
          ])
          if (tRes.error) throw tRes.error
          if (eRes.error) throw eRes.error

          const stats: Record<string, { total: number, completed: number }> = {}
          const finalWinners: Record<string, string> = {}
          for (const m of mRes.data || []) {
            if (!m.event_id) continue
            if (!stats[m.event_id]) stats[m.event_id] = { total: 0, completed: 0 }
            stats[m.event_id].total++
            if (m.status === 'completed') stats[m.event_id].completed++
            if (m.stage === 'final' && m.status === 'completed' && m.winner_id) {
              finalWinners[m.event_id] = m.winner_id
            }
          }

          let championMapData: Record<string, string> = {}
          const winnerIds = [...new Set(Object.values(finalWinners))]
          if (winnerIds.length > 0) {
            const { data: players } = await supabase
              .from('players').select('id, name').in('id', winnerIds)
            const playerMap = Object.fromEntries((players || []).map(p => [p.id, p.name]))
            championMapData = Object.fromEntries(
              Object.entries(finalWinners).map(([evId, pId]) => [evId, playerMap[pId] ?? null])
            )
          }

          const playerCounts: Record<string, number> = {}
          for (const p of pRes.data || []) {
            if (p.event_id) {
              playerCounts[p.event_id] = (playerCounts[p.event_id] || 0) + 1
            }
          }

          return {
            tournament: tRes.data,
            events: eRes.data || [],
            matchStatsMap: stats,
            championMap: championMapData,
            playerCounts,
          }
        })().finally(() => {
          if (activeOverviewPageFetches.get(id) === fetchPromise) {
            activeOverviewPageFetches.delete(id)
          }
        })

        if (!force) {
          activeOverviewPageFetches.set(id, fetchPromise)
        }
      }

      const res = await fetchPromise
      setTournament(res.tournament)
      setEvents(res.events)
      setMatchStatsMap(res.matchStatsMap)
      setChampionMap(res.championMap)
      setEventPlayerCounts(res.playerCounts || {})
    } catch (err: any) {
      setError(err.message)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  if (loading) {
    return <TournamentOverviewSkeleton />
  }

  if (error || !tournament) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-600">{error || t('overview.notFound')}</p>
        <Link to="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline">← {t('common.home')}</Link>
      </div>
    )
  }

  const allDone        = isTournamentComplete(events)
  const usedDisciplines = new Set(events.map(e => e.discipline))
  const canAddEvent    = !allDone && usedDisciplines.size < DISCIPLINE_LIST.length
  const isCreator      = !!profile && tournament?.creator_id === profile.id
  const isAdmin        = profile?.role === 'admin'
  const isAthlete      = profile?.role === 'athlete'
  const canRegister    = isAthlete && tournament?.registration_open && tournament.status !== 'completed'
  const alreadyRegAll  = canRegister && events.length > 0 && events.every(e => myRegEventIds.has(e.id))
  const allRemainingBlocked = canRegister && events.length > 0
    && events.filter(e => !myRegEventIds.has(e.id)).length > 0
    && events.filter(e => !myRegEventIds.has(e.id)).every(e => {
      // blocked by gender
      if (athleteGender != null) {
        const allowed = GENDER_RULES[e.discipline]
        if (allowed && !allowed.includes(athleteGender)) return true
      }
      // blocked by age
      if (!isAgeEligible(athleteDob ?? null, e.age_category)) return true
      return false
    })
  const isSuspended    = !!tournament?.is_suspended
  const canUseUmpire   = role === 'admin' || hasFeature('umpire_assign')

  if (activeTab === 'umpires' && !canUseUmpire) setActiveTab('events')

  const totalMatches     = Object.values(matchStatsMap).reduce((s, v) => s + v.total, 0)
  const completedMatches = Object.values(matchStatsMap).reduce((s, v) => s + v.completed, 0)
  const completedEvents  = events.filter(e => e.status === 'completed').length

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Breadcrumb */}
      <Breadcrumb
        className="mb-6"
        items={[
          { label: t('common.home'), href: '/' },
          { label: tournament.name },
        ]}
      />

      {/* Suspension banner */}
      {isSuspended && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <Ban className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-red-800 text-sm">{t('overview.suspended')}</p>
              {tournament.suspended_reason ? (
                <p className="text-sm text-red-600 mt-0.5">{tournament.suspended_reason}</p>
              ) : (
                <p className="text-sm text-red-500 mt-0.5">{t('overview.suspendedDefault')}</p>
              )}
              {!isAdmin && (
                <p className="text-xs text-red-400 mt-1.5">{t('overview.suspendedHint')}</p>
              )}
              {isAdmin && (
                <p className="text-xs text-red-400 mt-1.5">{t('overview.suspendedAdmin')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Completed banner */}
      {allDone && (
        <div className="bg-linear-to-r from-yellow-400 to-orange-400 rounded-2xl px-4 sm:px-6 py-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-white shrink-0" />
            <div>
              <p className="text-white font-bold">{t('overview.completedBanner')}</p>
              <p className="text-yellow-100 text-sm">{t('overview.completedSubtitle')}</p>
            </div>
          </div>
          <Link
            to={`/tournament/${id}/results`}
            className="shrink-0 flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            {t('overview.viewResults')} <ChevronRight className="w-4 h-4" />
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
              {tournament.registration_open ? (
                <Badge variant="green">
                  {t('home.openRegistration')}
                </Badge>
              ) : (
                <Badge variant={allDone ? 'green' : tournament.status === 'knockout' ? 'purple' : tournament.status === 'group_stage' ? 'blue' : 'yellow'}>
                  {t('status.' + tournament.status) || tournament.status}
                </Badge>
              )}
            </div>

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
              {tournament.registration_deadline && (
                <span className="flex items-center gap-1 text-amber-600">
                  <Clock className="w-3.5 h-3.5" />
                  Hạn ĐK: {new Date(tournament.registration_deadline).toLocaleDateString('vi-VN')}
                </span>
              )}
            </div>

            {events.length > 0 && (
              <div className="flex items-center gap-5 text-sm">
                <span className="text-gray-600">
                  <span className="font-semibold text-gray-900">{completedEvents}</span>
                  <span className="text-gray-400">/{events.length}</span>
                  <span className="text-gray-500 ml-1">{t('overview.eventsCompleted', { done: '', total: '' }).replace('{done}/', '').replace('/{total}', '').trim() || 'events done'}</span>
                </span>
                {totalMatches > 0 && (
                  <span className="text-gray-600">
                    <span className="font-semibold text-gray-900">{completedMatches}</span>
                    <span className="text-gray-400">/{totalMatches}</span>
                    <span className="text-gray-500 ml-1">{t('live.set') === 'Set' ? 'matches' : 'trận'}</span>
                  </span>
                )}
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
              <Link
                to={`/tournament/${id}/live`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
              >
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                {t('overview.liveScoreboard')}
              </Link>
              <Link
                to={`/tournament/${id}/stats`}
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
              >
                <TrendingUp className="w-3 h-3" />
                {t('overview.athleteStats')}
              </Link>
              {(isCreator || isAdmin) && (
                <Link
                  to={`/tournament/${id}/courts`}
                  className="inline-flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
                >
                  <Layers className="w-3 h-3" />
                  {t('overview.manageCourts')}
                </Link>
              )}
              {(isCreator || isAdmin) && (
                <button
                  onClick={() => setShowCloneModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {t('overview.cloneTournament')}
                </button>
              )}
              {(isCreator || isAdmin) && (
                <Link
                  to={`/tournament/${id}/edit`}
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Chỉnh sửa giải đấu
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Prize / Regulations / Chat QR */}
      {(tournament.prize_structure || tournament.regulations_url || tournament.chat_qr_url) && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5">
          {tournament.prize_structure && (
            <div className={cn(tournament.regulations_url || tournament.chat_qr_url ? 'mb-4' : '')}>
              <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-yellow-500" />
                Cơ cấu giải thưởng
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{tournament.prize_structure}</p>
            </div>
          )}

          {(tournament.regulations_url || tournament.chat_qr_url) && (
            <div className={cn(
              'flex gap-3 flex-wrap',
              tournament.prize_structure && 'pt-4 border-t border-gray-100',
            )}>
              {tournament.regulations_url && (
                <button
                  onClick={() => window.open(tournament.regulations_url, '_blank', 'noopener,noreferrer')}
                  className="flex-1 w-full sm:min-w-[160px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  Xem Điều lệ giải đấu
                  <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70" />
                </button>
              )}
              {tournament.chat_qr_url && (
                <button
                  onClick={() => setShowQrModal(true)}
                  className="flex-1 w-full sm:min-w-[140px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                >
                  <QrCode className="w-4 h-4 shrink-0" />
                  QR nhóm chat
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Athlete: registration CTA */}
      {isAthlete && events.length > 0 && !allDone && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5">
          <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Đăng ký thi đấu</p>

          {/* No gender on profile → prompt to update */}
          {athleteGender === null && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-3 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                Cập nhật giới tính trong{' '}
                <Link to="/profile" className="font-semibold underline hover:text-amber-900">hồ sơ</Link>
                {' '}để đăng ký tham gia.
              </span>
            </div>
          )}

          <div className="space-y-1.5 mb-4">
            {events.map(ev => {
              const registered     = myRegEventIds.has(ev.id)
              const allowedGenders = GENDER_RULES[ev.discipline]
              const genderBlocked  = athleteGender !== undefined && athleteGender !== null
                && allowedGenders && !allowedGenders.includes(athleteGender)
              const ageBlocked     = !isAgeEligible(athleteDob ?? null, ev.age_category)
              const ageLabel       = ev.age_category && ev.age_category !== 'open'
                ? getAgeCategoryLabel(ev.age_category) : null
              return (
                <div key={ev.id} className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-700 flex items-center gap-1.5">
                    <span>{DISCIPLINE_ICONS[ev.discipline] ?? '🏸'}</span>
                    {DISCIPLINE_LABELS[ev.discipline] ?? ev.name}
                    {ageLabel && (
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                        {ageLabel}
                      </span>
                    )}
                  </span>
                  {registered ? (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Đã đăng ký
                    </span>
                  ) : genderBlocked ? (
                    <span className="text-xs text-gray-400 italic">
                      Dành cho {genderLabel(allowedGenders)}
                    </span>
                  ) : ageBlocked && !registered ? (
                    <span className="text-xs text-gray-400 italic">
                      {athleteDob === null ? 'Cần ngày sinh' : 'Không đủ tuổi'}
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
          {canRegister ? (
            <button
              onClick={() => setShowRegModal(true)}
              disabled={alreadyRegAll || athleteGender === null || allRemainingBlocked}
              title={
                athleteGender === null      ? 'Cập nhật giới tính trong hồ sơ trước'
                : allRemainingBlocked       ? 'Không có nội dung phù hợp'
                : undefined
              }
              className={cn(
                'w-full py-2.5 rounded-xl text-sm font-semibold transition-colors',
                alreadyRegAll || athleteGender === null || allRemainingBlocked
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700',
              )}
            >
              {alreadyRegAll          ? 'Đã đăng ký tất cả nội dung'
                : allRemainingBlocked ? 'Không có nội dung phù hợp'
                : '+ Đăng ký tham gia'}
            </button>
          ) : (
            <div className="w-full py-2.5 rounded-xl text-sm text-center text-gray-400 bg-gray-50">
              {tournament.status === 'group_stage' || tournament.status === 'knockout'
                ? 'Giải đang diễn ra — đã đóng đăng ký'
                : 'Chưa mở đăng ký'}
            </div>
          )}
        </div>
      )}

      {/* Athlete: registration modal */}
      {showRegModal && (
        <RegistrationModal
          tournament={tournament}
          events={events}
          athleteId={profile.id}
          athleteName={profile.name}
          existingEventIds={myRegEventIds}
          athleteGender={athleteGender}
          athleteDob={athleteDob}
          onClose={() => setShowRegModal(false)}
          onSuccess={() => {
            setShowRegModal(false)
            supabase
              .from('tournament_registrations')
              .select('event_id')
              .eq('tournament_id', id)
              .eq('athlete_id', profile.id)
              .then(({ data }) => setMyRegEventIds(new Set((data || []).map(r => r.event_id))))
          }}
        />
      )}

      {/* Auto Open Registration Modal */}
      {showAutoOpenRegModal && tournament && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all p-6 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500">
              <Trophy className="w-8 h-8 animate-bounce" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Hoàn tất cấu hình giải đấu! 🎉</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Tất cả các nội dung thi đấu trong giải đấu đã được thiết lập cấu hình hoàn chỉnh. Bạn có muốn mở cổng đăng ký cho các vận động viên tham gia ngay bây giờ không?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAutoOpenRegModal(false)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Để sau
              </button>
              <button
                onClick={handleAutoOpenRegistration}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Mở đăng ký ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick event switcher strip */}
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

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('events')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'events'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          )}
        >
          <LayoutList className="w-4 h-4" />
          {t('overview.eventsTab', { n: events.length })}
        </button>

        {isCreator && (
          <>
            {canUseUmpire && (
              <button
                onClick={() => setActiveTab('umpires')}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === 'umpires'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700',
                )}
              >
                <ShieldCheck className="w-4 h-4" />
                {t('overview.umpiresTab')}
              </button>
            )}
            <button
              onClick={() => setActiveTab('registrations')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === 'registrations'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              <UserCheck className="w-4 h-4" />
              {t('overview.registrationsTab')}
              {pendingCount > 0 && (
                <span className="ml-1 bg-yellow-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </button>

            <Link
              to={`/tournament/${id}/report`}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-500 hover:text-green-700 border-b-2 border-transparent -mb-px transition-colors"
            >
              {t('overview.reportTab')}
            </Link>
          </>
        )}
      </div>

      {/* Tab: Events */}
      {activeTab === 'events' && (
        <>
          {isCreator && tournament.status !== 'completed' && (
            <RegistrationToggle
              tournamentId={id}
              isOpen={!!tournament.registration_open}
              onChange={val => setTournament(prev => ({ ...prev, registration_open: val }))}
              t={t}
            />
          )}

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              {t('overview.eventsTab', { n: events.length })}
            </h2>
            {isCreator && canAddEvent && !isSuspended && (
              <Button size="sm" variant="secondary" onClick={() => setShowAddModal(true)}>
                <Plus className="w-4 h-4" />
                {t('overview.addEvent')}
              </Button>
            )}
          </div>

          {events.length === 0 ? (
            <div className="text-center py-16 bg-white border border-dashed border-gray-300 rounded-2xl">
              <p className="text-gray-400 text-sm mb-4">{t('overview.noEvents')}</p>
              {isCreator && !isSuspended && (
                <Button onClick={() => setShowAddModal(true)}>
                  <Plus className="w-4 h-4" />
                  {t('overview.addEvent')}
                </Button>
              )}
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
                  playerCount={eventPlayerCounts[event.id] || 0}
                  suspended={isSuspended && !isAdmin}
                  canManage={isCreator || isAdmin}
                  t={t}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab: Umpires */}
      {isCreator && activeTab === 'umpires' && (
        <FeatureGate feature="umpire_assign">
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <UmpireManagement tournamentId={id} />
          </div>
        </FeatureGate>
      )}

      {/* Tab: Registrations */}
      {isCreator && activeTab === 'registrations' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <RegistrationReview tournamentId={id} tournamentName={tournament?.name} />
        </div>
      )}

      {/* Add Event Modal */}
      {showAddModal && (
        <AddEventModal
          tournamentId={id}
          creatorId={profile?.id}
          usedDisciplines={usedDisciplines}
          onClose={() => setShowAddModal(false)}
          onAdded={() => { setShowAddModal(false); fetchData(false) }}
          t={t}
        />
      )}

      {/* Chat QR Modal */}
      {showQrModal && (
        <QrModal url={tournament?.chat_qr_url} onClose={() => setShowQrModal(false)} />
      )}

      {/* Clone Tournament Modal */}
      {showCloneModal && (
        <CloneTournamentModal
          tournament={tournament}
          events={events}
          profile={profile}
          onClose={() => setShowCloneModal(false)}
          onCloned={(newId) => navigate(`/tournament/${newId}`)}
          t={t}
        />
      )}
    </div>
  )
}

// ── Event card ────────────────────────────────────────────────────────────────
function EventCard({ event, tournamentId, matchStats, champion, playerCount = 0, suspended = false, canManage = false, t }) {
  const icon     = DISCIPLINE_ICONS[event.discipline] ?? '🏸'
  const label    = DISCIPLINE_LABELS[event.discipline] ?? event.name
  const isSetupReady = event.status === 'setup' && (event.setup_complete || playerCount > 0)
  const ctaHref  = isSetupReady
    ? `/tournament/${tournamentId}/event/${event.id}/players`
    : eventRoute(tournamentId, event.id, event.status)
  const progress = matchStats && matchStats.total > 0
    ? Math.round((matchStats.completed / matchStats.total) * 100)
    : null

  const stripColor = {
    completed:   'bg-green-400',
    knockout:    'bg-purple-400',
    group_stage: 'bg-blue-400',
    attendance:  'bg-orange-400',
    setup:       (event.setup_complete || playerCount > 0) ? 'bg-blue-400' : 'bg-gray-200',
  }[event.status] ?? 'bg-gray-200'

  const ctaLabel = isSetupReady
    ? 'Vận động viên'
    : t(`overview.cta.${event.status}`) || t('overview.cta.default')

  const badgeVariant = isSetupReady ? 'blue' : EVENT_STATUS_BADGE[event.status] || 'default'
  const badgeLabel = isSetupReady ? 'Sẵn sàng' : t('status.' + event.status) || event.status

  const isDoubles = ['mens_doubles', 'womens_doubles', 'mixed_doubles'].includes(event.discipline)
  const slotUnit = isDoubles ? 'đôi' : 'VĐV'

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-blue-200 transition-all group">
      <div className={`h-1.5 ${stripColor}`} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl leading-none shrink-0">{icon}</span>
            <p className="font-semibold text-gray-900 text-sm truncate">{label}</p>
          </div>
          <Badge variant={badgeVariant} className="shrink-0">
            {badgeLabel}
          </Badge>
        </div>

        {event.status === 'completed' && champion && (
          <div className="flex items-center gap-1.5 mb-3 bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-1.5">
            <Crown className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
            <span className="text-xs font-semibold text-yellow-800 truncate">{champion}</span>
          </div>
        )}

        {progress !== null && event.status !== 'setup' && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>{matchStats.completed}/{matchStats.total} {t('live.set') === 'Set' ? 'matches' : 'trận'}</span>
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

        <div className="space-y-1.5 mb-4 text-xs text-gray-500">
          <div className="flex items-center gap-3">
            {event.format === 'group_then_knockout' ? (
              <>
                <span className="flex items-center gap-1">
                  <LayoutList className="w-3.5 h-3.5" />
                  {t('overview.card.groups', { n: event.num_groups ?? '–' })}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {t('overview.card.qualifyKnockout', { n: (event.num_first_place_qualify ?? 0) + (event.num_second_place_qualify ?? 0) + (event.num_third_place_qualify ?? 0) })}
                </span>
              </>
            ) : event.format === 'knockout_only' ? (
              <span className="flex items-center gap-1">
                <GitBranch className="w-3.5 h-3.5" />
                {t('overview.card.directKnockout')}
              </span>
            ) : event.format === 'round_robin' ? (
              <span className="flex items-center gap-1">
                <LayoutList className="w-3.5 h-3.5" />
                Vòng tròn ({event.num_groups ?? 1} bảng)
              </span>
            ) : (
              <span className="text-gray-300 italic">{t('overview.card.notConfigured')}</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span>Đăng ký: <strong>{playerCount}</strong> / {event.max_teams ? `${event.max_teams} ${slotUnit}` : 'không giới hạn'}</span>
          </div>
        </div>

        {suspended ? (
          <div className="flex items-center justify-center w-full px-3 py-2 bg-red-50 border border-red-100 text-red-400 rounded-lg text-xs font-medium">
            <Ban className="w-3.5 h-3.5 mr-1.5" />
            {t('overview.card.disabled')}
          </div>
        ) : canManage ? (
          <Link
            to={ctaHref}
            className="flex items-center justify-between w-full px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors"
          >
            <span className="flex items-center gap-1.5">
              {isSetupReady ? <Users className="w-4 h-4" /> : eventCTAIcon(event.status)}
              {ctaLabel}
            </span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ) : event.status !== 'setup' ? (
          <Link
            to={`/tournament/${tournamentId}/event/${event.id}/bracket`}
            className="flex items-center justify-between w-full px-3 py-2 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-700 rounded-lg text-sm font-medium transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5" />
              Xem bracket
            </span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ) : null}

        {canManage && isSetupReady && (
          <Link
            to={`/tournament/${tournamentId}/event/${event.id}/setup`}
            className="flex items-center justify-center gap-1 mt-2 text-xs text-gray-400 hover:text-blue-600 transition-colors py-1 bg-gray-50/50 hover:bg-gray-50 border border-gray-100 rounded-lg font-medium"
          >
            <Settings className="w-3 h-3" />
            Cấu hình nội dung
          </Link>
        )}

        {canManage && event.status !== 'setup' && (
          <Link
            to={`/tournament/${tournamentId}/event/${event.id}/bracket`}
            className="flex items-center gap-1.5 mt-2 text-xs text-gray-400 hover:text-blue-600 transition-colors"
          >
            <GitBranch className="w-3 h-3" />
            Xem bracket
          </Link>
        )}
      </div>
    </div>
  )
}

// ── QR chat modal ────────────────────────────────────────────────────────────
function QrModal({ url, onClose }) {
  const [imgState, setImgState] = useState('loading') // 'loading' | 'ok' | 'error'

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-bold text-gray-900 flex items-center gap-2">
            <QrCode className="w-4 h-4 text-green-600" />
            QR nhóm chat
          </p>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image area */}
        <div className="p-5">
          {imgState === 'loading' && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
            </div>
          )}
          {imgState === 'error' && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-sm text-red-600 font-medium">Không tải được hình QR</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                Mở trực tiếp →
              </a>
            </div>
          )}
          <img
            src={url}
            alt="QR nhóm chat"
            onLoad={() => setImgState('ok')}
            onError={() => setImgState('error')}
            className={cn(
              'w-full max-w-[280px] mx-auto block rounded-xl border border-gray-100',
              imgState !== 'ok' && 'hidden',
            )}
          />
        </div>

        {imgState === 'ok' && (
          <div className="px-5 pb-5 text-center">
            <p className="text-xs text-gray-400">Dùng camera quét QR để tham gia nhóm chat</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Registration open/close toggle ───────────────────────────────────────────
function RegistrationToggle({ tournamentId, isOpen, onChange, t }) {
  const [saving, setSaving] = useState(false)

  async function toggle() {
    setSaving(true)
    const next = !isOpen
    const { error } = await supabase
      .from('tournaments')
      .update({ registration_open: next })
      .eq('id', tournamentId)
    if (!error) onChange(next)
    setSaving(false)
  }

  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-3 rounded-xl border mb-4',
      isOpen ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200',
    )}>
      <div>
        <p className="text-sm font-semibold text-gray-900">{t('overview.registration')}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {isOpen ? t('overview.registrationOpen') : t('overview.registrationClosed')}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        className={cn(
          'relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50',
          isOpen ? 'bg-green-500' : 'bg-gray-300',
        )}
      >
        <span className={cn(
          'inline-block w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out mt-0.5',
          isOpen ? 'translate-x-5' : 'translate-x-0.5',
        )} />
      </button>
    </div>
  )
}

// ── Clone Tournament Modal ────────────────────────────────────────────────────
function CloneTournamentModal({ tournament, events, profile, onClose, onCloned, t }) {
  const [name, setName]         = useState(`${tournament.name} (${t('overview.clone.cloneBtn').toLowerCase()})`)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]   = useState('')
  const [location, setLocation] = useState(tournament.location ?? '')
  const [cloning, setCloning]   = useState(false)
  const [error, setError]       = useState(null)

  async function handleClone() {
    if (!name.trim()) { setError(t('overview.clone.nameRequired')); return }
    setCloning(true)
    setError(null)
    try {
      const { data: newT, error: tErr } = await supabase
        .from('tournaments')
        .insert({
          name:                           name.trim(),
          start_date:                     startDate || null,
          end_date:                       endDate   || null,
          location:                       location  || null,
          creator_id:                     profile.id,
          status:                         'setup',
          registration_open:              false,
          num_courts:                     tournament.num_courts,
          num_first_place_qualify:        tournament.num_first_place_qualify,
          num_second_place_qualify:       tournament.num_second_place_qualify,
          num_third_place_qualify:        tournament.num_third_place_qualify ?? 0,
          avoid_same_club:                tournament.avoid_same_club ?? true,
          require_player_code:            tournament.require_player_code,
          attendance_enabled:             tournament.attendance_enabled,
        })
        .select()
        .single()
      if (tErr) throw tErr

      if (events.length > 0) {
        const { error: eErr } = await supabase.from('events').insert(
          events.map(e => ({
            tournament_id:            newT.id,
            name:                     e.name,
            discipline:               e.discipline,
            format:                   e.format,
            num_courts:               e.num_courts,
            status:                   'setup',
            scoring_rules:            e.scoring_rules,
            num_first_place_qualify:  e.num_first_place_qualify,
            num_second_place_qualify: e.num_second_place_qualify,
            num_third_place_qualify:  e.num_third_place_qualify ?? 0,
            avoid_same_club:          e.avoid_same_club ?? true,
            sort_order:               e.sort_order,
            require_player_code:      e.require_player_code,
            attendance_enabled:       e.attendance_enabled,
          }))
        )
        if (eErr) throw eErr
      }

      onCloned(newT.id)
    } catch (err) {
      setError(t('overview.clone.cloneError', { msg: err.message }))
      setCloning(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Copy className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-bold text-gray-900">{t('overview.clone.title')}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3">
          <p className="text-xs text-gray-400">
            {t('overview.clone.subtitle', { n: events.length })}
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('overview.clone.newName')}</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('overview.clone.location')}</label>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('overview.clone.locationPh')}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('overview.clone.startDate')}</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('overview.clone.endDate')}</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={cloning}>{t('common.cancel')}</Button>
          <Button onClick={handleClone} loading={cloning} className="flex-1">
            <Copy className="w-3.5 h-3.5" /> {t('overview.clone.cloneBtn')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Add Event Modal ───────────────────────────────────────────────────────────
function AddEventModal({ tournamentId, creatorId, usedDisciplines, onClose, onAdded, t }) {
  const [selected, setSelected] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  const available = DISCIPLINE_LIST.filter(d => !usedDisciplines.has(d.value))

  async function handleAdd() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const { data: limitCheck } = await supabase.rpc('check_event_limit', {
        p_creator_id: creatorId,
        p_tournament_id: tournamentId,
      })
      if (limitCheck?.allowed === false) {
        setError(t('overview.addModal.limitError', {
          plan:    limitCheck.plan_slug ?? 'current',
          max:     limitCheck.max,
          current: limitCheck.current,
        }))
        setSaving(false)
        return
      }

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
      setError(t('overview.addModal.error', { msg: err.message }))
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">{t('overview.addModal.title')}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-2">
          {available.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              {t('overview.addModal.allAdded')}
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

        <div className="px-6 pb-5 flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">{t('common.cancel')}</Button>
          <Button
            onClick={handleAdd}
            loading={saving}
            disabled={!selected || saving}
            className="flex-1"
          >
            {t('common.add')}
          </Button>
        </div>
      </div>
    </div>
  )
}
