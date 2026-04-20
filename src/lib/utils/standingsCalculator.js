import { supabase } from '@/lib/supabase'

/**
 * Calculate group standings from match results.
 * @param {Array} matches - All matches in the group (any status)
 * @param {Array} players - Players in the group {id, name, club}
 * @returns {Array} Sorted standings with ranks assigned
 */
export function calculateStandings(matches, players) {
  const standings = players.map(player => ({
    player_id: player.id,
    player_name: player.name,
    club: player.club,
    points: 0,
    wins: 0,
    losses: 0,
    score_for: 0,
    score_against: 0,
    score_diff: 0,
  }))

  matches
    .filter(m => m.status === 'completed' && m.winner_id)
    .forEach(match => {
      const winner = standings.find(s => s.player_id === match.winner_id)
      const loserId = match.player1_id === match.winner_id
        ? match.player2_id
        : match.player1_id
      const loser = standings.find(s => s.player_id === loserId)

      if (!winner || !loser) return

      const scores1 = Array.isArray(match.player1_scores)
        ? match.player1_scores
        : JSON.parse(match.player1_scores || '[]')
      const scores2 = Array.isArray(match.player2_scores)
        ? match.player2_scores
        : JSON.parse(match.player2_scores || '[]')

      const p1 = standings.find(s => s.player_id === match.player1_id)
      const p2 = standings.find(s => s.player_id === match.player2_id)

      // Accumulate scores set by set
      scores1.forEach((s1, idx) => {
        const s2 = scores2[idx] ?? 0
        if (p1) { p1.score_for += s1; p1.score_against += s2 }
        if (p2) { p2.score_for += s2; p2.score_against += s1 }
      })

      winner.wins += 1
      winner.points += 2
      loser.losses += 1
    })

  standings.forEach(s => { s.score_diff = s.score_for - s.score_against })

  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.wins !== a.wins) return b.wins - a.wins
    return b.score_diff - a.score_diff
  })

  standings.forEach((s, idx) => { s.rank = idx + 1 })

  return standings
}

/**
 * Validate match scores based on stage rules.
 * Group / R16 / Quarter: 1 set × 21 pts
 * Semi / Final:          best-of-3 × 15 pts
 */
export function validateMatchScores(scores1, scores2, stage) {
  const isBestOf3 = ['semi', 'final'].includes(stage)
  const pointsPerSet = isBestOf3 ? 15 : 21

  if (!isBestOf3) {
    const [s1, s2] = [scores1[0] ?? 0, scores2[0] ?? 0]
    if (s1 < pointsPerSet && s2 < pointsPerSet)
      return { valid: false, error: `Phải có người đạt ${pointsPerSet} điểm` }
    if (s1 === s2)
      return { valid: false, error: 'Hai người không thể hòa nhau' }
    return { valid: true, winner: s1 > s2 ? 1 : 2 }
  }

  if (scores1.length < 2 || scores1.length > 3)
    return { valid: false, error: 'Phải có 2 hoặc 3 set' }

  let wins1 = 0, wins2 = 0
  for (let i = 0; i < scores1.length; i++) {
    const [s1, s2] = [scores1[i] ?? 0, scores2[i] ?? 0]
    if (s1 < pointsPerSet && s2 < pointsPerSet)
      return { valid: false, error: `Set ${i + 1}: phải có người đạt ${pointsPerSet}` }
    if (s1 > s2) wins1++; else wins2++
  }
  if (wins1 < 2 && wins2 < 2)
    return { valid: false, error: 'Chưa có người thắng 2 set' }

  return { valid: true, winner: wins1 > wins2 ? 1 : 2 }
}

/**
 * Recalculate standings for a group and persist to group_players table.
 * @param {string} groupId
 * @returns {Array} Updated standings
 */
export async function updateGroupStandingsInDB(groupId) {
  // Fetch latest match results
  const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select('*')
    .eq('group_id', groupId)

  if (mErr) throw mErr

  // Fetch group players with player info
  const { data: groupPlayers, error: gpErr } = await supabase
    .from('group_players')
    .select('id, player_id, players(id, name, club)')
    .eq('group_id', groupId)

  if (gpErr) throw gpErr

  const players = groupPlayers.map(gp => gp.players).filter(Boolean)
  const standings = calculateStandings(matches, players)

  // Update each group_player row in parallel
  await Promise.all(
    standings.map(s => {
      const gp = groupPlayers.find(g => g.player_id === s.player_id)
      if (!gp) return Promise.resolve()
      return supabase
        .from('group_players')
        .update({
          points: s.points,
          wins: s.wins,
          losses: s.losses,
          score_for: s.score_for,
          score_against: s.score_against,
          score_diff: s.score_diff,
          rank: s.rank,
        })
        .eq('id', gp.id)
    })
  )

  return standings
}
