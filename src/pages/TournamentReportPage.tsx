import { useEffect, useState, useMemo, startTransition } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import FeatureGate from '@/components/ui/FeatureGate'
import UpgradePrompt from '@/components/ui/UpgradePrompt'
import { ArrowLeft, Download, ChevronUp, ChevronDown, Loader2, Trophy, Clock, Feather, Timer, HeartPulse } from 'lucide-react'
import * as XLSX from 'xlsx'

const STAGE_LABELS = {
  group: 'Vòng bảng',
  round_of_64: '1/32', round_of_32: '1/16', round_of_16: '1/8',
  quarter: 'Tứ kết', semi: 'Bán kết',
  final: 'Chung kết', third_place: 'Hạng 3',
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}g ${m}p`
  if (m > 0) return `${m}p ${s}s`
  return `${s}s`
}

function formatTotalDuration(seconds) {
  if (!seconds || seconds <= 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h} giờ ${m} phút`
  return `${m} phút`
}

export default function TournamentReportPage() {
  const { id } = useParams()


  const [tournament, setTournament] = useState(null)
  const [matches,    setMatches]    = useState([])
  const [playerMap,  setPlayerMap]  = useState({})
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  const [sortKey, setSortKey] = useState('matchCount')
  const [sortDir, setSortDir] = useState('desc')
  const [exporting, setExporting] = useState(false)

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const [tRes, mRes] = await Promise.all([
        supabase.from('tournaments').select('id, name').eq('id', id).single(),
        supabase.from('matches')
          .select('id, player1_id, player2_id, stage, status, shuttle_count, match_number, match_stats(p1_service_faults, p1_yellow_cards, p1_red_cards, p2_service_faults, p2_yellow_cards, p2_red_cards, match_duration_seconds, injury_timeouts)')
          .eq('tournament_id', id)
          .eq('status', 'completed'),
      ])
      if (tRes.error) throw tRes.error
      setTournament(tRes.data)

      const rows = mRes.data ?? []
      setMatches(rows)

      const playerIds = [...new Set(rows.flatMap(m => [m.player1_id, m.player2_id]).filter(Boolean))]
      if (playerIds.length > 0) {
        const { data: players } = await supabase.from('players').select('id, name').in('id', playerIds)
        setPlayerMap(Object.fromEntries((players ?? []).map(p => [p.id, p])))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    startTransition(() => { fetchData() })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Overview aggregations ──────────────────────────────────────────────────
  const overview = useMemo(() => {
    const totalDuration = matches.reduce((s, m) => s + (m.match_stats?.match_duration_seconds ?? 0), 0)
    const totalShuttles = matches.reduce((s, m) => s + (m.shuttle_count ?? 0), 0)
    const longestSec    = matches.reduce((mx, m) => Math.max(mx, m.match_stats?.match_duration_seconds ?? 0), 0)
    return { count: matches.length, totalDuration, totalShuttles, longestSec }
  }, [matches])

  // ── Player stats aggregation ───────────────────────────────────────────────
  const playerStats = useMemo(() => {
    const map = {}
    for (const m of matches) {
      const s = m.match_stats
      const add = (pid, sf, yc, rc) => {
        if (!pid) return
        if (!map[pid]) map[pid] = { matchCount: 0, serviceFaults: 0, yellowCards: 0, redCards: 0 }
        map[pid].matchCount++
        map[pid].serviceFaults += sf ?? 0
        map[pid].yellowCards   += yc ?? 0
        map[pid].redCards      += rc ?? 0
      }
      add(m.player1_id, s?.p1_service_faults, s?.p1_yellow_cards, s?.p1_red_cards)
      add(m.player2_id, s?.p2_service_faults, s?.p2_yellow_cards, s?.p2_red_cards)
    }
    return Object.entries(map).map(([playerId, stats]) => ({ playerId, ...stats }))
  }, [matches])

  const sortedPlayerStats = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...playerStats].sort((a, b) => dir * (a[sortKey] - b[sortKey]))
  }, [playerStats, sortKey, sortDir])

  // ── Injury timeout aggregation ────────────────────────────────────────────
  const injuryStats = useMemo(() => {
    const logs = matches.flatMap(m => {
      const its = m.match_stats?.injury_timeouts
      if (!Array.isArray(its) || its.length === 0) return []
      return its.map(it => ({ ...it, matchId: m.id }))
    })
    const totalDuration = logs.reduce((s, it) => s + (it.duration_seconds ?? 0), 0)
    return { count: logs.length, totalDuration, logs }
  }, [matches])

  // ── Shuttle usage by stage ─────────────────────────────────────────────────
  const stageStats = useMemo(() => {
    const map = {}
    for (const m of matches) {
      const stage = m.stage ?? 'unknown'
      if (!map[stage]) map[stage] = { count: 0, totalShuttles: 0 }
      map[stage].count++
      map[stage].totalShuttles += m.shuttle_count ?? 0
    }
    const stageOrder = ['group', 'round_of_64', 'round_of_32', 'round_of_16', 'quarter', 'semi', 'final', 'third_place']
    return Object.entries(map)
      .map(([stage, data]) => ({ stage, ...data, avg: data.count > 0 ? (data.totalShuttles / data.count).toFixed(1) : '—' }))
      .sort((a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage))
  }, [matches])

  // ── Excel export ───────────────────────────────────────────────────────────
  function exportExcel() {
    setExporting(true)
    setTimeout(() => {
      const rows = sortedPlayerStats.map((p, i) => ({
        '#':             i + 1,
        'Tên VĐV':       playerMap[p.playerId]?.name ?? p.playerId,
        'Số trận':       p.matchCount,
        'Lỗi phát cầu': p.serviceFaults,
        'Thẻ vàng':      p.yellowCards,
        'Thẻ đỏ':        p.redCards,
      }))
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows)
      // Column widths
      ws['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, ws, 'Thống kê VĐV')

      // Overview sheet
      const ovRows = [
        { 'Chỉ số': 'Tổng trận hoàn thành', 'Giá trị': overview.count },
        { 'Chỉ số': 'Tổng thời gian thi đấu', 'Giá trị': formatTotalDuration(overview.totalDuration) },
        { 'Chỉ số': 'Tổng cầu lông đã dùng', 'Giá trị': overview.totalShuttles },
        { 'Chỉ số': 'Trận dài nhất', 'Giá trị': formatDuration(overview.longestSec) },
      ]
      const wsOv = XLSX.utils.json_to_sheet(ovRows)
      wsOv['!cols'] = [{ wch: 28 }, { wch: 20 }]
      XLSX.utils.book_append_sheet(wb, wsOv, 'Tổng quan')

      const filename = `bao-cao-${tournament?.name?.replace(/\s+/g, '-') ?? id}.xlsx`
      XLSX.writeFile(wb, filename)
      setExporting(false)
    }, 600)
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-red-600">{error}</div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link
            to={`/tournament/${id}`}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> {tournament?.name}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Báo cáo tổng kết giải</h1>
          <p className="text-sm text-gray-500 mt-1">
            {overview.count} trận hoàn thành · {playerStats.length} vận động viên
          </p>
        </div>
        <FeatureGate feature="export_data" fallback={<UpgradePrompt feature="export_data" compact />}>
          <button
            onClick={exportExcel}
            disabled={playerStats.length === 0 || exporting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang xuất...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Xuất Excel
              </>
            )}
          </button>
        </FeatureGate>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<Trophy className="w-5 h-5 text-blue-600" />}
          bg="bg-blue-50"
          label="Trận hoàn thành"
          value={overview.count}
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-purple-600" />}
          bg="bg-purple-50"
          label="Tổng thời gian"
          value={formatTotalDuration(overview.totalDuration)}
        />
        <StatCard
          icon={<Feather className="w-5 h-5 text-amber-600" />}
          bg="bg-amber-50"
          label="Tổng cầu lông"
          value={overview.totalShuttles}
          unit="quả"
        />
        <StatCard
          icon={<Timer className="w-5 h-5 text-red-500" />}
          bg="bg-red-50"
          label="Trận dài nhất"
          value={formatDuration(overview.longestSec)}
        />
        <StatCard
          icon={<HeartPulse className="w-5 h-5 text-rose-600" />}
          bg="bg-rose-50"
          label="Chấn thương"
          value={injuryStats.count}
          unit={injuryStats.count > 0 ? `(${formatTotalDuration(injuryStats.totalDuration)})` : undefined}
        />
      </div>

      {/* Player stats table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Thống kê vận động viên</h2>
          <span className="text-xs text-gray-400">{playerStats.length} VĐV</span>
        </div>

        {playerStats.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            Chưa có dữ liệu thống kê.
            <br />
            <span className="text-xs text-gray-300 mt-1 block">Dữ liệu sẽ xuất hiện sau khi trọng tài ghi nhận trong trận đấu.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-6 py-3 w-8">#</th>
                  <th className="text-left px-4 py-3">Tên VĐV</th>
                  <th className="px-4 py-3 text-right">
                    <ThBtn col="matchCount" onSort={toggleSort} sortKey={sortKey} sortDir={sortDir}>Số trận</ThBtn>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <ThBtn col="serviceFaults" onSort={toggleSort} sortKey={sortKey} sortDir={sortDir}>🏸 Lỗi phát</ThBtn>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <ThBtn col="yellowCards" onSort={toggleSort} sortKey={sortKey} sortDir={sortDir}>🟨 Thẻ vàng</ThBtn>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <ThBtn col="redCards" onSort={toggleSort} sortKey={sortKey} sortDir={sortDir}>🟥 Thẻ đỏ</ThBtn>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedPlayerStats.map((p, i) => {
                  const name  = playerMap[p.playerId]?.name ?? '—'
                  const hasCard = p.yellowCards > 0 || p.redCards > 0
                  return (
                    <tr key={p.playerId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 text-gray-400 text-xs w-8">{i + 1}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{name}</span>
                        {hasCard && <span className="ml-2 text-xs text-red-400 font-semibold">⚠</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">{p.matchCount}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={p.serviceFaults > 0 ? 'text-orange-600 font-semibold' : 'text-gray-300'}>
                          {p.serviceFaults}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={p.yellowCards > 0 ? 'text-yellow-600 font-bold' : 'text-gray-300'}>
                          {p.yellowCards}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={p.redCards > 0 ? 'text-red-600 font-bold' : 'text-gray-300'}>
                          {p.redCards}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Shuttle usage by stage */}
      {stageStats.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">Sử dụng cầu lông theo vòng đấu</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-6 py-3">Vòng đấu</th>
                  <th className="px-4 py-3 text-right">Số trận</th>
                  <th className="px-4 py-3 text-right">Tổng cầu</th>
                  <th className="px-4 py-3 text-right">TB / trận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stageStats.map(s => (
                  <tr key={s.stage} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {STAGE_LABELS[s.stage] ?? s.stage}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 font-mono">{s.count}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={s.totalShuttles > 0 ? 'text-amber-700 font-semibold' : 'text-gray-400'}>
                        {s.totalShuttles}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">
                      {s.avg !== '—' ? `${s.avg} quả` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Injury timeouts log */}
      {injuryStats.count > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">Thời gian chấn thương</h2>
            <span className="text-xs text-gray-400">{injuryStats.count} lần · {formatTotalDuration(injuryStats.totalDuration)} tổng cộng</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-6 py-3">#</th>
                  <th className="text-left px-4 py-3">Set</th>
                  <th className="px-4 py-3 text-right">Thời lượng</th>
                  <th className="px-4 py-3 text-right">Thời điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {injuryStats.logs.map((it, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 text-gray-700">Set {it.set_num ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className="text-rose-600 font-semibold">{formatDuration(it.duration_seconds)}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {it.at ? new Date(it.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {matches.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-200" />
          <p className="font-medium">Chưa có trận đấu hoàn thành</p>
          <p className="text-sm text-gray-300 mt-1">Báo cáo sẽ hiện sau khi có kết quả trận đầu tiên</p>
        </div>
      )}

    </div>
  )
}

function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey !== col) return <ChevronUp className="w-3 h-3 text-gray-300" />
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-blue-500" />
    : <ChevronDown className="w-3 h-3 text-blue-500" />
}

function ThBtn({ col, children, onSort, sortKey, sortDir }) {
  return (
    <button
      onClick={() => onSort(col)}
      className="flex items-center gap-1 font-semibold hover:text-blue-600 transition-colors"
    >
      {children}
      <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
    </button>
  )
}

function StatCard({ icon, bg, label, value, unit }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
      <p className="text-2xl font-black text-gray-900 leading-tight">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </p>
    </div>
  )
}
