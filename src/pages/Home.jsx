import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Trophy, Plus, Calendar, Layers, ChevronRight, ChevronLeft, Loader2,
  Search, MapPin, ArrowRight, Filter, Medal,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { usePlan } from '@/lib/hooks/usePlan'
import { useFeatures } from '@/lib/hooks/useFeatures'
import { useFeatureRegistry } from '@/lib/hooks/useFeatureRegistry'
import { useI18n } from '@/i18n'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

const STATUS_BADGE_VARIANT = {
  setup:       'yellow',
  group_stage: 'blue',
  knockout:    'purple',
  completed:   'green',
}

const PAGE_SIZE = 12

const FILTER_TABS = [
  { value: 'all',       label: 'Tất cả' },
  { value: 'setup',     label: 'Thiết lập' },
  { value: 'open',      label: 'Mở đăng ký', dot: 'bg-green-400' },
  { value: 'active',    label: 'Đang diễn ra', dot: 'bg-blue-400' },
  { value: 'completed', label: 'Hoàn thành', dot: 'bg-gray-400' },
]

function daysLeft(expiresAt) {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt) - Date.now()) / 86_400_000)
}

export default function Home() {
  const { profile, role } = useAuth()
  const navigate = useNavigate()
  const { planData } = usePlan()
  const { features: activeFeatureKeys } = useFeatures()
  const { getAllFeatures } = useFeatureRegistry()
  const { t, lang } = useI18n()

  const [tournaments, setTournaments]   = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [page, setPage]                 = useState(1)
  const [total, setTotal]               = useState(0)
  const [search, setSearch]             = useState('')
  const [debouncedSearch, setDebSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')  // all | setup | open | active | completed

  const [activeSub, setActiveSub]   = useState(null)
  const [subLoading, setSubLoading] = useState(false)

  const isCreator = role === 'creator'
  const isAdmin   = role === 'admin'
  const isPublic  = !profile
  const isAthlete = role === 'athlete'

  const maxTournaments    = planData?.plan?.max_tournaments ?? null
  const activeTournaments = planData?.active_tournament_count ?? 0
  const atTournamentLimit = isCreator && maxTournaments !== null && activeTournaments >= maxTournaments

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  // Load creator subscription
  useEffect(() => {
    if (!isCreator || !profile?.id) return
    setSubLoading(true)
    supabase
      .from('subscriptions')
      .select('expires_at, plan:subscription_plans!plan_id(name, slug)')
      .eq('creator_id', profile.id)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => { setActiveSub(data); setSubLoading(false) })
  }, [isCreator, profile?.id])

  // Refetch when filters or auth change
  useEffect(() => {
    setPage(1)
    fetchTournaments(1)
  }, [profile?.id, role, activeFilter, debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchTournaments(p = 1) {
    setLoading(true)
    setError(null)
    try {
      const from = (p - 1) * PAGE_SIZE
      const to   = from + PAGE_SIZE - 1

      let query = supabase
        .from('tournaments')
        .select('id, name, status, created_at, location, start_date, registration_open, events(count)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      // Creator: own tournaments only
      if (isCreator && profile?.id) {
        query = query.eq('creator_id', profile.id)
      }
      // Admin, guest, athlete: all tournaments

      // Unified filter
      switch (activeFilter) {
        case 'setup':     query = query.eq('status', 'setup'); break
        case 'open':      query = query.eq('registration_open', true); break
        case 'active':    query = query.in('status', ['group_stage', 'knockout']); break
        case 'completed': query = query.eq('status', 'completed'); break
        default: break
      }

      // Server-side search
      if (debouncedSearch.trim()) {
        query = query.or(`name.ilike.%${debouncedSearch.trim()}%,location.ilike.%${debouncedSearch.trim()}%`)
      }

      const { data, error: qErr, count } = await query
      if (qErr) throw qErr
      setTournaments(data || [])
      setTotal(count ?? 0)
    } catch {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  function handlePageChange(p) {
    setPage(p)
    fetchTournaments(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const d = activeSub ? daysLeft(activeSub.expires_at) : null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Header by role */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          {isPublic || isAthlete ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900">{t('home.titlePublic')}</h1>
              <p className="text-gray-500 mt-1">{t('home.subtitlePublic')}</p>
            </>
          ) : isCreator ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900">{t('home.titleCreator')}</h1>
              <p className="text-gray-500 mt-1">{t('home.subtitleCreator')}</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900">{t('home.titleAdmin')}</h1>
              <p className="text-gray-500 mt-1">{t('home.subtitleAdmin')}</p>
            </>
          )}
        </div>

        {(isCreator || isAdmin) && (
          atTournamentLimit ? (
            <Link
              to="/plans"
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-500 text-sm font-medium rounded-lg border border-gray-200 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors"
              title={`Đã đạt giới hạn ${activeTournaments}/${maxTournaments} giải. Nâng cấp để tạo thêm.`}
            >
              <Plus className="w-4 h-4" />
              {t('home.createLimited', { used: activeTournaments, max: maxTournaments })}
            </Link>
          ) : (
            <Link
              to="/tournament/create"
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('home.createBtn')}
            </Link>
          )
        )}

        {isAthlete && (
          <button
            onClick={() => navigate('/athlete')}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            {t('home.myRegistrations')} <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Creator subscription widget */}
      {isCreator && !subLoading && (
        <div className="mb-5 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-500">{t('home.plan')}</span>
              <span className="font-semibold text-gray-900">
                {activeSub?.plan?.name ?? t('home.freePlan')}
              </span>
              {activeSub?.expires_at && d !== null && (
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium',
                  d <= 7 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700',
                )}>
                  {t('home.daysLeft', { days: d })}
                </span>
              )}
              {!activeSub && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                  Free
                </span>
              )}
            </div>
            <Link to="/plans" className="text-xs text-blue-600 hover:underline font-medium shrink-0">
              {!activeSub || activeSub?.plan?.slug === 'free' ? t('home.upgrade') : t('home.renewUpgrade')}
            </Link>
          </div>
          {getAllFeatures().length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {getAllFeatures().map(f => {
                const active = activeFeatureKeys.includes(f.key)
                return (
                  <span
                    key={f.key}
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400',
                    )}
                  >
                    {f.label}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Leaderboard quick link */}
      <Link
        to="/leaderboard"
        className="flex items-center justify-between bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl px-4 py-3 mb-4 hover:border-yellow-300 hover:from-yellow-100 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <Medal className="w-5 h-5 text-yellow-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Bảng xếp hạng VĐV</p>
            <p className="text-xs text-gray-500">Xem top VĐV tốt nhất toàn platform</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-yellow-400 group-hover:text-yellow-600 transition-colors" />
      </Link>

      {/* Search + Filter bar */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-5 flex flex-col gap-3">
        {/* Search row */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('home.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0 mr-1">
            <Filter className="w-3 h-3" />
          </span>
          {FILTER_TABS.map(f => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                activeFilter === f.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {f.dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', activeFilter === f.value ? 'bg-white' : f.dot)} />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      {!loading && total > 0 && (
        <p className="text-xs text-gray-400 mb-3">
          {total} {total === 1 ? 'giải' : 'giải đấu'}
          {debouncedSearch && ` · "${debouncedSearch}"`}
        </p>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700">{error}</p>
          <button onClick={() => fetchTournaments(page)} className="mt-3 text-sm text-red-600 underline">
            {t('common.retry')}
          </button>
        </div>
      ) : tournaments.length === 0 ? (
        <EmptyState role={role} profile={profile} search={debouncedSearch} activeFilter={activeFilter} t={t} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map(tournament => (
              <TournamentCard key={tournament.id} tournament={tournament} isPublic={isPublic} t={t} lang={lang} />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} total={total} onChange={handlePageChange} />
          )}
        </>
      )}

      {/* CTA for unauthenticated */}
      {isPublic && (
        <div className="mt-12 bg-blue-50 border border-blue-100 rounded-2xl p-8 text-center">
          <h3 className="font-bold text-gray-900 mb-2">{t('home.ctaTitle')}</h3>
          <p className="text-gray-500 text-sm mb-5">{t('home.ctaSubtitle')}</p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/register"
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              {t('home.ctaRegister')}
            </Link>
            <Link
              to="/plans"
              className="px-5 py-2.5 border border-gray-200 bg-white text-sm font-medium text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              {t('home.ctaViewPricing')}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tournament card ───────────────────────────────────────────────────────────

function TournamentCard({ tournament: trn, isPublic, t, lang }) {
  const eventCount = trn.events?.[0]?.count ?? 0

  return (
    <Link
      to={`/tournament/${trn.id}`}
      className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-blue-200 transition-all group flex flex-col"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
          <Trophy className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {trn.registration_open && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              {t('home.openRegistration')}
            </span>
          )}
          <Badge variant={STATUS_BADGE_VARIANT[trn.status] || 'default'}>
            {t('status.' + trn.status) || trn.status}
          </Badge>
        </div>
      </div>

      <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors leading-snug">
        {trn.name}
      </h3>

      {trn.location && (
        <p className="text-xs text-gray-400 flex items-center gap-1 mb-1">
          <MapPin className="w-3 h-3 shrink-0" /> {trn.location}
        </p>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-500 mt-auto pt-3 border-t border-gray-50">
        <span className="flex items-center gap-1">
          <Layers className="w-3.5 h-3.5" />
          {t('home.eventCount', { n: eventCount })}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          {trn.start_date
            ? new Date(trn.start_date).toLocaleDateString(lang === 'en' ? 'en-GB' : 'vi-VN')
            : new Date(trn.created_at).toLocaleDateString(lang === 'en' ? 'en-GB' : 'vi-VN')}
        </span>
      </div>

      <div className="flex items-center justify-end mt-2 text-blue-600 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        {isPublic && trn.registration_open ? t('home.loginToRegister') : t('home.viewOverview')}
        <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
      </div>
    </Link>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, total, onChange }) {
  function getPages() {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages = [1]
    if (page > 3) pages.push('…')
    for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) {
      pages.push(p)
    }
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
    return pages
  }

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Trước</span>
        </button>

        {getPages().map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="w-9 text-center text-gray-400 text-sm select-none">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={cn(
                'w-9 h-9 rounded-lg text-sm font-medium transition-colors',
                p === page
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-gray-200 text-gray-700 hover:bg-gray-50',
              )}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <span className="hidden sm:inline">Sau</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-gray-400">
        Trang {page} / {totalPages} · {total} giải đấu
      </p>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ role, profile, search, activeFilter, t }) {
  const isPublic  = !profile
  const isCreator = role === 'creator' || role === 'admin'

  if (search) return (
    <div className="text-center py-16 text-gray-400 text-sm">
      {t('home.noTournamentsSearch', { q: search })}
    </div>
  )

  const filterLabel = FILTER_TABS.find(f => f.value === activeFilter)?.label
  if (activeFilter !== 'all') return (
    <div className="text-center py-16">
      <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
        <Trophy className="w-7 h-7 text-gray-300" />
      </div>
      <p className="text-gray-500 text-sm">Chưa có giải đấu nào với bộ lọc "{filterLabel}".</p>
    </div>
  )

  return (
    <div className="text-center py-24">
      <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <Trophy className="w-8 h-8 text-blue-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {isPublic ? t('home.noTournamentsPublic') : t('home.noTournaments')}
      </h3>
      {isCreator ? (
        <>
          <p className="text-gray-500 mb-6">{t('home.createFirstPrompt')}</p>
          <Link
            to="/tournament/create"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('home.createBtn')}
          </Link>
        </>
      ) : isPublic ? (
        <p className="text-gray-500">{t('home.comeBackLaterPublic')}</p>
      ) : (
        <p className="text-gray-500">{t('home.comeBackLater')}</p>
      )}
    </div>
  )
}
