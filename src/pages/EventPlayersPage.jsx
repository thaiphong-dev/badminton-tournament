import { useEffect, useState, startTransition } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/hooks/useAuth'
import { ChevronRight, CheckCircle, AlertCircle, Loader2, Users, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { DISCIPLINE_LABELS, DISCIPLINE_ICONS, FORMAT_LABELS } from '@/lib/constants'
import { isDoublesDiscipline } from '@/lib/utils/eventHelpers'
import PlayerImport from '@/components/tournament/PlayerImport'
import Button from '@/components/ui/Button'
import Breadcrumb from '@/components/layout/Breadcrumb'

export default function EventPlayersPage() {
  const { id: tournamentId, eventId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [tournament, setTournament] = useState(null)
  const [event, setEvent]           = useState(null)
  const [players, setPlayers]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [playerCount, setPlayerCount] = useState(0)

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const [tRes, eRes, pRes] = await Promise.all([
        supabase.from('tournaments').select('id, name').eq('id', tournamentId).single(),
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase.from('players').select('*').eq('event_id', eventId).order('created_at'),
      ])
      if (tRes.error) throw tRes.error
      if (eRes.error) throw eRes.error
      setTournament(tRes.data)
      setEvent(eRes.data)
      setPlayers(pRes.data || [])
      setPlayerCount((pRes.data || []).length)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { startTransition(() => { fetchData() }) }, [eventId])

  function handleImportComplete(count) {
    setPlayerCount(count)
  }

  // ── Next step routing ──────────────────────────────────────────────────────
  function goNext() {
    if (event?.format === 'knockout_only') {
      navigate(`/tournament/${tournamentId}/event/${eventId}/knockout`)
    } else {
      navigate(`/tournament/${tournamentId}/event/${eventId}/groups`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-600">{error || 'Không tìm thấy nội dung thi đấu.'}</p>
      </div>
    )
  }

  const isCreator = !!profile && tournament?.creator_id === profile.id
  const canEdit   = !!profile && (isCreator || profile?.role === 'admin')

  const disciplineIcon  = DISCIPLINE_ICONS[event.discipline] ?? '🏸'
  const disciplineLabel = DISCIPLINE_LABELS[event.discipline] ?? event.name
  const isDoubles       = isDoublesDiscipline(event.discipline)
  const nextLabel = event.format === 'knockout_only' ? 'Tạo bracket' : 'Phân bảng'

  // Min players needed: at least 2 for knockout-only, or num_groups * 2 for group stage
  const minNeeded = event.format === 'knockout_only'
    ? 2
    : Math.max(2, (event.num_groups ?? 2) * 2)
  const readyForNext = playerCount >= minNeeded

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Breadcrumb
        className="mb-6"
        items={[
          { label: 'Trang chủ', href: '/' },
          { label: tournament?.name ?? '…', href: `/tournament/${tournamentId}` },
          { label: disciplineLabel, href: `/tournament/${tournamentId}/event/${eventId}/setup` },
          { label: 'Import VĐV' },
        ]}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl leading-none">{disciplineIcon}</span>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{disciplineLabel} — Import VĐV</h1>
          <p className="text-sm text-gray-400">
            {isDoubles ? 'Thêm các cặp đôi tham dự' : 'Thêm vận động viên tham dự'}{' '}
            · {FORMAT_LABELS[event.format] ?? event.format}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(`/tournament/${tournamentId}/event/${eventId}/setup`)}
        >
          <ArrowLeft className="w-4 h-4" />
          Cấu hình
        </Button>
      </div>

      {/* Player count summary */}
      {playerCount > 0 && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 mb-5 text-sm text-blue-700">
          <Users className="w-4 h-4 shrink-0" />
          Hiện có <strong>{playerCount}</strong> {isDoubles ? 'đôi' : 'VĐV'} đã lưu
          {event.format === 'group_then_knockout' && event.num_groups && (
            <span className="text-blue-500 ml-1">
              · {event.num_groups} bảng
              → cần ít nhất {event.num_groups * 2} người
            </span>
          )}
        </div>
      )}

      {/* Import component — creator/admin only */}
      {canEdit && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <PlayerImport
            tournamentId={tournamentId}
            eventId={eventId}
            discipline={event.discipline}
            existingPlayers={players}
            requirePlayerCode={event.require_player_code ?? false}
            onImportComplete={handleImportComplete}
          />
        </div>
      )}

      {/* Next step CTA — creator/admin only */}
      {readyForNext && canEdit && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">
                Đã có {playerCount} {isDoubles ? 'đôi' : 'VĐV'} — sẵn sàng!
              </p>
              <p className="text-xs text-green-600 mt-0.5">
                Bước tiếp theo: {nextLabel}
              </p>
            </div>
          </div>
          <Button onClick={goNext} className="whitespace-nowrap">
            {nextLabel} <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
