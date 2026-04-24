import { useState } from 'react'
import { Crown, Medal, Trophy, ChevronRight, AlertCircle, Loader2, Info } from 'lucide-react'
import { getQualifiedPlayers, confirmQualification } from '@/lib/utils/qualifyPlayers'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

/**
 * Shows when all group-stage matches are done.
 * Loads the qualified players, lets the user review, then confirms and navigates.
 *
 * Props:
 *  tournament  – tournament row (always required for id)
 *  event       – event row (optional; used in per-event flow for config + status update)
 *  onConfirmed – callback after confirmation
 */
export default function QualifySection({ tournament, event, onConfirmed }) {
  const [phase, setPhase] = useState('idle')      // 'idle' | 'loading' | 'preview' | 'confirming'
  const [qualified, setQualified] = useState([])
  const [error, setError] = useState(null)

  // Use event config when available, fall back to tournament config (legacy)
  const numFirst  = (event ?? tournament).num_first_place_qualify  ?? 12
  const numSecond = (event ?? tournament).num_second_place_qualify ?? 4
  const total     = numFirst + numSecond
  const eventId   = event?.id ?? null

  async function handleLoad() {
    setPhase('loading')
    setError(null)
    try {
      const players = await getQualifiedPlayers(tournament.id, numFirst, numSecond, eventId)
      setQualified(players.sort((a, b) => a.seed - b.seed))
      setPhase('preview')
    } catch (err) {
      setError(`Không thể tải danh sách: ${err.message}`)
      setPhase('idle')
    }
  }

  async function handleConfirm() {
    setPhase('confirming')
    setError(null)
    try {
      await confirmQualification(tournament.id, eventId)
      onConfirmed()
    } catch (err) {
      setError(`Lỗi xác nhận: ${err.message}`)
      setPhase('preview')
    }
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-blue-900">Vòng bảng hoàn thành!</h3>
          </div>
          <p className="text-sm text-blue-700">
            Chọn <strong>{numFirst}</strong> nhất bảng + <strong>{numSecond}</strong> nhì bảng tốt nhất
            → <strong>{total}</strong> VĐV vào vòng knockout
          </p>
        </div>

        {phase === 'idle' && (
          <Button onClick={handleLoad} size="sm">
            Xem {total} VĐV vào Knockout
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Loading */}
      {phase === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          Đang tính toán...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Preview list */}
      {(phase === 'preview' || phase === 'confirming') && qualified.length > 0 && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* First place */}
            <QualifyGroup
              title={`${numFirst} Nhất bảng`}
              icon={<Crown className="w-4 h-4 text-yellow-600" />}
              color="yellow"
              players={qualified.filter(p => p.qualified_as === 'Nhất bảng')}
              />
            {/* Best second place */}
            <QualifyGroup
              title={`${numSecond} Nhì bảng tốt nhất`}
              icon={<Medal className="w-4 h-4 text-blue-600" />}
              color="blue"
              players={qualified.filter(p => p.qualified_as === 'Nhì bảng')}
            />
          </div>

          {/* Confirm */}
          <div className="flex items-center justify-between pt-3 border-t border-blue-200">
            <p className="text-xs text-blue-600">
              Seeding được gán tự động · Nhất bảng: seed 1–{numFirst} · Nhì bảng: seed {numFirst + 1}–{total}
            </p>
            <Button
              onClick={handleConfirm}
              loading={phase === 'confirming'}
            >
              Xác nhận → Vào Knockout
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function QualifyGroup({ title, icon, color, players }) {
  const headerClass = color === 'yellow'
    ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
    : 'bg-blue-50 border-blue-200 text-blue-800'

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className={cn('flex items-center gap-2 px-4 py-2.5 border-b text-sm font-semibold', headerClass)}>
        {icon}
        {title}
      </div>
      <ul className="divide-y divide-gray-50">
        {players.map(p => {
          const diffStr = p.score_diff > 0 ? `+${p.score_diff}` : `${p.score_diff}`
          return (
            <li key={p.player_id} className="flex items-center justify-between px-4 py-2 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-gray-400 w-5 shrink-0">{p.seed}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.player_name}</p>
                  <p className="text-xs text-gray-400 truncate">{p.club}</p>
                </div>
              </div>
              <div className="text-xs text-gray-400 text-right shrink-0 ml-2 tabular-nums">
                <span className="font-medium text-gray-600">{p.points}đ</span>
                {' · '}
                {p.wins}T {p.losses}B
                {' · '}
                {diffStr}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
