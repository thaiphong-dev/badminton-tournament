import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Zap, Infinity } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils/cn'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useFeatureRegistry } from '@/lib/hooks/useFeatureRegistry'
import { useApiError } from '@/lib/hooks/useApiError'

const PLAN_ACCENT = {
  free:  { border: 'border-gray-200',   badge: null,                        btn: 'bg-gray-100 text-gray-500 cursor-default' },
  basic: { border: 'border-blue-200',   badge: null,                        btn: 'bg-blue-600 hover:bg-blue-700 text-white' },
  pro:   { border: 'border-purple-300', badge: 'bg-purple-600 text-white',  btn: 'bg-purple-600 hover:bg-purple-700 text-white' },
}

export default function PlansPage() {
  const { profile, role } = useAuth()
  const navigate = useNavigate()
  const { getAllFeatures } = useFeatureRegistry()
  const featuresList = getAllFeatures()
  const { handleError } = useApiError()
  const { t, lang } = useI18n()

  const [plans, setPlans]                   = useState([])
  const [currentPlanSlug, setCurrentPlanSlug] = useState('free')
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [planRes, subRes] = await Promise.all([
          supabase
            .from('subscription_plans')
            .select('*')
            .eq('is_active', true)
            .order('sort_order'),
          role === 'creator' && profile?.id
            ? supabase
                .from('subscriptions')
                .select('plan:subscription_plans!plan_id(slug)')
                .eq('creator_id', profile.id)
                .eq('status', 'active')
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ])
        if (planRes.error) throw planRes.error
        setPlans(planRes.data ?? [])
        setCurrentPlanSlug(subRes.data?.plan?.slug ?? 'free')
      } catch (err) {
        handleError(err, 'Không thể tải danh sách gói')
        setError(t('common.error'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [profile?.id, role]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCTA(plan) {
    if (plan.slug === 'free') return
    if (plan.slug === currentPlanSlug) return
    if (!profile) { navigate('/login'); return }
    if (role !== 'creator') return
    navigate(`/checkout/${plan.id}`)
  }

  // Get plan display name based on current language
  function planName(plan) {
    return (lang === 'en' && plan.name_en) ? plan.name_en : plan.name
  }

  // Get plan description based on current language
  function planDescription(plan) {
    if (lang === 'en') return plan.description_en || plan.description_vi || null
    return plan.description_vi || null
  }

  function limitLabel(v) {
    if (v == null) return <span className="flex items-center gap-1"><Infinity className="w-3.5 h-3.5" /> {t('plans.unlimited')}</span>
    return v
  }

  function formatPrice(price) {
    if (!price) return t('plans.free')
    return Number(price).toLocaleString('vi-VN') + ' ₫'
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <LoadingSpinner size="lg" />
    </div>
  )

  if (error) return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <p className="text-red-600">{error}</p>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">{t('plans.title')}</h1>
        <p className="text-gray-500 max-w-xl mx-auto">{t('plans.subtitle')}</p>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {plans.map(plan => {
          const accent    = PLAN_ACCENT[plan.slug] ?? PLAN_ACCENT.basic
          const isCurrent = plan.slug === currentPlanSlug
          const isOwned   = isCurrent && role === 'creator'
          const desc      = planDescription(plan)
          const name      = planName(plan)

          return (
            <div
              key={plan.id}
              className={cn(
                'bg-white border-2 rounded-2xl p-6 flex flex-col relative transition-shadow',
                accent.border,
                plan.slug === 'pro' && 'shadow-lg shadow-purple-100',
              )}
            >
              {/* Popular badge */}
              {accent.badge && (
                <div className={cn('absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold', accent.badge)}>
                  {t('plans.popular')}
                </div>
              )}

              {/* Currently using badge */}
              {isOwned && (
                <div className="absolute top-4 right-4 bg-blue-600 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  {t('plans.currentBadge')}
                </div>
              )}

              {/* Plan name & price */}
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 mb-1">{name}</h2>
                {desc && (
                  <p className="text-sm text-gray-500 mb-2 leading-snug">{desc}</p>
                )}
                <p className="text-3xl font-extrabold text-blue-600">{formatPrice(plan.price)}</p>
                <p className="text-sm text-gray-400 mt-0.5">
                  {plan.duration_days ? t('plans.perDays', { days: plan.duration_days }) : t('plans.lifetime')}
                </p>
              </div>

              <hr className="border-gray-100 mb-4" />

              {/* Limits */}
              <ul className="space-y-2.5 mb-5 flex-1 text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  <span>{t('plans.maxTournaments', { n: plan.max_tournaments ?? '∞' })}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  <span>{t('plans.maxPlayers', { n: plan.max_players ?? '∞' })}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  <span>{t('plans.maxEvents', { n: plan.max_events ?? '∞' })}</span>
                </li>
                {featuresList.map(f => {
                  const hasIt = plan.features?.includes(f.key)
                  if (!hasIt && plan.slug === 'free') return null
                  return (
                    <li key={f.key} className={cn('flex items-center gap-2', !hasIt && 'opacity-40 line-through')}>
                      <Check className={cn('w-4 h-4 shrink-0', hasIt ? 'text-green-500' : 'text-gray-300')} />
                      <span>{f.label}</span>
                    </li>
                  )
                })}
              </ul>

              {/* CTA */}
              <button
                onClick={() => handleCTA(plan)}
                disabled={plan.slug === 'free' || isOwned || (role && role !== 'creator')}
                className={cn(
                  'w-full py-3 rounded-xl font-semibold text-sm transition-colors disabled:cursor-default',
                  isOwned
                    ? 'bg-blue-50 text-blue-600 cursor-default'
                    : plan.slug === 'free'
                    ? 'bg-gray-100 text-gray-400 cursor-default'
                    : !profile
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : role !== 'creator'
                    ? 'bg-gray-100 text-gray-400 cursor-default'
                    : accent.btn,
                )}
              >
                {isOwned
                  ? t('plans.btnCurrent')
                  : plan.slug === 'free'
                  ? t('plans.btnFree')
                  : !profile
                  ? t('plans.btnLogin')
                  : role !== 'creator'
                  ? t('plans.btnCreatorOnly')
                  : t('plans.btnBuy', { name })}
              </button>
            </div>
          )
        })}
      </div>

      {/* Add-on banner */}
      {(role === 'creator' || role === 'admin') && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between mb-6">
          <div>
            <p className="font-medium text-gray-900 text-sm">{t('plans.addonTitle')}</p>
            <p className="text-sm text-gray-500">{t('plans.addonSubtitle')}</p>
          </div>
          <Link
            to="/addon-shop"
            className="shrink-0 ml-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {t('plans.addonBtn')}
          </Link>
        </div>
      )}

      {/* Footer note */}
      <p className="text-center text-xs text-gray-400">{t('plans.footer')}</p>

      {/* CTA for unauthenticated */}
      {!profile && (
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 mb-3">{t('plans.noAccountPrompt')}</p>
          <a
            href="/register"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Zap className="w-4 h-4" />
            {t('plans.signupBtn')}
          </a>
        </div>
      )}
    </div>
  )
}
