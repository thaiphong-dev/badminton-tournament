import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils/cn'
import { Gift, X } from 'lucide-react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import TablePagination from '@/components/ui/TablePagination'
import { useAuth } from '@/lib/hooks/useAuth'

const SUB_PAGE_SIZE = 50

const FILTERS = [
  { id: 'all',      label: 'Tất cả' },
  { id: 'active',   label: 'Active' },
  { id: 'expiring', label: 'Sắp hết hạn' },
  { id: 'free',     label: 'Free' },
  { id: 'expired',  label: 'Hết hạn' },
]

function daysLeft(expiresAt) {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt) - Date.now()) / 86_400_000)
}

function getSubStatus(activeSub) {
  if (!activeSub) return 'free'
  const d = daysLeft(activeSub.expires_at)
  if (d === null) return 'active'      // vĩnh viễn
  if (d < 0)      return 'expired'
  if (d <= 7)     return 'expiring'
  return 'active'
}

const STATUS_CONFIG = {
  active:   { cls: 'bg-green-100 text-green-700',  label: 'Active'       },
  expiring: { cls: 'bg-yellow-100 text-yellow-700', label: 'Sắp hết hạn' },
  expired:  { cls: 'bg-red-100 text-red-700',       label: 'Hết hạn'     },
  free:     { cls: 'bg-gray-100 text-gray-500',     label: 'Free'        },
}

export default function SubscriptionsTab({ adminId }) {
  const { profile } = useAuth()
  const [creators, setCreators] = useState([])
  const [plans, setPlans]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [page, setPage]         = useState(1)
  const [grantTarget, setGrantTarget]   = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelling, setCancelling]     = useState(false)

  const fetchAll = useCallback(async () => {
    const [cRes, pRes] = await Promise.all([
      supabase.from('profiles')
        .select(`
          id, name, phone, created_at,
          subscriptions!creator_id(
            id, plan_id, status, starts_at, expires_at,
            plan:subscription_plans!plan_id(name, slug)
          )
        `)
        .eq('role', 'creator')
        .order('created_at', { ascending: false }),
      supabase.from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order'),
    ])

    const processed = (cRes.data ?? []).map(c => ({
      ...c,
      activeSub: c.subscriptions?.find(s => s.status === 'active') ?? null,
    }))
    setCreators(processed)
    setPlans(pRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => { setPage(1) }, [filter])

  const expiringSoonCount = creators.filter(c => getSubStatus(c.activeSub) === 'expiring').length

  const filtered = creators.filter(c => {
    if (filter === 'all') return true
    return getSubStatus(c.activeSub) === filter
  })

  const paginatedFiltered = filtered.slice((page - 1) * SUB_PAGE_SIZE, page * SUB_PAGE_SIZE)

  async function handleCancelSub(reason) {
    if (!cancelTarget) return
    setCancelling(true)
    const { error } = await supabase.rpc('admin_cancel_subscription', {
      p_admin_id:        profile?.id ?? adminId,
      p_subscription_id: cancelTarget.subId,
      p_reason:          reason.trim() || null,
    })
    setCancelling(false)
    if (error) { alert('Lỗi: ' + error.message); return }
    setCancelTarget(null)
    fetchAll()
  }

  if (loading) return <div className="py-16 flex justify-center"><LoadingSpinner /></div>

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                filter === f.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              {f.label}
              {f.id === 'expiring' && expiringSoonCount > 0 && (
                <span className="bg-yellow-500 text-white rounded-full px-1.5 py-0.5 text-xs leading-none">
                  {expiringSoonCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setGrantTarget({ _isNew: true })}
          className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Gift className="w-4 h-4" />
          Tặng / Gia hạn gói
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Creator', 'Gói', 'Hết hạn', 'Trạng thái', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400 text-sm">
                    Không có creator nào.
                  </td>
                </tr>
              ) : paginatedFiltered.map(c => {
                const st  = getSubStatus(c.activeSub)
                const cfg = STATUS_CONFIG[st]
                const d   = c.activeSub ? daysLeft(c.activeSub.expires_at) : null
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{c.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">
                      {c.activeSub?.plan?.name ?? '–'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {c.activeSub?.expires_at
                        ? new Date(c.activeSub.expires_at).toLocaleDateString('vi-VN')
                        : c.activeSub
                          ? 'Vĩnh viễn'
                          : '–'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', cfg.cls)}>
                        {st === 'expiring' && d !== null ? `Còn ${d} ngày` : cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {c.activeSub && (
                          <button
                            onClick={() => setCancelTarget({ subId: c.activeSub.id, creatorName: c.name })}
                            className="text-xs text-red-500 hover:text-red-700 hover:underline"
                          >
                            Hủy gói
                          </button>
                        )}
                        <button
                          onClick={() => setGrantTarget(c)}
                          className="text-xs text-purple-600 hover:underline font-medium"
                        >
                          Quản lý
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          totalPages={Math.ceil(filtered.length / SUB_PAGE_SIZE)}
          onPageChange={setPage}
          pageSize={SUB_PAGE_SIZE}
          total={filtered.length}
        />
      </div>

      {grantTarget && (
        <GrantSubscriptionModal
          creator={grantTarget._isNew ? null : grantTarget}
          creators={creators}
          plans={plans}
          adminId={adminId}
          onClose={() => setGrantTarget(null)}
          onGranted={() => { setGrantTarget(null); fetchAll() }}
        />
      )}

      {cancelTarget && (
        <CancelSubModal
          target={cancelTarget}
          onConfirm={handleCancelSub}
          onClose={() => setCancelTarget(null)}
          loading={cancelling}
        />
      )}
    </div>
  )
}

// ── Cancel Subscription Modal ─────────────────────────────────────────────────

function CancelSubModal({ target, onConfirm, onClose, loading }) {
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Hủy gói của {target.creatorName}?</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-500">
            Gói sẽ chuyển sang trạng thái <span className="font-medium text-red-600">Đã hủy</span>.
            Hành động này không thể hoàn tác.
          </p>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Lý do hủy (không bắt buộc)"
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Huỷ
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Đang xử lý...' : 'Xác nhận hủy'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Grant Subscription Modal ──────────────────────────────────────────────────

function GrantSubscriptionModal({ creator, creators, plans, adminId, onClose, onGranted }) {
  const paidPlans = plans.filter(p => p.slug !== 'free')

  const [selectedCreatorId, setSelectedCreatorId] = useState(creator?.id ?? '')
  const [action, setAction]       = useState('grant') // 'renewal' | 'upgrade' | 'grant'
  const [selectedPlanId, setSelectedPlanId] = useState(paidPlans[0]?.id ?? '')
  const [note, setNote]           = useState('')
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState(null)

  // Resolve the selected creator object
  const resolved = creator ?? creators.find(c => c.id === selectedCreatorId)
  const activeSub = resolved?.activeSub ?? null
  const currentPlanId = activeSub?.plan_id ?? null

  // Sync action/plan when creator changes
  useEffect(() => {
    if (activeSub) {
      setAction('renewal')
      setSelectedPlanId(currentPlanId ?? paidPlans[0]?.id ?? '')
    } else {
      setAction('grant')
      setSelectedPlanId(paidPlans[0]?.id ?? '')
    }
  }, [selectedCreatorId]) // eslint-disable-line

  const isRenewal = action === 'renewal' && selectedPlanId === currentPlanId

  async function handleGrant() {
    const targetId = resolved?.id
    if (!targetId || !selectedPlanId) return
    setSaving(true)
    setErr(null)
    const { error } = await supabase.rpc('admin_grant_subscription', {
      p_admin_id:   adminId,
      p_creator_id: targetId,
      p_plan_id:    selectedPlanId,
      p_note:       note.trim() || null,
      p_is_renewal: isRenewal,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    onGranted()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Tặng / Gia hạn gói</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Creator selector (only when not pre-selected) */}
          {!creator && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Chọn creator *</label>
              <select
                value={selectedCreatorId}
                onChange={e => setSelectedCreatorId(e.target.value)}
                className={selectCls}
              >
                <option value="">-- Chọn creator --</option>
                {creators.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
              </select>
            </div>
          )}

          {/* Creator info card */}
          {resolved && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="font-medium text-gray-900">{resolved.name}</p>
              <p className="text-xs text-gray-400 font-mono">{resolved.phone}</p>
              {activeSub ? (
                <p className="text-xs text-gray-500 mt-1">
                  Đang dùng: <span className="font-medium">{activeSub.plan?.name}</span>
                  {activeSub.expires_at && (
                    <> — hết {new Date(activeSub.expires_at).toLocaleDateString('vi-VN')}</>
                  )}
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-1">Hiện đang dùng gói Free</p>
              )}
            </div>
          )}

          {/* Action radio */}
          {activeSub && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Hành động:</p>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio" name="action" value="renewal"
                    checked={action === 'renewal'}
                    onChange={() => { setAction('renewal'); setSelectedPlanId(currentPlanId ?? '') }}
                    className="accent-blue-600 mt-0.5"
                  />
                  <div>
                    <span className="text-sm text-gray-800">Gia hạn gói hiện tại</span>
                    <p className="text-xs text-gray-400">Cộng dồn thời gian — không mất ngày còn lại</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio" name="action" value="upgrade"
                    checked={action === 'upgrade'}
                    onChange={() => setAction('upgrade')}
                    className="accent-blue-600 mt-0.5"
                  />
                  <div>
                    <span className="text-sm text-gray-800">Nâng cấp / Đổi sang gói khác</span>
                    <p className="text-xs text-gray-400">Thời hạn tính từ hôm nay</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Plan selector */}
          {(!activeSub || action === 'upgrade') && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Chọn gói *</label>
              <select
                value={selectedPlanId}
                onChange={e => setSelectedPlanId(e.target.value)}
                className={selectCls}
              >
                <option value="">-- Chọn gói --</option>
                {paidPlans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.price ? Number(p.price).toLocaleString('vi-VN') + ' đ' : 'Miễn phí'}
                    {p.duration_days ? ` / ${p.duration_days} ngày` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ghi chú (tuỳ chọn)</label>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              className={selectCls}
              placeholder="VD: Tặng thưởng tháng 5"
            />
          </div>

          {isRenewal && (
            <div className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
              Gia hạn sẽ cộng thêm thời gian vào ngày hết hạn hiện tại — không mất ngày còn lại.
            </div>
          )}

          {err && (
            <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{err}</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Huỷ
          </button>
          <button
            onClick={handleGrant}
            disabled={saving || !resolved || !selectedPlanId}
            className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? 'Đang áp dụng...' : 'Áp dụng'}
          </button>
        </div>
      </div>
    </div>
  )
}

const selectCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
