import { useEffect, useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils/cn'
import { DISCIPLINE_LABELS, DISCIPLINE_ICONS } from '@/lib/constants'
import Breadcrumb from '@/components/layout/Breadcrumb'
import Badge from '@/components/ui/Badge'

const STAGE_LABELS = {
  group: 'Vòng bảng', round_of_64: '1/32', round_of_32: '1/16',
  round_of_16: '1/8', quarter: 'Tứ kết', semi: 'Bán kết',
  final: 'Chung kết', third_place: 'Hạng 3',
}

const TOURNAMENT_STATUS_BADGE = {
  setup: 'yellow', group_stage: 'blue', knockout: 'purple', completed: 'green',
}


function computeCareerStats(playerId, matches) {
  let wins = 0, losses = 0, setsWon = 0, setsLost = 0, ptsFor = 0, ptsAgainst = 0
  for (const m of matches) {
    const isP1 = m.player1_id === playerId
    const s1 = isP1 ? (m.player1_scores ?? []) : (m.player2_scores ?? [])
    const s2 = isP1 ? (m.player2_scores ?? []) : (m.player1_scores ?? [])
    const won = m.winner_id === playerId
    wins += won ? 1 : 0
    losses += won ? 0 : 1
    s1.forEach((v, i) => {
      const v2 = s2[i] ?? 0
      setsWon += v > v2 ? 1 : 0
      setsLost += v < v2 ? 1 : 0
      ptsFor += v; ptsAgainst += v2
    })
  }
  return { wins, losses, setsWon, setsLost, ptsFor, ptsAgainst, totalMatches: wins + losses }
}

function formatDateRange(start, end) {
  if (!start) return '—'
  const fmt = (d) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start)
}

export default function PlayerProfilePage() {
  const { playerId } = useParams()
  const { t: tr } = useI18n()

  const [player,      setPlayer]      = useState(null)
  const [matches,     setMatches]     = useState([])
  const [registrations, setRegistrations] = useState([])
  const [opponentMap, setOpponentMap] = useState({})
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    if (!playerId) return
    async function load() {
      setLoading(true)

      const [pRes, rRes, mRes] = await Promise.all([
        supabase.from('players').select('id, name, club, email').eq('id', playerId).single(),
        supabase.from('registrations')
          .select('id, status, event_id, events(id, event_type, tournament_id, tournaments(id, name, status, start_date, end_date))')
          .eq('player_id', playerId)
          .eq('status', 'approved'),
        supabase.from('matches')
          .select('id, stage, match_number, status, player1_id, player2_id, winner_id, player1_scores, player2_scores, tournament_id')
          .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
          .eq('status', 'completed'),
      ])

      setPlayer(pRes.data ?? null)
      setRegistrations(rRes.data ?? [])
      const mList = mRes.data ?? []
      setMatches(mList)

      const oppIds = [...new Set(
        mList.flatMap(m => [m.player1_id, m.player2_id]).filter(id => id && id !== playerId)
      )]
      if (oppIds.length > 0) {
        const { data: oppList } = await supabase.from('players').select('id, name, club').in('id', oppIds)
        setOpponentMap(Object.fromEntries((oppList ?? []).map(p => [p.id, p])))
      }

      setLoading(false)
    }
    load()
  }, [playerId])

  const stats = useMemo(() => computeCareerStats(playerId, matches), [playerId, matches])
  const winRate = stats.totalMatches > 0 ? Math.round((stats.wins / stats.totalMatches) * 100) : 0

  // Group registrations by tournament, sorted by start_date desc
  const tournamentGroups = useMemo(() => {
    const map = {}
    for (const reg of registrations) {
      const t = reg.events?.tournaments
      if (!t) continue
      if (!map[t.id]) map[t.id] = { tournament: t, regs: [] }
      map[t.id].regs.push(reg)
    }
    return Object.values(map).sort((a, b) => {
      const da = new Date(a.tournament.start_date ?? 0)
      const db = new Date(b.tournament.start_date ?? 0)
      return db - da
    })
  }, [registrations])

  // Last 10 matches, most recent first (by match_number desc as proxy)
  const recentMatches = useMemo(() => {
    return [...matches]
      .sort((a, b) => (b.match_number ?? 0) - (a.match_number ?? 0))
      .slice(0, 10)
  }, [matches])

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!player) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-xl font-semibold text-gray-700">Không tìm thấy vận động viên</p>
        <Link to="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline">Về trang chủ</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <Breadcrumb items={[
          { label: 'Trang chủ', href: '/' },
          { label: player.name },
        ]} />

        {/* ── Player card ─────────────────────────────────────────────────────── */}
        <div className="bg-gray-900 text-white rounded-2xl p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-2xl font-bold shrink-0">
              {player.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-tight">{player.name}</h1>
              {player.club && (
                <span className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-gray-300">
                  {player.club}
                </span>
              )}
            </div>
          </div>

          {/* Career stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Thắng / Thua', value: `${stats.wins} / ${stats.losses}` },
              { label: 'Tỉ lệ thắng', value: `${winRate}%` },
              { label: 'Set thắng / thua', value: `${stats.setsWon} / ${stats.setsLost}` },
              { label: 'Tổng điểm', value: `${stats.ptsFor}` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/10 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className="text-lg font-bold">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tournament history ───────────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">Lịch sử thi đấu giải</h2>
          {tournamentGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-400 text-sm">
              Chưa tham dự giải nào.
            </div>
          ) : (
            <div className="space-y-3">
              {tournamentGroups.map(({ tournament: t, regs }) => {
                const tMatches = matches.filter(m => m.tournament_id === t.id)
                const tWins    = tMatches.filter(m => m.winner_id === playerId).length
                return (
                  <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <Link
                          to={`/tournament/${t.id}`}
                          className="font-semibold text-gray-900 hover:text-blue-600 transition-colors line-clamp-1"
                        >
                          {t.name}
                        </Link>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDateRange(t.start_date, t.end_date)}</p>
                      </div>
                      <Badge variant={TOURNAMENT_STATUS_BADGE[t.status] ?? 'default'}>
                        {tr('status.' + t.status) || t.status}
                      </Badge>
                    </div>

                    {/* Events entered */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {regs.map(reg => (
                        <span
                          key={reg.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                        >
                          <span>{DISCIPLINE_ICONS[reg.events?.event_type] ?? '🏸'}</span>
                          {DISCIPLINE_LABELS[reg.events?.event_type] ?? reg.events?.event_type}
                        </span>
                      ))}
                    </div>

                    {/* Per-tournament match summary */}
                    {tMatches.length > 0 && (
                      <div className="flex items-center gap-3 text-xs text-gray-500 border-t border-gray-50 pt-2">
                        <span>{tMatches.length} trận đã đấu</span>
                        <span className="text-green-600 font-semibold">{tWins} thắng</span>
                        <span className="text-red-500 font-semibold">{tMatches.length - tWins} thua</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Recent matches ───────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">Trận đấu gần đây</h2>
          {recentMatches.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-400 text-sm">
              Chưa có trận hoàn thành.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              {recentMatches.map(m => {
                const isP1   = m.player1_id === playerId
                const oppId  = isP1 ? m.player2_id : m.player1_id
                const opp    = opponentMap[oppId] ?? { name: 'Không rõ' }
                const won    = m.winner_id === playerId
                const myScores  = isP1 ? (m.player1_scores ?? []) : (m.player2_scores ?? [])
                const oppScores = isP1 ? (m.player2_scores ?? []) : (m.player1_scores ?? [])
                const score  = myScores.length > 0
                  ? myScores.map((v, i) => `${v}–${oppScores[i] ?? 0}`).join(', ')
                  : '—'
                return (
                  <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={cn(
                        'shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                        won ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                      )}>
                        {won ? 'T' : 'B'}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">vs {opp.name}</p>
                        <p className="text-xs text-gray-400">{STAGE_LABELS[m.stage] ?? m.stage}</p>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-gray-600 shrink-0">{score}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
