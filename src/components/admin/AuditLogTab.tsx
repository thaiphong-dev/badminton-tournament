import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils/cn'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import TablePagination from '@/components/ui/TablePagination'

const AUDIT_PAGE_SIZE = 50

const ACTION_LABELS = {
  payment_confirmed:      'Duyệt thanh toán',
  payment_rejected:       'Từ chối thanh toán',
  subscription_granted:   'Tặng gói',
  subscription_cancelled: 'Hủy gói',
  auto_expired:           'Hết hạn tự động',
  plan_upserted:          'Cập nhật gói',
  bank_info_updated:      'Cập nhật bank info',
  addon_pricing_updated:  'Cập nhật giá add-on',
  user_deactivated:       'Vô hiệu hóa user',
  user_activated:         'Kích hoạt user',
  order_created:          'Tạo đơn hàng',
  addon_order_created:    'Tạo đơn add-on',
  addon_confirmed:        'Duyệt add-on',
  addon_rejected:         'Từ chối add-on',
}

const ACTION_BADGE = {
  payment_confirmed:      'bg-green-100 text-green-700',
  payment_rejected:       'bg-red-100 text-red-700',
  subscription_granted:   'bg-purple-100 text-purple-700',
  subscription_cancelled: 'bg-red-100 text-red-700',
  auto_expired:           'bg-gray-100 text-gray-500',
  plan_upserted:          'bg-blue-100 text-blue-700',
  bank_info_updated:      'bg-blue-100 text-blue-700',
  addon_pricing_updated:  'bg-blue-100 text-blue-700',
  user_deactivated:       'bg-red-100 text-red-700',
  user_activated:         'bg-green-100 text-green-700',
  order_created:          'bg-yellow-100 text-yellow-700',
  addon_order_created:    'bg-orange-100 text-orange-700',
  addon_confirmed:        'bg-green-100 text-green-700',
  addon_rejected:         'bg-red-100 text-red-700',
}

const ALL_ACTIONS = Object.keys(ACTION_LABELS)

export default function AuditLogTab({ adminId }) {
  const [logs, setLogs]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [filterAction, setFilterAction] = useState('all')
  const [expandedId, setExpandedId]   = useState(null)
  const [page, setPage]               = useState(1)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('subscription_audit_log')
      .select('id, action, details, created_at, actor_id')
      .order('created_at', { ascending: false })
      .limit(200)

    if (err) { setError(err.message); setLoading(false); return }

    const rows = data ?? []

    // Fetch actor profile names in one batch query
    const actorIds = [...new Set(rows.map(l => l.actor_id).filter(Boolean))]
    let actorMap = {}
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, phone')
        .in('id', actorIds)
      actorMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
    }

    setLogs(rows.map(l => ({ ...l, actor: actorMap[l.actor_id] ?? null })))
    setLoading(false)
  }

  const filtered = filterAction === 'all'
    ? logs
    : logs.filter(l => l.action === filterAction)

  const paginated = filtered.slice((page - 1) * AUDIT_PAGE_SIZE, page * AUDIT_PAGE_SIZE)

  if (loading) return (
    <div className="flex justify-center py-16"><LoadingSpinner /></div>
  )

  if (error) return (
    <div className="py-8 text-center text-red-600 text-sm">{error}</div>
  )

  return (
    <div>
      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setFilterAction('all')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            filterAction === 'all' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
          )}
        >
          Tất cả ({logs.length})
        </button>
        {ALL_ACTIONS.filter(a => logs.some(l => l.action === a)).map(a => (
          <button
            key={a}
            onClick={() => setFilterAction(a)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              filterAction === a ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
            )}
          >
            {ACTION_LABELS[a] ?? a}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">Không có log nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Thời gian', 'Hành động', 'Thực hiện bởi', 'Đối tượng', 'Chi tiết'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map(log => {
                  const detailStr = log.details ? JSON.stringify(log.details) : '{}'
                  const isExpanded = expandedId === log.id
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap',
                          ACTION_BADGE[log.action] ?? 'bg-gray-100 text-gray-500',
                        )}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-xs">
                        {log.actor?.name ?? <span className="text-gray-400 italic">System</span>}
                        {log.actor?.phone && <p className="text-gray-400 font-mono">{log.actor.phone}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-xs">
                        {log.target?.name
                          ?? (log.details?.creator_id ? log.details.creator_id.toString().slice(0, 8) + '...' : '—')}
                        {log.target?.phone && <p className="text-gray-400 font-mono">{log.target.phone}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px]">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          className="text-left hover:text-gray-700 transition-colors"
                        >
                          {isExpanded
                            ? detailStr
                            : detailStr.length > 80 ? detailStr.slice(0, 80) + '…' : detailStr}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <TablePagination
          page={page}
          totalPages={Math.ceil(filtered.length / AUDIT_PAGE_SIZE)}
          onPageChange={setPage}
          pageSize={AUDIT_PAGE_SIZE}
          total={filtered.length}
        />
      </div>
    </div>
  )
}
