import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Trophy, Plus, Calendar, Layers, ChevronRight, Loader2,
  ChevronLeft, Search, MapPin, ArrowRight,
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
  const [statusFilter, setStatusFilter] = useState('all')

  const [activeSub, setActiveSub] = useState(null)
  const [subLoading, setSubLoading] = useState(false)

  const isCreator = role === 'creator'
  const isAdmin   = role === 'admin'
  const isPublic  = !profile
  const isAthlete = role === 'athlete' || role === 'umpire'

  const maxTournaments    = planData?.plan?.max_tournaments ?? null
  const activeTournaments = planData?.active_tournament_count ?? 0
  const atTournamentLimit = isCreator && maxTournaments !== null && activeTournaments >= maxTournaments

  useEffect(() => {
    if (!isCreator || !profile?.id) return
    setSubLoading(true)
    supabase
      .from('subscriptions')
      .select('expires_at, plan:subscription_plans!plan_id(name, slug)')
      .eq('creator_id', profile.id)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => {
        setActiveSub(data)
        setSubLoading(false)
      })
  }, [isCreator, profile?.id])

  useEffect(() => {
    setPage(1)
    fetchTournaments(1)
  }, [profile?.id, role, statusFilter])

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

      if (isCreator && profile?.id) {
        query = query.eq('creator_id', profile.id)
      } else if (isPublic || isAthlete) {
        query = query.eq('registration_open', true)
      }

      if (statusFilter !== 'all' && (isCreator || isAdmin)) {
        query = query.eq('status', statusFilter)
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
    window.scrollTo(0, 0)
  }

  const displayed = tournaments.filter(t => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      t.name?.toLowerCase().includes(q) ||
      t.location?.toLowerCase().includes(q)
    )
  })

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
            <Link
              to="/plans"
              className="text-xs text-blue-600 hover:underline font-medium shrink-0"
            >
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

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('home.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {(isCreator || isAdmin) && (
          <div className="flex gap-1 flex-wrap">
            {['all', 'setup', 'group_stage', 'knockout', 'completed'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  statusFilter === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                {s === 'all' ? t('common.all') : t('status.' + s) || s}
              </button>
            ))}
          </div>
        )}
      </div>

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
      ) : displayed.length === 0 ? (
        <EmptyState role={role} profile={profile} search={search} t={t} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayed.map(tournament => (
              <TournamentCard key={tournament.id} tournament={tournament} isPublic={isPublic} t={t} lang={lang} />
            ))}
          </div>

          {totalPages > 1 && !search && (
            <Pagination page={page} totalPages={totalPages} onChange={handlePageChange} />
          )}

          {search && (
            <p className="text-center text-xs text-gray-400 mt-4">
              {t('home.showingCount', { shown: displayed.length, total })}
            </p>
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

function TournamentCard({ tournament: trn, isPublic, t, lang }) {
  const eventCount = trn.events?.[0]?.count ?? 0

  return (
    <Link
      to={`/tournament/${trn.id}`}
      className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-blue-200 transition-all group flex flex-col"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
          <Trophy className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {trn.registration_open && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              {t('home.openRegistration')}
            </span>
          )}
          <Badge variant={STATUS_BADGE_VARIANT[trn.status] || 'default'}>
            {t('status.' + trn.status) || trn.status}
          </Badge>
        </div>
      </div>

      <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
        {trn.name}
      </h3>

      {trn.location && (
        <p className="text-xs text-gray-400 flex items-center gap-1 mb-1">
          <MapPin className="w-3 h-3" /> {trn.location}
        </p>
      )}

      <div className="flex items-center gap-4 text-sm text-gray-500 mt-auto pt-3">
        <span className="flex items-center gap-1">
          <Layers className="w-4 h-4" />
          {t('home.eventCount', { n: eventCount })}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          {trn.start_date
            ? new Date(trn.start_date).toLocaleDateString(lang === 'en' ? 'en-GB' : 'vi-VN')
            : new Date(trn.created_at).toLocaleDateString(lang === 'en' ? 'en-GB' : 'vi-VN')}
        </span>
      </div>

      {isPublic && trn.registration_open && (
        <p className="text-xs text-blue-600 font-medium mt-3">
          {t('home.loginToRegister')}
        </p>
      )}

      {!isPublic && (
        <div className="flex items-center justify-end mt-3 text-blue-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          {t('home.viewOverview')} <ChevronRight className="w-4 h-4 ml-0.5" />
        </div>
      )}
    </Link>
  )
}

function Pagination({ page, totalPages, onChange }) {
  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
        const far = Math.abs(p - page) > 2 && p !== 1 && p !== totalPages
        if (far) {
          if (p === 2 || p === totalPages - 1) return <span key={p} className="text-gray-400 text-sm">…</span>
          return null
        }
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn(
              'w-9 h-9 rounded-lg text-sm font-medium transition-colors',
              p === page
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 text-gray-700 hover:bg-gray-50',
            )}
          >
            {p}
          </button>
        )
      })}

      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

function EmptyState({ role, profile, search, t }) {
  const isPublic  = !profile
  const isCreator = role === 'creator' || role === 'admin'

  if (search) return (
    <div className="text-center py-16 text-gray-400 text-sm">
      {t('home.noTournamentsSearch', { q: search })}
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
