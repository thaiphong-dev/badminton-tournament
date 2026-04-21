import * as XLSX from 'xlsx'

const STAGE_LABELS = {
  round_of_16: 'Vòng 1/8',
  quarter:     'Tứ kết',
  semi:        'Bán kết',
  final:       'Chung kết',
  third_place: 'Tranh hạng 3',
}

const STAGE_ORDER = ['round_of_16', 'quarter', 'semi', 'final', 'third_place']

/**
 * Export tournament results to an Excel workbook (.xlsx).
 * Sheets:
 *   1. "Xếp hạng"       – Top-4 podium
 *   2. "Kết quả Knockout" – All knockout match results by round
 *
 * @param {Object} tournament
 * @param {Array}  players
 * @param {Array}  knockoutMatches
 * @param {Object|null} rankings   – { first, second, third, fourth }
 */
export function exportTournamentResults(tournament, players, knockoutMatches, rankings) {
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]))
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Rankings ────────────────────────────────────────────────────
  const rankRows = [
    ['Hạng', 'Tên VĐV', 'CLB'],
    [1, rankings?.first?.name  ?? '–', rankings?.first?.club  ?? ''],
    [2, rankings?.second?.name ?? '–', rankings?.second?.club ?? ''],
    [3, rankings?.third?.name  ?? '–', rankings?.third?.club  ?? ''],
    [4, rankings?.fourth?.name ?? '–', rankings?.fourth?.club ?? ''],
  ]
  const wsRank = XLSX.utils.aoa_to_sheet(rankRows)
  wsRank['!cols'] = [{ wch: 6 }, { wch: 30 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsRank, 'Xếp hạng')

  // ── Sheet 2: Knockout results ────────────────────────────────────────────
  const matchRows = [['Vòng', 'Trận', 'VĐV 1', 'Kết quả', 'VĐV 2', 'Người thắng']]

  STAGE_ORDER.forEach(stage => {
    const stageMatches = knockoutMatches
      .filter(m => m.stage === stage)
      .sort((a, b) => a.match_number - b.match_number)

    stageMatches.forEach(m => {
      const p1     = playerMap[m.player1_id]?.name ?? 'TBD'
      const p2     = playerMap[m.player2_id]?.name ?? 'TBD'
      const s1     = Array.isArray(m.player1_scores) ? m.player1_scores : []
      const s2     = Array.isArray(m.player2_scores) ? m.player2_scores : []
      const score  = s1.length > 0 ? s1.map((v, i) => `${v}-${s2[i] ?? 0}`).join(', ') : '–'
      const winner = m.winner_id ? (playerMap[m.winner_id]?.name ?? '?') : '–'
      matchRows.push([STAGE_LABELS[stage] ?? stage, m.match_number, p1, score, p2, winner])
    })

    // Blank separator row between stages
    if (stageMatches.length > 0) matchRows.push(['', '', '', '', '', ''])
  })

  const wsMatches = XLSX.utils.aoa_to_sheet(matchRows)
  wsMatches['!cols'] = [{ wch: 16 }, { wch: 5 }, { wch: 28 }, { wch: 16 }, { wch: 28 }, { wch: 28 }]
  XLSX.utils.book_append_sheet(wb, wsMatches, 'Kết quả Knockout')

  // ── Download ─────────────────────────────────────────────────────────────
  const safeName = tournament.name.replace(/[\\/:*?"<>|]/g, '_')
  XLSX.writeFile(wb, `${safeName}_ketqua.xlsx`)
}
