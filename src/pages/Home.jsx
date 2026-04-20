import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Plus, Calendar, Users, ChevronRight, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { STATUS_LABELS } from '@/lib/constants'
import Badge from '@/components/ui/Badge'

const STATUS_BADGE_VARIANT = {
  setup: 'yellow',
  group_stage: 'blue',
  knockout: 'purple',
  completed: 'green',
}

const STAGE_ROUTE = {
  setup: 'setup',
  group_stage: 'groups',
  knockout: 'knockout',
  completed: 'results',
}

export default function Home() {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchTournaments()
  }, [])

  async function fetchTournaments() {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*, players(count)')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTournaments(data || [])
    } catch (err) {
      console.error('Error fetching tournaments:', err)
      setError('Không thể tải danh sách giải đấu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Giải đấu cầu lông</h1>
          <p className="text-gray-500 mt-1">Quản lý và theo dõi các giải đấu của bạn</p>
        </div>
        <Link
          to="/tournament/create"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tạo giải đấu mới
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700">{error}</p>
          <button onClick={fetchTournaments} className="mt-3 text-sm text-red-600 underline">Thử lại</button>
        </div>
      ) : tournaments.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map(tournament => (
            <TournamentCard key={tournament.id} tournament={tournament} />
          ))}
        </div>
      )}
    </div>
  )
}

function TournamentCard({ tournament }) {
  const route = STAGE_ROUTE[tournament.status] || 'setup'
  const playerCount = tournament.players?.[0]?.count ?? 0

  return (
    <Link
      to={`/tournament/${tournament.id}/${route}`}
      className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-blue-200 transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
          <Trophy className="w-5 h-5 text-blue-600" />
        </div>
        <Badge variant={STATUS_BADGE_VARIANT[tournament.status] || 'default'}>
          {STATUS_LABELS[tournament.status] || tournament.status}
        </Badge>
      </div>

      <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
        {tournament.name}
      </h3>

      <div className="flex items-center gap-4 text-sm text-gray-500 mt-3">
        <span className="flex items-center gap-1">
          <Users className="w-4 h-4" />
          {playerCount} VĐV
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          {new Date(tournament.created_at).toLocaleDateString('vi-VN')}
        </span>
      </div>

      <div className="flex items-center justify-end mt-4 text-blue-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        Xem chi tiết <ChevronRight className="w-4 h-4 ml-0.5" />
      </div>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-24">
      <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <Trophy className="w-8 h-8 text-blue-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Chưa có giải đấu nào</h3>
      <p className="text-gray-500 mb-6">Tạo giải đấu đầu tiên của bạn để bắt đầu</p>
      <Link
        to="/tournament/create"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Tạo giải đấu mới
      </Link>
    </div>
  )
}
