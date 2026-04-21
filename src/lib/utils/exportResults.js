import * as XLSX from 'xlsx'
import { DISCIPLINE_LABELS } from '@/lib/constants'

const STAGE_LABELS = {
  round_of_16: 'Vòng 1/8',
  quarter:     'Tứ kết',
  semi:        'Bán kết',
  final:       'Chung kết',
  third_place: 'Tranh hạng 3',
}

const STAGE_ORDER = ['round_of_16', 'quarter', 'semi', 'final', 'third_place']

/**
 * Export a single event's results to Excel.
 *
 * @param {Object}      tournament
 * @param {Array}       players
 * @param {Array}       knockoutMatches
 * @param {Object|null} rankings   – { first, second, third, fourth }
 * @param {Object|null} event      – event row (optional; used for sheet name & filename)
 */
export function exportTournamentResults(tournament, players, knockoutMatches, rankings, event = null) {
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]))
  const wb = XLSX.utils.book_new()

  const eventLabel = event ? (DISCIPLINE_LABELS[event.discipline] ?? event.name) : null

  // ── Sheet 1: Rankings ──────────────────────────────────────────────────────
  const rankRows = [
    eventLabel ? [`Xếp hạng – ${eventLabel}`] : [`Xếp hạng – ${tournament.name}`],
    [],
    ['Hạng', 'Tên VĐV', 'CLB'],
    [1, rankings?.first?.name  ?? '–', rankings?.first?.club  ?? ''],
    [2, rankings?.second?.name ?? '–', rankings?.second?.club ?? ''],
    [3, rankings?.third?.name  ?? '–', rankings?.third?.club  ?? ''],
    [4, rankings?.fourth?.name ?? '–', rankings?.fourth?.club ?? ''],
  ]
  const wsRank = XLSX.utils.aoa_to_sheet(rankRows)
  wsRank['!cols'] = [{ wch: 6 }, { wch: 30 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsRank, 'Xếp hạng')

  // ── Sheet 2: Knockout results ──────────────────────────────────────────────
  const matchRows = [['Vòng', 'Trận', 'VĐV 1', 'Kết quả', 'VĐV 2', 'Người thắng']]

  STAGE_ORDER.forEach(stage => {
    const stageMatches = knockoutMatches
      .filter(m => m.stage === stage)
      .sort((a, b) => a.match_number - b.match_number)

    stageMatches.forEach(m => {
      const p1    = playerMap[m.player1_id]?.name ?? 'TBD'
      const p2    = playerMap[m.player2_id]?.name ?? 'TBD'
      const s1    = Array.isArray(m.player1_scores) ? m.player1_scores : []
      const s2    = Array.isArray(m.player2_scores) ? m.player2_scores : []
      const score = s1.length > 0 ? s1.map((v, i) => `${v}-${s2[i] ?? 0}`).join(', ') : '–'
      const winner = m.winner_id ? (playerMap[m.winner_id]?.name ?? '?') : '–'
      matchRows.push([STAGE_LABELS[stage] ?? stage, m.match_number, p1, score, p2, winner])
    })

    if (stageMatches.length > 0) matchRows.push(['', '', '', '', '', ''])
  })

  const wsMatches = XLSX.utils.aoa_to_sheet(matchRows)
  wsMatches['!cols'] = [{ wch: 16 }, { wch: 5 }, { wch: 28 }, { wch: 16 }, { wch: 28 }, { wch: 28 }]
  XLSX.utils.book_append_sheet(wb, wsMatches, 'Kết quả Knockout')

  // ── Download ───────────────────────────────────────────────────────────────
  const safeTournament = tournament.name.replace(/[\\/:*?"<>|]/g, '_')
  const safeEvent      = eventLabel ? `_${eventLabel.replace(/[\\/:*?"<>|]/g, '_')}` : ''
  XLSX.writeFile(wb, `${safeTournament}${safeEvent}_ketqua.xlsx`)
}

/**
 * Export all events' results to a multi-sheet Excel workbook.
 *
 * @param {Object} tournament
 * @param {Array}  eventsData  – [{ event, rankings, players, matches }]
 */
export function exportTournamentSummary(tournament, eventsData) {
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Overview table ────────────────────────────────────────────────
  const overviewRows = [
    [`${tournament.name} – Kết quả chung cuộc`],
    [],
    ['Nội dung', 'Vô địch 🥇', 'CLB', 'Á quân 🥈', 'CLB', 'Hạng 3 🥉', 'CLB'],
  ]

  for (const { event, rankings } of eventsData) {
    const label = DISCIPLINE_LABELS[event.discipline] ?? event.name
    overviewRows.push([
      label,
      rankings?.first?.name  ?? '–', rankings?.first?.club  ?? '',
      rankings?.second?.name ?? '–', rankings?.second?.club ?? '',
      rankings?.third?.name  ?? '–', rankings?.third?.club  ?? '',
    ])
  }

  const wsOverview = XLSX.utils.aoa_to_sheet(overviewRows)
  wsOverview['!cols'] = [
    { wch: 16 }, { wch: 28 }, { wch: 18 },
    { wch: 28 }, { wch: 18 }, { wch: 28 }, { wch: 18 },
  ]
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Tổng quan')

  // ── Per-event sheets ───────────────────────────────────────────────────────
  for (const { event, rankings, players, matches } of eventsData) {
    const label     = DISCIPLINE_LABELS[event.discipline] ?? event.name
    const sheetName = label.slice(0, 31)  // Excel max 31 chars per sheet name
    const playerMap = Object.fromEntries(players.map(p => [p.id, p]))

    const rows = [
      [`Xếp hạng – ${label}`],
      [],
      ['Hạng', 'Tên VĐV', 'CLB'],
      [1, rankings?.first?.name  ?? '–', rankings?.first?.club  ?? ''],
      [2, rankings?.second?.name ?? '–', rankings?.second?.club ?? ''],
      [3, rankings?.third?.name  ?? '–', rankings?.third?.club  ?? ''],
      [4, rankings?.fourth?.name ?? '–', rankings?.fourth?.club ?? ''],
      [],
      ['Kết quả Knockout'],
      ['Vòng', 'Trận', 'VĐV 1', 'Kết quả', 'VĐV 2', 'Người thắng'],
    ]

    STAGE_ORDER.forEach(stage => {
      const stageMatches = matches
        .filter(m => m.stage === stage)
        .sort((a, b) => a.match_number - b.match_number)

      stageMatches.forEach(m => {
        const p1    = playerMap[m.player1_id]?.name ?? 'TBD'
        const p2    = playerMap[m.player2_id]?.name ?? 'TBD'
        const s1    = Array.isArray(m.player1_scores) ? m.player1_scores : []
        const s2    = Array.isArray(m.player2_scores) ? m.player2_scores : []
        const score = s1.length > 0 ? s1.map((v, i) => `${v}-${s2[i] ?? 0}`).join(', ') : '–'
        const winner = m.winner_id ? (playerMap[m.winner_id]?.name ?? '?') : '–'
        rows.push([STAGE_LABELS[stage] ?? stage, m.match_number, p1, score, p2, winner])
      })

      if (stageMatches.length > 0) rows.push([])
    })

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 16 }, { wch: 5 }, { wch: 28 }, { wch: 16 }, { wch: 28 }, { wch: 28 }]
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

  // ── Download ───────────────────────────────────────────────────────────────
  const safeName = tournament.name.replace(/[\\/:*?"<>|]/g, '_')
  XLSX.writeFile(wb, `${safeName}_tongket.xlsx`)
}
