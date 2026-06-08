import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, Trophy, Users, CheckCircle2, BarChart2, Loader2, AlertCircle, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { cn } from '@/lib/utils/cn'

function exportAnalyticsCSV(data) {
  const BOM = '﻿'
  const headers = ['Tháng', 'Số giải']
  const rows = (data.monthly_tournaments ?? []).map(d => [d.month, d.count])
  const summaryRows = [
    [],
    ['Tổng giải', data.total_tournaments],
    ['Giải hoàn thành', data.completed_tournaments],
    ['VĐV quản lý', data.total_players],
    ['Tỉ lệ trận hoàn thành (%)', data.match_completion_rate],
  ]
  const csv = BOM + [[headers, ...rows, ...summaryRows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')]
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `analytics_${new Date().toISOString().slice(0, 7)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const STATUS_BADGE = {
  setup:       { label: 'Thiết lập',    cls: 'bg-yellow-100 text-yellow-700' },
  group_stage: { label: 'Vòng bảng',    cls: 'bg-blue-100 text-blue-700' },
  knockout:    { label: 'Knock-out',    cls: 'bg-purple-100 text-purple-700' },
  completed:   { label: 'Hoàn thành',   cls: 'bg-green-100 text-green-700' },
}

function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   val: 'text-blue-700' },
    green:  { bg: 'bg-green-50',  icon: 'text-green-600',  val: 'text-green-700' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', val: 'text-purple-700' },
    amber:  { bg: 'bg-amber-50',  icon: 'text-amber-600',  val: 'text-amber-700' },
  }[color]
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-start gap-4">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', colors.bg)}>
          <Icon className={cn('w-5 h-5', colors.icon)} />
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">{label}</p>
          <p className={cn('text-2xl font-bold', colors.val)}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

function MiniBarChart({ data }) {
  if (!data?.length) return null
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <span className="text-[10px] text-gray-400 font-medium">{d.count || ''}</span>
          <div
            className="w-full bg-blue-500 rounded-t-md transition-all"
            style={{ height: `${Math.max(4, (d.count / max) * 96)}px` }}
          />
          <span className="text-[10px] text-gray-400 truncate w-full text-center">{d.month}</span>
        </div>
      ))}
    </div>
  )
}

export default function CreatorAnalyticsPage() {
  const { profile, role } = useAuth()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    if (!profile?.id) return
    const targetId = role === 'admin'
      ? (new URLSearchParams(window.location.search).get('creator_id') || profile.id)
      : profile.id
    supabase.rpc('get_creator_analytics', { p_creator_id: targetId })
      .then(({ data: res, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return }
        setData(res)
        setLoading(false)
      })
  }, [profile?.id, role])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-600">{error || 'Không tải được dữ liệu.'}</p>
      </div>
    )
  }

  const completionPct = data.total_tournaments > 0
    ? Math.round((data.completed_tournaments / data.total_tournaments) * 100)
    : 0

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Thống kê hoạt động</h1>
          <p className="text-sm text-gray-500">Tổng quan hiệu suất tổ chức giải đấu</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Trophy}
          label="Tổng giải tổ chức"
          value={data.total_tournaments}
          color="blue"
        />
        <StatCard
          icon={CheckCircle2}
          label="Giải hoàn thành"
          value={data.completed_tournaments}
          sub={`${completionPct}% tỉ lệ hoàn thành`}
          color="green"
        />
        <StatCard
          icon={Users}
          label="VĐV quản lý"
          value={data.total_players}
          sub="lượt đăng ký duyệt"
          color="purple"
        />
        <StatCard
          icon={BarChart2}
          label="Tỉ lệ trận hoàn thành"
          value={`${data.match_completion_rate}%`}
          color="amber"
        />
      </div>

      {/* Monthly bar chart */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Giải đấu theo tháng (6 tháng gần nhất)</h2>
          <button
            onClick={() => exportAnalyticsCSV(data)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Xuất CSV
          </button>
        </div>
        {data.monthly_tournaments?.length > 0 ? (
          <MiniBarChart data={data.monthly_tournaments} />
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">Chưa có dữ liệu.</p>
        )}
      </div>

      {/* Recent tournaments */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">5 giải gần nhất</h2>
        </div>
        {data.recent_tournaments?.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Chưa có giải đấu nào.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.recent_tournaments?.map(t => {
              const badge = STATUS_BADGE[t.status] ?? { label: t.status, cls: 'bg-gray-100 text-gray-600' }
              return (
                <div key={t.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/tournament/${t.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors truncate block"
                    >
                      {t.name}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(t.created_at).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  <span className={cn('ml-3 shrink-0 inline-flex px-2.5 py-1 rounded-full text-xs font-medium', badge.cls)}>
                    {badge.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
