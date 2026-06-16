import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Search, Loader2, Medal, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils/cn'

const GENDER_FILTERS = [
  { value: null,     label: 'Tất cả' },
  { value: 'male',   label: 'Nam' },
  { value: 'female', label: 'Nữ' },
]

function RankBadge({ rank }) {
  if (rank === 1) return <span className="text-yellow-500 font-bold text-base">🥇</span>
  if (rank === 2) return <span className="text-gray-400 font-bold text-base">🥈</span>
  if (rank === 3) return <span className="text-amber-600 font-bold text-base">🥉</span>
  return <span className="text-gray-400 text-sm font-medium tabular-nums">{rank}</span>
}

export default function LeaderboardPage() {
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [gender, setGender]     = useState(null)
  const [search, setSearch]     = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_leaderboard', {
      p_gender: gender,
      p_search: debouncedSearch || null,
      p_limit:  100,
      p_offset: 0,
    })
    if (!error) setRows(data ?? [])
    setLoading(false)
  }, [gender, debouncedSearch])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center">
          <Trophy className="w-5 h-5 text-yellow-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Bảng xếp hạng VĐV</h1>
          <p className="text-sm text-gray-500">Xếp hạng tổng hợp xuyên giải · cập nhật hàng đêm</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên VĐV..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1">
          {GENDER_FILTERS.map(f => (
            <button
              key={String(f.value)}
              onClick={() => setGender(f.value)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                gender === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16">
            <Medal className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Chưa có dữ liệu xếp hạng.</p>
            <p className="text-gray-300 text-xs mt-1">Dữ liệu cập nhật sau khi có trận đấu hoàn thành.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-12">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vận động viên</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Giới tính</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Giải</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Trận</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Thắng</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <span className="flex items-center justify-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Tỉ lệ
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row, idx) => (
                  <tr key={row.player_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3 text-center">
                      <RankBadge rank={idx + 1} />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/player/${row.player_id}`}
                        className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {row.name}
                      </Link>
                      {row.club && (
                        <p className="text-xs text-gray-400 mt-0.5">{row.club}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className={cn(
                        'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                        row.gender === 'male'   ? 'bg-blue-100 text-blue-700' :
                        row.gender === 'female' ? 'bg-pink-100 text-pink-700' :
                        'bg-gray-100 text-gray-500',
                      )}>
                        {row.gender === 'male' ? 'Nam' : row.gender === 'female' ? 'Nữ' : '–'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 tabular-nums">{row.tournaments_played}</td>
                    <td className="px-4 py-3 text-center text-gray-600 tabular-nums">{row.total_matches}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-900 tabular-nums">{row.total_wins}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        'font-semibold tabular-nums',
                        row.win_rate >= 70 ? 'text-green-600' :
                        row.win_rate >= 50 ? 'text-blue-600' :
                        'text-gray-500',
                      )}>
                        {row.win_rate ?? 0}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <p className="text-xs text-gray-400 text-center mt-3">
          Hiển thị top {rows.length} VĐV · dữ liệu cập nhật hàng đêm lúc 03:00
        </p>
      )}
    </div>
  )
}
