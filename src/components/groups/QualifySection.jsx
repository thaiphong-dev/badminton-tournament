import { useState } from 'react'
import { Crown, Medal, Trophy, ChevronRight, AlertCircle, Loader2, Wand2, LayoutGrid } from 'lucide-react'
import { getQualifiedPlayers, confirmQualification } from '@/lib/utils/qualifyPlayers'
import { saveKnockoutBracket } from '@/lib/utils/bracketGenerator'
import BracketBuilder from '@/components/groups/BracketBuilder'
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
  const [phase,        setPhase]        = useState('idle')   // 'idle'|'loading'|'preview'|'confirming'
  const [pairingMode,  setPairingMode]  = useState('auto')   // 'auto'|'manual'
  const [qualified,    setQualified]    = useState([])
  const [manualPairings, setManualPairings] = useState(null) // [{p1Id,p2Id}] | null
  const [error,        setError]        = useState(null)

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
      setManualPairings(null)
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
      if (pairingMode === 'manual') {
        if (!manualPairings) throw new Error('Vui lòng xếp đủ tất cả các cặp đấu.')
        // Save bracket with custom pairings BEFORE updating status so KnockoutPage
        // hits the idempotency guard and reuses this bracket.
        await saveKnockoutBracket(qualified, tournament.id, eventId, manualPairings)
      }
      await confirmQualification(tournament.id, eventId)
      onConfirmed()
    } catch (err) {
      setError(`Lỗi xác nhận: ${err.message}`)
      setPhase('preview')
    }
  }

  const isPreview    = phase === 'preview' || phase === 'confirming'
  const canConfirm   = pairingMode === 'auto' || (pairingMode === 'manual' && manualPairings !== null)

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

      {/* Preview */}
      {isPreview && qualified.length > 0 && (
        <div className="space-y-4">

          {/* Qualified player list */}
          <div className="grid gap-4 sm:grid-cols-2">
            <QualifyGroup
              title={`${numFirst} Nhất bảng`}
              icon={<Crown className="w-4 h-4 text-yellow-600" />}
              color="yellow"
              players={qualified.filter(p => p.qualified_as === 'Nhất bảng')}
            />
            <QualifyGroup
              title={`${numSecond} Nhì bảng tốt nhất`}
              icon={<Medal className="w-4 h-4 text-blue-600" />}
              color="blue"
              players={qualified.filter(p => p.qualified_as === 'Nhì bảng')}
            />
          </div>

          {/* ── Pairing mode toggle ── */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex">
              <ModeTab
                active={pairingMode === 'auto'}
                onClick={() => setPairingMode('auto')}
                icon={<Wand2 className="w-4 h-4" />}
                label="Seed tự động"
                desc="Hệ thống tự xếp theo seed (1 vs 16, 2 vs 15...)"
              />
              <ModeTab
                active={pairingMode === 'manual'}
                onClick={() => setPairingMode('manual')}
                icon={<LayoutGrid className="w-4 h-4" />}
                label="Xếp cặp thủ công"
                desc="Kéo thả VĐV vào từng ô trận đấu"
                right
              />
            </div>

            {/* Manual bracket builder */}
            {pairingMode === 'manual' && (
              <div className="p-4 border-t border-gray-100">
                <BracketBuilder
                  qualified={qualified}
                  onPairingsChange={setManualPairings}
                />
              </div>
            )}

            {/* Auto mode info */}
            {pairingMode === 'auto' && (
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500">
                  Seed 1–{numFirst} = nhất bảng (theo thứ tự bảng) · Seed {numFirst + 1}–{total} = nhì bảng tốt nhất
                </p>
              </div>
            )}
          </div>

          {/* Confirm */}
          <div className="flex items-center justify-end pt-1">
            <Button
              onClick={handleConfirm}
              loading={phase === 'confirming'}
              disabled={!canConfirm}
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

function ModeTab({ active, onClick, icon, label, desc, right }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-start gap-3 px-4 py-3.5 text-left transition-colors',
        right && 'border-l border-gray-100',
        active
          ? 'bg-blue-50'
          : 'bg-white hover:bg-gray-50',
      )}
    >
      <div className={cn(
        'mt-0.5 shrink-0 transition-colors',
        active ? 'text-blue-600' : 'text-gray-400',
      )}>
        {icon}
      </div>
      <div>
        <p className={cn(
          'text-sm font-semibold leading-none mb-1 transition-colors',
          active ? 'text-blue-700' : 'text-gray-600',
        )}>
          {label}
        </p>
        <p className="text-xs text-gray-400 leading-snug">{desc}</p>
      </div>
      <div className={cn(
        'ml-auto mt-1 w-4 h-4 rounded-full border-2 shrink-0 transition-colors',
        active ? 'border-blue-600 bg-blue-600' : 'border-gray-300',
      )}>
        {active && (
          <svg viewBox="0 0 16 16" className="text-white" fill="currentColor">
            <circle cx="8" cy="8" r="3" />
          </svg>
        )}
      </div>
    </button>
  )
}

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
