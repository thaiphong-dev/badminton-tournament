import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils/cn'
import { Check, X, ExternalLink, Copy, Download, AlertCircle } from 'lucide-react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import TablePagination from '@/components/ui/TablePagination'

const PAGE_SIZE = 50

const STATUS_FILTERS = [
  { id: 'waiting',   label: 'Chờ duyệt' },
  { id: 'confirmed', label: 'Đã duyệt'  },
  { id: 'rejected',  label: 'Từ chối'   },
  { id: 'all',       label: 'Tất cả'    },
]

const TYPE_FILTERS = [
  { id: 'all',          label: 'Tất cả'      },
  { id: 'subscription', label: 'Gói dịch vụ' },
  { id: 'addon',        label: 'Add-on'       },
]

const STATUS_BADGE = {
  waiting:   'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
}

const STATUS_LABEL = {
  waiting:   'Chờ duyệt',
  confirmed: 'Đã duyệt',
  rejected:  'Từ chối',
}

function formatVND(n) {
  if (!n) return '0 đ'
  return Number(n).toLocaleString('vi-VN') + ' đ'
}

function exportCSV(orders) {
  const BOM = '﻿'
  const headers = ['Creator', 'SĐT', 'Gói', 'Số tiền', 'Nội dung CK', 'Mã GD', 'Trạng thái', 'Ngày xác nhận']
  const rows = orders.map(o => [
    o.creator?.name ?? '',
    o.creator?.phone ?? '',
    o.subscription?.plan?.name ?? '',
    o.amount ?? 0,
    o.transfer_content ?? '',
    o.proof_note ?? '',
    STATUS_LABEL[o.status] ?? o.status,
    o.confirmed_at ? new Date(o.confirmed_at).toLocaleDateString('vi-VN') : '',
  ])
  const csv = BOM + [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `orders_${new Date().toISOString().slice(0, 7)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function OrdersTab({ adminId }) {
  const [orders, setOrders]       = useState([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [selected, setSelected]   = useState(null)
  const [newOrderAlert, setNewOrderAlert] = useState(false)

  const fetchOrders = useCallback(async (p = 1) => {
    setLoading(true)
    const from = (p - 1) * PAGE_SIZE
    let query = supabase
      .from('payment_orders')
      .select(`
        id, amount, transfer_content, proof_url, proof_note,
        status, confirmed_at, rejected_reason, created_at, creator_id,
        creator:profiles!creator_id(id, name, phone),
        subscription:subscriptions!subscription_id(
          plan:subscription_plans!plan_id(name, slug)
        ),
        addon:subscription_addons!addon_id(addon_type, quantity)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (filter !== 'all') query = query.eq('status', filter)

    const { data, count } = await query
    setOrders(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [filter])

  useEffect(() => {
    setPage(1)
  }, [filter, filterType])

  useEffect(() => {
    fetchOrders(page)
  }, [page, filter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const channel = supabase.channel('admin-payment-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payment_orders' },
        (payload) => {
          if (payload.new?.status === 'waiting') setNewOrderAlert(true)
          fetchOrders(1)
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payment_orders' },
        () => fetchOrders(page))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = filterType === 'all'
    ? orders
    : filterType === 'addon'
      ? orders.filter(o => o.addon !== null)
      : orders.filter(o => o.addon === null)
  const waitingCount = orders.filter(o => o.status === 'waiting').length
  const staleOrders  = orders.filter(o =>
    o.status === 'waiting' &&
    Date.now() - new Date(o.created_at).getTime() > 2 * 60 * 60 * 1000
  )

  if (loading) return <div className="py-16 flex justify-center"><LoadingSpinner /></div>

  return (
    <div>
      {staleOrders.length > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            <strong>{staleOrders.length}</strong> đơn chờ xác nhận quá 2 giờ.{' '}
            <button
              onClick={() => { setFilter('waiting'); setPage(1) }}
              className="underline font-medium hover:text-amber-900"
            >
              Xem ngay
            </button>
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-4">
          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Trạng thái:</span>
            <div className="flex flex-wrap gap-1">
              {STATUS_FILTERS.map(f => (
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
                  {f.id === 'waiting' && waitingCount > 0 && (
                    <span className="bg-red-500 text-white rounded-full px-1.5 py-0.5 text-xs leading-none">
                      {waitingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Loại đơn:</span>
            <div className="flex flex-wrap gap-1">
              {TYPE_FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    filterType === f.id
                      ? 'bg-gray-700 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={() => exportCSV(filtered)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {newOrderAlert && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 mb-3 text-sm text-blue-700">
          <span>Có đơn hàng mới.</span>
          <button
            onClick={() => { setNewOrderAlert(false); fetchOrders() }}
            className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Tải lại
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Creator', 'Loại / Gói', 'Số tiền', 'Nội dung CK', 'Ngày tạo', 'Trạng thái', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                    Không có đơn hàng nào.
                  </td>
                </tr>
              ) : filtered.map(o => (
                <tr
                  key={o.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelected(o)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{o.creator?.name ?? '–'}</p>
                    <p className="text-xs text-gray-400 font-mono">{o.creator?.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    {o.addon !== null ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Add-on</span>
                        <span className="text-xs text-gray-600">+{o.addon.quantity} slot giải đấu</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Gói</span>
                        <span className="text-xs text-gray-600">{o.subscription?.plan?.name ?? '–'}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                    {formatVND(o.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                      {o.transfer_content}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(o.created_at).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                      STATUS_BADGE[o.status] ?? 'bg-gray-100 text-gray-600')}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-blue-600">Chi tiết →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          totalPages={Math.ceil(total / PAGE_SIZE)}
          onPageChange={setPage}
          pageSize={PAGE_SIZE}
          total={total}
        />
      </div>

      {selected && (
        <OrderDetailModal
          order={selected}
          adminId={adminId}
          onClose={() => setSelected(null)}
          onActionDone={() => { setSelected(null); fetchOrders() }}
        />
      )}
    </div>
  )
}

// ── Order Detail Modal ────────────────────────────────────────────────────────

function OrderDetailModal({ order, adminId, onClose, onActionDone }) {
  const [confirming, setConfirming] = useState(false)
  const [rejecting, setRejecting]   = useState(false)
  const [reason, setReason]         = useState('')
  const [showReject, setShowReject] = useState(false)
  const [proofLoading, setProofLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState(null)

  async function handleConfirm() {
    setConfirming(true)
    setErr(null)
    const isAddon = order.addon !== null
    const { error } = isAddon
      ? await supabase.rpc('admin_confirm_addon_order', {
          p_admin_id: adminId,
          p_order_id: order.id,
        })
      : await supabase.rpc('admin_confirm_payment', {
          p_admin_id: adminId,
          p_order_id: order.id,
        })
    setConfirming(false)
    if (error) { setErr(error.message); return }
    onActionDone()
  }

  async function handleReject() {
    if (!reason.trim()) return
    setRejecting(true)
    setErr(null)
    const isAddon = order.addon !== null
    const { error } = isAddon
      ? await supabase.rpc('admin_reject_addon_order', {
          p_admin_id: adminId,
          p_order_id: order.id,
          p_reason:   reason.trim(),
        })
      : await supabase.rpc('admin_reject_payment', {
          p_admin_id: adminId,
          p_order_id: order.id,
          p_reason:   reason.trim(),
        })
    setRejecting(false)
    if (error) { setErr(error.message); return }
    onActionDone()
  }

  async function viewProof() {
    if (!order.proof_url) return
    setProofLoading(true)
    const { data } = await supabase.storage
      .from('payment-proofs')
      .createSignedUrl(order.proof_url, 3600)
    setProofLoading(false)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function copyCode() {
    await navigator.clipboard.writeText(order.transfer_content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Chi tiết đơn hàng</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <Row label="Creator">
            <span className="font-medium">{order.creator?.name ?? '–'}</span>
            <span className="text-gray-400 ml-2 font-mono text-xs">{order.creator?.phone}</span>
          </Row>
          <Row label="Loại">
            {order.addon !== null ? (
              <>
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Add-on</span>
                <span className="ml-2 text-sm">+{order.addon.quantity} slot giải đấu</span>
              </>
            ) : (
              <>
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Gói</span>
                <span className="ml-2">{order.subscription?.plan?.name ?? '–'}</span>
              </>
            )}
            <span className="ml-2 font-bold text-gray-900">{formatVND(order.amount)}</span>
          </Row>
          <Row label="Nội dung CK">
            <span className="font-mono text-sm bg-gray-100 px-2 py-0.5 rounded mr-2">
              {order.transfer_content}
            </span>
            <button
              onClick={copyCode}
              title="Copy"
              className="text-blue-600 hover:text-blue-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </Row>
          <Row label="Ngày tạo">
            {new Date(order.created_at).toLocaleString('vi-VN')}
          </Row>
          <Row label="Trạng thái">
            <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
              STATUS_BADGE[order.status] ?? 'bg-gray-100 text-gray-600')}>
              {STATUS_LABEL[order.status] ?? order.status}
            </span>
          </Row>
          <Row label="Bằng chứng">
            {order.proof_url ? (
              <button
                onClick={viewProof}
                disabled={proofLoading}
                className="flex items-center gap-1 text-blue-600 hover:underline text-sm disabled:opacity-50"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {proofLoading ? 'Đang tải...' : 'Xem ảnh'}
              </button>
            ) : (
              <span className={cn(
                'text-sm italic',
                order.status === 'waiting' ? 'text-orange-500 font-medium' : 'text-gray-400'
              )}>
                Chưa upload
              </span>
            )}
          </Row>
          {order.proof_note && (
            <Row label="Mã GD">
              <span className="font-mono text-sm">{order.proof_note}</span>
            </Row>
          )}
          {order.rejected_reason && (
            <Row label="Lý do từ chối">
              <span className="text-red-600 text-sm">{order.rejected_reason}</span>
            </Row>
          )}

          {err && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{err}</p>}

          {showReject && (
            <input
              autoFocus
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Lý do từ chối (bắt buộc)"
              className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          )}
        </div>

        {order.status === 'waiting' && (
          <div className="px-5 py-4 border-t border-gray-100 space-y-3">
            {!order.proof_url && !order.proof_note && (
              <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700">
                <span className="mt-0.5">⚠</span>
                <span>Khách hàng chưa upload bằng chứng thanh toán. Chờ khách upload trước khi xác nhận.</span>
              </div>
            )}
            <div className="flex gap-2">
            {!showReject ? (
              <>
                <button
                  onClick={handleConfirm}
                  disabled={confirming || (!order.proof_url && !order.proof_note)}
                  title={!order.proof_url && !order.proof_note ? 'Chờ khách hàng upload bằng chứng' : ''}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  {confirming ? 'Đang xử lý...' : 'Xác nhận'}
                </button>
                <button
                  onClick={() => setShowReject(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
                >
                  <X className="w-4 h-4" />
                  Từ chối
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleReject}
                  disabled={rejecting || !reason.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {rejecting ? 'Đang từ chối...' : 'Xác nhận từ chối'}
                </button>
                <button
                  onClick={() => { setShowReject(false); setReason('') }}
                  className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Huỷ
                </button>
              </>
            )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-gray-400 w-28 shrink-0 mt-0.5">{label}</span>
      <div className="flex items-center flex-wrap gap-1 text-sm text-gray-700">{children}</div>
    </div>
  )
}
