import { useEffect, useState, useMemo, startTransition } from 'react'
import { createRoot } from 'react-dom/client'
import { Link, useParams } from 'react-router-dom'
import {
  Trophy, Crown, Download, AlertCircle, Loader2, ChevronRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { DISCIPLINE_LABELS, DISCIPLINE_ICONS, STATUS_LABELS } from '@/lib/constants'
import { exportTournamentSummary } from '@/lib/utils/exportResults'
import { downloadElementAsImage } from '@/lib/utils/downloadImage'
import CertificateTemplate from '@/components/certificate/CertificateTemplate'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Breadcrumb from '@/components/layout/Breadcrumb'
import { cn } from '@/lib/utils/cn'

// Slugify for certificate filenames
function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // remove diacritics
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const STAGE_ORDER = ['round_of_16', 'quarter', 'semi', 'final', 'third_place']

const STATUS_BADGE = {
  setup: 'yellow', group_stage: 'blue', knockout: 'purple', completed: 'green',
}

// ── Helper: build rankings from final + third_place matches ──────────────────
function buildRankings(matches, playerMap) {
  const fin   = matches.find(m => m.stage === 'final')
  const third = matches.find(m => m.stage === 'third_place')
  if (!fin?.winner_id) return null

  const finLoser   = fin.player1_id === fin.winner_id ? fin.player2_id : fin.player1_id
  const thirdLoser = third?.winner_id
    ? (third.player1_id === third.winner_id ? third.player2_id : third.player1_id)
    : null

  return {
    first:  playerMap[fin.winner_id]  ?? null,
    second: playerMap[finLoser]       ?? null,
    third:  third?.winner_id ? (playerMap[third.winner_id] ?? null) : null,
    fourth: thirdLoser ? (playerMap[thirdLoser] ?? null) : null,
  }
}

// ── Certificate download helper ───────────────────────────────────────────────

/**
 * Renders CertificateTemplate into a detached DOM node, captures it as PNG,
 * and triggers a download. Uses createRoot so the component gets full React lifecycle.
 */
async function downloadCertificate({ playerName, club, position, eventName, tournamentName, date, location }) {
  const container = document.createElement('div')
  container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;z-index:-1'
  document.body.appendChild(container)
  const root = createRoot(container)

  try {
    await new Promise(resolve => {
      root.render(
        <CertificateTemplate
          playerName={playerName}
          club={club}
          position={position}
          eventName={eventName}
          tournamentName={tournamentName}
          date={date}
          location={location}
        />
      )
      // Allow one paint cycle for fonts / layout to settle
      setTimeout(resolve, 200)
    })

    const el = container.firstElementChild
    if (!el) throw new Error('Certificate element not found')
    const filename = `chung-nhan-${slugify(playerName)}-${slugify(eventName)}.png`
    await downloadElementAsImage(el, filename)
  } finally {
    root.unmount()
    document.body.removeChild(container)
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TournamentResultsPage() {
  const { id } = useParams()

  const [tournament, setTournament] = useState(null)
  const [events, setEvents]         = useState([])
  const [allMatches, setAllMatches] = useState([])  // all knockout matches for tournament
  const [allPlayers, setAllPlayers] = useState([])  // all players for tournament
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [exporting, setExporting]   = useState(false)

  async function fetchAll() {
    setLoading(true)
    setError(null)
    try {
      const [tRes, eRes, mRes, pRes] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', id).single(),
        supabase.from('events').select('*').eq('tournament_id', id).order('sort_order'),
        supabase.from('matches').select('*').eq('tournament_id', id).in('stage', STAGE_ORDER).order('match_number'),
        supabase.from('players').select('id, name, club, event_id').eq('tournament_id', id),
      ])
      if (tRes.error) throw tRes.error
      if (eRes.error) throw eRes.error
      if (mRes.error) throw mRes.error
      if (pRes.error) throw pRes.error

      setTournament(tRes.data)
      setEvents(eRes.data || [])
      setAllMatches(mRes.data || [])
      setAllPlayers(pRes.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { startTransition(() => { fetchAll() }) }, [id])

  // ── Per-event derived data ───────────────────────────────────────────────────
  const eventsData = useMemo(() => {
    return events.map(ev => {
      const players   = allPlayers.filter(p => p.event_id === ev.id)
      const matches   = allMatches.filter(m => m.event_id === ev.id)
      const playerMap = Object.fromEntries(players.map(p => [p.id, p]))
      const rankings  = buildRankings(matches, playerMap)
      return { event: ev, players, matches, playerMap, rankings }
    })
  }, [events, allMatches, allPlayers])

  // ── Export ───────────────────────────────────────────────────────────────────
  function handleExport() {
    setExporting(true)
    try {
      exportTournamentSummary(tournament, eventsData)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setExporting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error || !tournament) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-600">{error || 'Không tìm thấy giải đấu.'}</p>
        <Link to="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline">← Trang chủ</Link>
      </div>
    )
  }

  const completedCount = eventsData.filter(d => d.event.status === 'completed').length
  const hasAnyResult   = eventsData.some(d => d.rankings !== null)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Trang chủ', href: '/' },
          { label: tournament.name, href: `/tournament/${id}` },
          { label: 'Kết quả chung cuộc' },
        ]}
      />

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{tournament.name}</h1>
                <Badge variant={STATUS_BADGE[tournament.status] || 'default'}>
                  {STATUS_LABELS[tournament.status] || tournament.status}
                </Badge>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {completedCount}/{events.length} nội dung hoàn thành
                {tournament.completed_at && (
                  <span className="ml-1">
                    · {new Date(tournament.completed_at).toLocaleDateString('vi-VN')}
                  </span>
                )}
              </p>
            </div>
          </div>

          {hasAnyResult && (
            <Button onClick={handleExport} loading={exporting} variant="secondary" size="sm">
              <Download className="w-4 h-4" />
              Xuất Excel tổng kết
            </Button>
          )}
        </div>
      </div>

      {/* Events results grid */}
      {eventsData.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Trophy className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Chưa có nội dung thi đấu nào.</p>
          <Link to={`/tournament/${id}`} className="text-blue-600 text-sm underline mt-2 inline-block">
            Quay lại tổng quan →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {eventsData.map(({ event, rankings }) => (
            <EventResultCard
              key={event.id}
              event={event}
              rankings={rankings}
              tournamentId={id}
              tournament={tournament}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Event Result Card ─────────────────────────────────────────────────────────
function EventResultCard({ event, rankings, tournamentId, tournament }) {
  const [downloading, setDownloading] = useState(null) // null | 1 | 2 | 3

  const icon   = DISCIPLINE_ICONS[event.discipline] ?? '🏸'
  const label  = DISCIPLINE_LABELS[event.discipline] ?? event.name
  const isDone = event.status === 'completed'

  async function handleDownload(player, position) {
    setDownloading(position)
    try {
      const date = tournament?.start_date
        ? new Date(tournament.start_date).toLocaleDateString('vi-VN')
        : undefined
      await downloadCertificate({
        playerName:     player.name,
        club:           player.club || '',
        position,
        eventName:      label,
        tournamentName: tournament?.name ?? '',
        date,
        location:       tournament?.location || undefined,
      })
    } catch (err) {
      console.error('[EventResultCard] certificate download error:', err)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header strip */}
      <div className={`h-1.5 ${isDone ? 'bg-green-400' : 'bg-gray-200'}`} />

      <div className="p-5">
        {/* Title row */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl leading-none">{icon}</span>
            <h3 className="font-bold text-gray-900">{label}</h3>
          </div>
          <Link
            to={`/tournament/${tournamentId}/event/${event.id}/results`}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Chi tiết <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Podium rows */}
        {rankings ? (
          <div className="space-y-2">
            <PodiumRow
              rank={1} player={rankings.first} medal="🥇" bg="bg-yellow-50 border-yellow-100"
              onDownload={isDone ? () => handleDownload(rankings.first, 1) : null}
              downloading={downloading === 1}
            />
            <PodiumRow
              rank={2} player={rankings.second} medal="🥈" bg="bg-gray-50 border-gray-100"
              onDownload={isDone ? () => handleDownload(rankings.second, 2) : null}
              downloading={downloading === 2}
            />
            {rankings.third && (
              <PodiumRow
                rank={3} player={rankings.third} medal="🥉" bg="bg-orange-50 border-orange-100"
                onDownload={isDone ? () => handleDownload(rankings.third, 3) : null}
                downloading={downloading === 3}
              />
            )}
            {rankings.fourth && (
              <div className="flex items-center gap-2 text-sm text-gray-500 pt-1 border-t border-gray-50 mt-2">
                <span className="w-6 text-center text-xs font-medium">4</span>
                <span className="truncate">{rankings.fourth.name}</span>
                <span className="text-xs text-gray-400 truncate ml-auto">{rankings.fourth.club}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400 text-sm">
            {isDone ? 'Không có dữ liệu kết quả' : 'Chưa hoàn thành'}
          </div>
        )}
      </div>
    </div>
  )
}

function PodiumRow({ rank, player, medal, bg, onDownload, downloading }) {
  if (!player) return null
  return (
    <div className={cn('flex items-center gap-2.5 px-3 py-2 rounded-lg border', bg)}>
      <span className="text-lg leading-none shrink-0">{medal}</span>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold truncate', rank === 1 ? 'text-gray-900' : 'text-gray-700')}>
          {player.name}
        </p>
        <p className="text-xs text-gray-400 truncate">{player.club}</p>
      </div>
      {onDownload && (
        <button
          onClick={onDownload}
          disabled={downloading}
          title="Tải chứng nhận"
          className="shrink-0 flex items-center gap-1 text-[11px] px-2 py-1 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
        >
          {downloading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Download className="w-3.5 h-3.5" />
          }
        </button>
      )}
    </div>
  )
}
