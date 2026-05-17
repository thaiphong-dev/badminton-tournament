import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils/cn'
import { Trophy, TrendingUp, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import Breadcrumb from '@/components/layout/Breadcrumb'

const STAGE_LABELS = {
  group: 'Vòng bảng', round_of_64: '1/32', round_of_32: '1/16',
  round_of_16: '1/8', quarter: 'Tứ kết', semi: 'Bán kết',
  final: 'Chung kết', third_place: 'Hạng 3',
}

function computePlayerStats(matches, playerMap) {
  const stats = {}
  const ensure = (id) => {
    if (!stats[id]) stats[id] = { id, wins: 0, losses: 0, setsWon: 0, setsLost: 0, ptsFor: 0, ptsAgainst: 0, matches: [] }
  }
  for (const m of matches) {
    if (m.status !== 'completed' || !m.winner_id) continue
    const { player1_id: p1, player2_id: p2, winner_id, player1_scores: s1arr = [], player2_scores: s2arr = [] } = m
    if (!p1 || !p2) continue
    ensure(p1); ensure(p2)

    const p1Won = winner_id === p1
    stats[p1].wins   += p1Won ? 1 : 0
    stats[p1].losses += p1Won ? 0 : 1
    stats[p2].wins   += p1Won ? 0 : 1
    stats[p2].losses += p1Won ? 1 : 0

    for (let i = 0; i < Math.max(s1arr.length, s2arr.length); i++) {
      const sv1 = s1arr[i] ?? 0, sv2 = s2arr[i] ?? 0
      stats[p1].setsWon    += sv1 > sv2 ? 1 : 0
      stats[p1].setsLost   += sv1 < sv2 ? 1 : 0
      stats[p2].setsWon    += sv2 > sv1 ? 1 : 0
      stats[p2].setsLost   += sv2 < sv1 ? 1 : 0
      stats[p1].ptsFor     += sv1; stats[p1].ptsAgainst += sv2
      stats[p2].ptsFor     += sv2; stats[p2].ptsAgainst += sv1
    }
    stats[p1].matches.push(m)
    stats[p2].matches.push(m)
  }
  return Object.values(stats).map(s => ({
    ...s,
    player: playerMap[s.id] ?? { name: 'Không rõ' },
    totalMatches: s.wins + s.losses,
    winRate: s.wins + s.losses > 0 ? s.wins / (s.wins + s.losses) : 0,
  }))
}

export default function PlayerStatsPage() {
  const { id } = useParams()
  const [tournament, setTournament] = useState(null)
  const [matches,    setMatches]    = useState([])
  const [playerMap,  setPlayerMap]  = useState({})
  const [loading,    setLoading]    = useState(true)
  const [sortKey,    setSortKey]    = useState('wins')   // wins | winRate | ptsFor
  const [sortAsc,    setSortAsc]    = useState(false)
  const [expanded,   setExpanded]   = useState(null)    // playerId

  useEffect(() => {
    async function load() {
      const [tRes, mRes] = await Promise.all([
        supabase.from('tournaments').select('id, name, status').eq('id', id).single(),
        supabase.from('matches')
          .select('id, stage, match_number, status, player1_id, player2_id, winner_id, player1_scores, player2_scores')
          .eq('tournament_id', id)
          .eq('status', 'completed'),
      ])
      setTournament(tRes.data)
      const mList = mRes.data ?? []
      setMatches(mList)
      const pIds = [...new Set(mList.flatMap(m => [m.player1_id, m.player2_id]).filter(Boolean))]
      if (pIds.length > 0) {
        const { data: pList } = await supabase.from('players').select('id, name, club').in('id', pIds)
        setPlayerMap(Object.fromEntries((pList ?? []).map(p => [p.id, p])))
      }
      setLoading(false)
    }
    load()
  }, [id])

  const stats = useMemo(() => computePlayerStats(matches, playerMap), [matches, playerMap])

  const sorted = useMemo(() => {
    const s = [...stats].sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey]
      return sortAsc ? va - vb : vb - va
    })
    return s
  }, [stats, sortKey, sortAsc])

  function toggleSort(key) {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 text-gray-300" />
    return sortAsc ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Breadcrumb items={[
          { label: tournament?.name ?? '…', href: `/tournament/${id}` },
          { label: 'Thống kê VĐV' },
        ]} />

        {/* Header */}
        <div className="flex items-center gap-3 mt-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Thống kê VĐV</h1>
            <p className="text-sm text-gray-500">{tournament?.name} · {sorted.length} vận động viên</p>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
            <p className="text-gray-400">Chưa có trận nào hoàn thành.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_repeat(5,1fr)] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <span>Vận động viên</span>
              <button className="flex items-center gap-0.5 justify-end" onClick={() => toggleSort('totalMatches')}>
                Trận <SortIcon col="totalMatches" />
              </button>
              <button className="flex items-center gap-0.5 justify-end" onClick={() => toggleSort('wins')}>
                Thắng <SortIcon col="wins" />
              </button>
              <button className="flex items-center gap-0.5 justify-end" onClick={() => toggleSort('winRate')}>
                Tỉ lệ <SortIcon col="winRate" />
              </button>
              <button className="flex items-center gap-0.5 justify-end" onClick={() => toggleSort('setsWon')}>
                Set <SortIcon col="setsWon" />
              </button>
              <button className="flex items-center gap-0.5 justify-end" onClick={() => toggleSort('ptsFor')}>
                Điểm <SortIcon col="ptsFor" />
              </button>
            </div>

            {/* Rows */}
            {sorted.map((s, idx) => {
              const isTop = idx < 3
              const isExp = expanded === s.id
              return (
                <div key={s.id} className={cn('border-b border-gray-50 last:border-0', isExp && 'bg-blue-50/40')}>
                  <button
                    className="w-full grid grid-cols-[2fr_repeat(5,1fr)] gap-2 px-4 py-3 hover:bg-gray-50 transition-colors text-sm"
                    onClick={() => setExpanded(isExp ? null : s.id)}
                  >
                    {/* Name */}
                    <div className="flex items-center gap-2 min-w-0 text-left">
                      {idx === 0 && <Trophy className="w-4 h-4 text-yellow-500 shrink-0" />}
                      {idx === 1 && <span className="w-4 h-4 text-center text-xs font-bold text-gray-400 shrink-0">2</span>}
                      {idx === 2 && <span className="w-4 h-4 text-center text-xs font-bold text-gray-400 shrink-0">3</span>}
                      {idx > 2  && <span className="w-4 text-center text-xs text-gray-300 shrink-0">{idx + 1}</span>}
                      <div className="min-w-0">
                        <p className={cn('font-medium truncate', isTop ? 'text-gray-900' : 'text-gray-700')}>{s.player.name}</p>
                        {s.player.club && <p className="text-xs text-gray-400 truncate">{s.player.club}</p>}
                      </div>
                    </div>
                    {/* Stats */}
                    <span className="text-right text-gray-500">{s.totalMatches}</span>
                    <span className={cn('text-right font-semibold', s.wins > 0 ? 'text-green-600' : 'text-gray-400')}>{s.wins}</span>
                    <span className="text-right text-gray-600">{Math.round(s.winRate * 100)}%</span>
                    <span className="text-right text-gray-500">{s.setsWon}/{s.setsWon + s.setsLost}</span>
                    <span className="text-right text-gray-500">{s.ptsFor}</span>
                  </button>

                  {/* Expanded match history */}
                  {isExp && (
                    <div className="px-4 pb-3 space-y-1.5 border-t border-blue-100/60">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2 mb-2">Lịch sử trận đấu</p>
                      {s.matches
                        .sort((a, b) => (b.match_number ?? 0) - (a.match_number ?? 0))
                        .map(m => {
                          const isP1    = m.player1_id === s.id
                          const oppId   = isP1 ? m.player2_id : m.player1_id
                          const opp     = playerMap[oppId] ?? { name: '?' }
                          const won     = m.winner_id === s.id
                          const s1arr   = isP1 ? (m.player1_scores ?? []) : (m.player2_scores ?? [])
                          const s2arr   = isP1 ? (m.player2_scores ?? []) : (m.player1_scores ?? [])
                          const score   = s1arr.map((sv, i) => `${sv}–${s2arr[i] ?? 0}`).join(', ')
                          return (
                            <div key={m.id} className="flex items-center justify-between rounded-lg bg-white border border-gray-100 px-3 py-2 text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={cn('font-bold shrink-0', won ? 'text-green-600' : 'text-red-500')}>
                                  {won ? 'T' : 'B'}
                                </span>
                                <span className="text-gray-600 truncate">vs {opp.name}</span>
                                <span className="text-gray-300">·</span>
                                <span className="text-gray-400 shrink-0">{STAGE_LABELS[m.stage] ?? m.stage}</span>
                              </div>
                              <span className="text-gray-500 font-mono shrink-0 ml-2">{score}</span>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Summary cards */}
        {sorted.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'VĐV thắng nhiều nhất', value: sorted[0]?.player.name, sub: `${sorted[0]?.wins} thắng` },
              { label: 'Tỉ lệ thắng cao nhất', value: [...sorted].sort((a,b) => b.winRate - a.winRate)[0]?.player.name, sub: `${Math.round([...sorted].sort((a,b) => b.winRate - a.winRate)[0]?.winRate * 100)}%` },
              { label: 'Điểm ghi nhiều nhất', value: [...sorted].sort((a,b) => b.ptsFor - a.ptsFor)[0]?.player.name, sub: `${[...sorted].sort((a,b) => b.ptsFor - a.ptsFor)[0]?.ptsFor} điểm` },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                <p className="text-sm font-bold text-gray-900 truncate">{c.value}</p>
                <p className="text-xs text-blue-600 font-medium">{c.sub}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
