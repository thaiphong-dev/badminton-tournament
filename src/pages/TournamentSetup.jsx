import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Trophy, Users, ChevronRight, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { STATUS_LABELS } from '@/lib/constants'
import Badge from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Button from '@/components/ui/Button'
import Breadcrumb from '@/components/layout/Breadcrumb'
import PlayerImport from '@/components/tournament/PlayerImport'

const STATUS_BADGE_VARIANT = {
  setup: 'yellow',
  group_stage: 'blue',
  knockout: 'purple',
  completed: 'green',
}

export default function TournamentSetup() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [tournament, setTournament] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [totalPlayers, setTotalPlayers] = useState(0)

  useEffect(() => {
    fetchData()
  }, [id])

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const [tournamentRes, playersRes] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', id).single(),
        supabase.from('players').select('*').eq('tournament_id', id).order('created_at'),
      ])

      if (tournamentRes.error) throw tournamentRes.error
      if (playersRes.error) throw playersRes.error

      setTournament(tournamentRes.data)
      setPlayers(playersRes.data || [])
      setTotalPlayers((playersRes.data || []).length)
    } catch (err) {
      console.error(err)
      setError('Không tìm thấy giải đấu hoặc lỗi kết nối.')
    } finally {
      setLoading(false)
    }
  }

  function handleImportComplete(count) {
    setTotalPlayers(count)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner size="lg" text="Đang tải..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <Link to="/" className="text-blue-600 underline text-sm">Quay lại trang chủ</Link>
      </div>
    )
  }

  if (!tournament) return null

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      <Breadcrumb
        className="mb-6"
        items={[
          { label: 'Trang chủ', href: '/' },
          { label: tournament.name, href: `/tournament/${id}` },
          { label: 'Import VĐV' },
        ]}
      />

      {/* Tournament header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 truncate">{tournament.name}</h1>
              <Badge variant={STATUS_BADGE_VARIANT[tournament.status] || 'default'}>
                {STATUS_LABELS[tournament.status] || tournament.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span>{tournament.num_groups} bảng đấu</span>
              <span>·</span>
              <span className={`flex items-center gap-1 ${totalPlayers > 0 ? 'text-green-600' : ''}`}>
                <Users className="w-3.5 h-3.5" />
                {totalPlayers} vận động viên
              </span>
            </div>
          </div>
        </div>

        {/* Progress steps */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <TournamentProgress status={tournament.status} />
        </div>
      </div>

      {/* Import section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">
            1
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Import Vận Động Viên</h2>
            <p className="text-sm text-gray-500">Upload file Excel hoặc thêm thủ công</p>
          </div>
        </div>

        <PlayerImport
          tournamentId={id}
          existingPlayers={players}
          onImportComplete={handleImportComplete}
        />
      </div>

      {/* Next step CTA */}
      {totalPlayers > 0 && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">
                Đã có {totalPlayers} VĐV — sẵn sàng phân bảng!
              </p>
              <p className="text-xs text-green-600 mt-0.5">
                Bước tiếp theo: Random {tournament.num_groups} bảng tự động
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate(`/tournament/${id}/groups`)}
            className="whitespace-nowrap"
          >
            Vào vòng bảng <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Progress stepper ─────────────────────────────────────────────────────────

const STEPS = [
  { key: 'setup',       label: 'Import VĐV' },
  { key: 'group_stage', label: 'Vòng bảng'  },
  { key: 'knockout',    label: 'Knockout'    },
  { key: 'completed',   label: 'Kết thúc'   },
]

const ORDER = { setup: 0, group_stage: 1, knockout: 2, completed: 3 }

function TournamentProgress({ status }) {
  const currentOrder = ORDER[status] ?? 0

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, idx) => {
        const stepOrder = ORDER[step.key]
        const done = stepOrder < currentOrder
        const active = stepOrder === currentOrder

        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center min-w-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                done   ? 'bg-green-500 text-white' :
                active ? 'bg-blue-600 text-white' :
                         'bg-gray-200 text-gray-400'
              }`}>
                {done ? <CheckCircle className="w-3.5 h-3.5" /> : idx + 1}
              </div>
              <span className={`text-xs mt-1 whitespace-nowrap ${
                active ? 'text-blue-600 font-medium' :
                done   ? 'text-green-600' :
                         'text-gray-400'
              }`}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`h-px flex-1 mx-2 mb-3 transition-colors ${done ? 'bg-green-300' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
