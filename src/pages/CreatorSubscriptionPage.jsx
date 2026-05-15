import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Trophy, Clock, CheckCircle, XCircle, AlertCircle, ArrowLeft, Zap, Bell, AlertTriangle, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { cn } from '@/lib/utils/cn'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useFeatureRegistry } from '@/lib/hooks/useFeatureRegistry'
import { useFeatures } from '@/lib/hooks/useFeatures'

function daysLeft(expiresAt) {
  return Math.ceil((new Date(expiresAt) - Date.now()) / 86_400_000)
}

function formatPrice(price) {
  if (!price) return 'Miễn phí'
  return Number(price).toLocaleString('vi-VN') + ' đ'
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function limitLabel(v) {
  return v == null ? 'Không giới hạn' : v
}

function StatusBadge({ status }) {
  const map = {
    waiting:   { label: 'Chờ duyệt',     cls: 'bg-yellow-100 text-yellow-700' },
    confirmed: { label: 'Đã xác nhận',   cls: 'bg-green-100 text-green-700' },
    rejected:  { label: 'Từ chối',        cls: 'bg-red-100 text-red-700' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold', cls)}>{label}</span>
}

function UsageBar({ label, used, max }) {
  if (max == null) {
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">{used} / Không giới hạn</span>
      </div>
    )
  }
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">{used} / {max}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-400' : 'bg-blue-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function CreatorSubscriptionPage() {
  const { profile, role } = useAuth()
  const navigate = useNavigate()
  const { getAllFeatures } = useFeatureRegistry()
  const { features: activeFeatureKeys } = useFeatures()

  const [planData, setPlanData]     = useState(null)
  const [orders, setOrders]         = useState([])
  const [activeSub, setActiveSub]   = useState(null)
  const [activeAddons, setActiveAddons] = useState([])
  const [notifData, setNotifData]   = useState({ unread_count: 0, notifications: [] })
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  useEffect(() => {
    if (!profile) return
    if (role !== 'creator' && role !== 'admin') { navigate('/'); return }
    load()
  }, [profile?.id, role])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [planRes, ordersRes, subRes, addonsRes, notifRes] = await Promise.all([
        supabase.rpc('get_creator_plan', { p_creator_id: profile.id }),
        supabase
          .from('payment_orders')
          .select(`
            id, amount, status, transfer_content, proof_url, proof_note,
            confirmed_at, rejected_reason, created_at,
            subscription:subscriptions!subscription_id(
              id, plan_id,
              plan:subscription_plans!plan_id(name)
            ),
            addon:subscription_addons!addon_id(addon_type, quantity)
          `)
          .eq('creator_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('subscriptions')
          .select('id, status, starts_at, expires_at, plan:subscription_plans!plan_id(name, slug, max_tournaments, max_players, max_events)')
          .eq('creator_id', profile.id)
          .eq('status', 'active')
          .maybeSingle(),
        supabase
          .from('subscription_addons')
          .select('id, addon_type, quantity, status, created_at')
          .eq('creator_id', profile.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
        supabase.rpc('get_my_notifications', { p_user_id: profile.id }),
      ])
      setPlanData(planRes.data)
      setOrders(ordersRes.data ?? [])
      setActiveSub(subRes.data)
      setActiveAddons(addonsRes.data ?? [])
      const nd = notifRes.data ?? { unread_count: 0, notifications: [] }
      setNotifData(nd)
      // Mark all as read — user is actively viewing their subscription page
      if (nd.unread_count > 0) {
        supabase.rpc('mark_notifications_read', { p_user_id: profile.id, p_notif_ids: null })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32"><LoadingSpinner size="lg" /></div>
  )

  if (error) return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
      <p className="text-red-600">{error}</p>
    </div>
  )

  const plan = activeSub?.plan ?? planData?.plan ?? null
  const planName = plan?.name ?? 'Miễn phí'
  const planSlug = plan?.slug ?? 'free'
  const expiresAt = activeSub?.expires_at ?? null
  const dl = expiresAt ? daysLeft(expiresAt) : null

  const waitingOrders = orders.filter(o => o.status === 'waiting')

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Trang chủ
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Gói dịch vụ của tôi</h1>

      {/* Waiting order banner — per-order detail */}
      {waitingOrders.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-5 space-y-2">
          {waitingOrders.map(o => {
            const planName = o.subscription?.plan?.name ?? (o.addon ? 'Add-on' : '?')
            const hasProof = !!(o.proof_url || o.proof_note)
            return (
              <div key={o.id} className="flex items-start justify-between gap-3 text-sm text-yellow-800">
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5 text-yellow-500" />
                  <div>
                    <span className="font-semibold">
                      {o.addon ? 'Đang chờ duyệt Add-on' : `Đang chờ nâng cấp lên ${planName}`}
                    </span>
                    {!hasProof && (
                      <p className="text-xs text-orange-600 mt-0.5">
                        ⚠ Bạn chưa upload bằng chứng thanh toán.
                      </p>
                    )}
                    {hasProof && (
                      <p className="text-xs text-yellow-600 mt-0.5">
                        Đã upload bằng chứng — đang chờ admin xác nhận.
                      </p>
                    )}
                  </div>
                </div>
                {!hasProof && (
                  <Link
                    to={`/checkout/${o.subscription?.plan_id ?? ''}?orderId=${o.id}&resumeOrder=1`}
                    className="shrink-0 text-xs px-3 py-1.5 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors"
                  >
                    Upload bằng chứng
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Current plan card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Gói hiện tại</p>
            <h2 className="text-2xl font-bold text-gray-900">{planName}</h2>
          </div>
          <div className="flex flex-col items-end gap-2">
            {planSlug === 'free' ? (
              <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-3 py-1 rounded-full">Miễn phí</span>
            ) : dl != null && dl <= 7 ? (
              <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-3 py-1 rounded-full">Còn {dl} ngày</span>
            ) : dl != null ? (
              <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">Còn {dl} ngày</span>
            ) : null}
            {expiresAt && (
              <p className="text-xs text-gray-400">Hết hạn: {formatDate(expiresAt)}</p>
            )}
          </div>
        </div>

        {/* Usage */}
        {planData && (
          <div className="space-y-3 mb-5 pt-4 border-t border-gray-100">
            <UsageBar
              label="Giải đấu active"
              used={planData.active_tournament_count ?? 0}
              max={plan?.max_tournaments ?? null}
            />
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">VĐV tối đa / giải</span>
              <span className="font-medium text-gray-900">
                {plan?.max_players ?? <span className="text-gray-400">Không giới hạn</span>}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Nội dung tối đa / giải</span>
              <span className="font-medium text-gray-900">
                {plan?.max_events ?? <span className="text-gray-400">Không giới hạn</span>}
              </span>
            </div>
          </div>
        )}

        {/* Feature list */}
        {getAllFeatures().length > 0 && (
          <div className="space-y-1.5 mb-5 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">Tính năng gói</p>
            {getAllFeatures().map(f => {
              const active = activeFeatureKeys.includes(f.key)
              return (
                <div key={f.key} className="flex items-center gap-2">
                  {active
                    ? <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    : <Lock className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                  }
                  <span className={cn('text-xs', active ? 'text-gray-700' : 'text-gray-400')}>
                    {f.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-gray-100">
          {planSlug !== 'free' && (
            <Link
              to="/plans"
              className="flex-1 text-center py-2.5 rounded-xl border border-blue-200 text-blue-600 text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              Gia hạn gói
            </Link>
          )}
          <Link
            to="/plans"
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <Zap className="w-4 h-4" />
            {planSlug === 'free' ? 'Nâng cấp gói' : 'Đổi gói'}
          </Link>
        </div>
      </div>

      {/* Add-on section */}
      {activeAddons.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Add-on đang active</h3>
            <button
              onClick={() => navigate('/addon-shop')}
              className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Mua thêm slot →
            </button>
          </div>
          {(() => {
            const totalSlots = activeAddons
              .filter(a => a.addon_type === 'tournament_slot')
              .reduce((sum, a) => sum + a.quantity, 0)
            return totalSlots > 0 ? (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                <Trophy className="w-5 h-5 text-blue-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">+{totalSlots} Slot giải đấu thêm</p>
                  <p className="text-xs text-gray-500">Cộng vào quota của gói hiện tại</p>
                </div>
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Đang active</span>
              </div>
            ) : null
          })()}
        </div>
      ) : (
        <div className="text-center mb-4">
          <Link to="/addon-shop" className="text-sm text-blue-600 hover:underline">Mua add-on lẻ</Link>
        </div>
      )}

      {/* Order history */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Lịch sử đơn hàng</h3>
        </div>

        {orders.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">
            Chưa có đơn hàng nào.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {orders.map(order => (
              <div key={order.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {order.subscription?.plan?.name
                        ? order.subscription.plan.name
                        : order.addon
                        ? `Add-on: +${order.addon.quantity} slot giải đấu`
                        : '—'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.created_at)}</p>
                    <p className="text-xs font-mono text-gray-400 mt-0.5">#{order.id.slice(0, 8).toUpperCase()}</p>
                    {order.status === 'rejected' && order.rejected_reason && (
                      <p className="text-xs text-red-500 mt-1">Lý do: {order.rejected_reason}</p>
                    )}
                    {order.status === 'waiting' && (
                      <p className="text-xs text-gray-400 mt-1 font-mono">
                        Nội dung CK: <span className="text-gray-600">{order.transfer_content}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <StatusBadge status={order.status} />
                    <p className="text-sm font-semibold text-gray-900">{formatPrice(order.amount)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notifications section */}
      {notifData.notifications.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold text-gray-900 mb-3">Thông báo gần đây</h3>
          <div className="space-y-2">
            {notifData.notifications.slice(0, 5).map(notif => (
              <div key={notif.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                  notif.type === 'sub_expired' ? 'bg-red-100' :
                  notif.type === 'quota_warning' ? 'bg-orange-100' :
                  notif.type.startsWith('sub_expiring') ? 'bg-yellow-100' : 'bg-gray-100',
                )}>
                  {notif.type === 'sub_expired'
                    ? <AlertCircle className="w-4 h-4 text-red-600" />
                    : notif.type === 'quota_warning'
                    ? <AlertTriangle className="w-4 h-4 text-orange-600" />
                    : notif.type.startsWith('sub_expiring')
                    ? <Clock className="w-4 h-4 text-yellow-600" />
                    : <Bell className="w-4 h-4 text-gray-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{notif.body}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(notif.created_at).toLocaleString('vi-VN')}
                  </p>
                </div>
                {!notif.is_read && (
                  <span className="shrink-0 inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-600">Mới</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
