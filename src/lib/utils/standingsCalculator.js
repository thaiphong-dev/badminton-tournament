import { supabase } from '@/lib/supabase'

/**
 * Calculate group standings from match results.
 *
 * Sort order (BWF-aligned):
 *   1. Wins
 *   2. Head-to-head results among tied players (mini-standings)
 *   3. Sets difference  (hiệu số hiệp)
 *   4. Points difference (hiệu số điểm)
 *
 * @param {Array} matches - All matches in the group (any status)
 * @param {Array} players - Players in the group {id, name, club}
 * @returns {Array} Sorted standings with ranks assigned
 */
export function calculateStandings(matches, players) {
  const completedMatches = matches.filter(m => m.status === 'completed' && m.winner_id)

  // Build stats map keyed by player id
  const statsMap = Object.fromEntries(players.map(p => [p.id, {
    player_id:    p.id,
    player_name:  p.name,
    club:         p.club,
    points:       0,
    wins:         0,
    losses:       0,
    sets_for:     0,
    sets_against: 0,
    score_for:    0,
    score_against: 0,
  }]))

  completedMatches.forEach(match => {
    const p1 = statsMap[match.player1_id]
    const p2 = statsMap[match.player2_id]
    if (!p1 || !p2) return

    const s1arr = Array.isArray(match.player1_scores)
      ? match.player1_scores : JSON.parse(match.player1_scores || '[]')
    const s2arr = Array.isArray(match.player2_scores)
      ? match.player2_scores : JSON.parse(match.player2_scores || '[]')

    // Accumulate points and sets set-by-set
    s1arr.forEach((s1, idx) => {
      const s2 = s2arr[idx] ?? 0
      p1.score_for += s1; p1.score_against += s2
      p2.score_for += s2; p2.score_against += s1
      if (s1 > s2)      { p1.sets_for++; p2.sets_against++ }
      else if (s2 > s1) { p2.sets_for++; p1.sets_against++ }
    })

    const winner = statsMap[match.winner_id]
    const loserId = match.player1_id === match.winner_id ? match.player2_id : match.player1_id
    const loser   = statsMap[loserId]
    if (winner) { winner.wins++; winner.points += 2 }
    if (loser)  { loser.losses++ }
  })

  const standings = Object.values(statsMap).map(s => ({
    ...s,
    sets_diff:  s.sets_for  - s.sets_against,
    score_diff: s.score_for - s.score_against,
  }))

  // Sort using wins → head-to-head → sets_diff → score_diff
  const sorted = resolveStandings(standings, completedMatches)
  sorted.forEach((s, idx) => { s.rank = idx + 1 })
  return sorted
}

/**
 * Group players by wins, then resolve ties within each group.
 */
function resolveStandings(standings, completedMatches) {
  const byWins = new Map()
  standings.forEach(s => {
    if (!byWins.has(s.wins)) byWins.set(s.wins, [])
    byWins.get(s.wins).push(s)
  })

  const result = []
  ;[...byWins.keys()].sort((a, b) => b - a).forEach(wins => {
    result.push(...resolveGroup(byWins.get(wins), completedMatches))
  })
  return result
}

/**
 * Resolve ordering within a group of equally-won players.
 * Uses head-to-head mini-standings, then falls back to overall sets/score diffs.
 */
function resolveGroup(group, completedMatches) {
  if (group.length === 1) return group

  const tiedIds   = new Set(group.map(s => s.player_id))
  const h2hMatches = completedMatches.filter(m =>
    tiedIds.has(m.player1_id) && tiedIds.has(m.player2_id)
  )

  // Mini head-to-head stats — only matches between the tied players
  const mini = Object.fromEntries(
    group.map(s => [s.player_id, { wins: 0, sets_diff: 0, score_diff: 0 }])
  )

  h2hMatches.forEach(m => {
    const s1arr = Array.isArray(m.player1_scores) ? m.player1_scores : JSON.parse(m.player1_scores || '[]')
    const s2arr = Array.isArray(m.player2_scores) ? m.player2_scores : JSON.parse(m.player2_scores || '[]')
    const p1m = mini[m.player1_id]
    const p2m = mini[m.player2_id]

    s1arr.forEach((s1, idx) => {
      const s2 = s2arr[idx] ?? 0
      if (p1m) p1m.score_diff += s1 - s2
      if (p2m) p2m.score_diff += s2 - s1
      if (s1 > s2)      { if (p1m) p1m.sets_diff++; if (p2m) p2m.sets_diff-- }
      else if (s2 > s1) { if (p2m) p2m.sets_diff++; if (p1m) p1m.sets_diff-- }
    })
    if (m.winner_id && mini[m.winner_id]) mini[m.winner_id].wins++
  })

  return [...group].sort((a, b) => {
    const am = mini[a.player_id]
    const bm = mini[b.player_id]
    // 1. Head-to-head wins
    if (bm.wins !== am.wins)             return bm.wins       - am.wins
    // 2. Head-to-head sets diff
    if (bm.sets_diff !== am.sets_diff)   return bm.sets_diff  - am.sets_diff
    // 3. Head-to-head score diff
    if (bm.score_diff !== am.score_diff) return bm.score_diff - am.score_diff
    // 4. Overall sets diff
    if (b.sets_diff !== a.sets_diff)     return b.sets_diff   - a.sets_diff
    // 5. Overall score diff
    return b.score_diff - a.score_diff
  })
}

/**
 * Validate match scores based on scoring config.
 *
 * @param scores1       - player 1 scores array
 * @param scores2       - player 2 scores array
 * @param stage         - match stage key (used as legacy fallback only)
 * @param opts          - optional { isBestOf3: boolean, pointsPerSet: number } from event config
 */
export function validateMatchScores(scores1, scores2, stage, opts = {}) {
  const isBestOf3   = opts.isBestOf3   ?? ['semi', 'final', 'third_place'].includes(stage)
  const pointsPerSet = opts.pointsPerSet ?? (isBestOf3 ? 15 : 21)

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
          points:       s.points,
          wins:         s.wins,
          losses:       s.losses,
          sets_for:     s.sets_for,
          sets_against: s.sets_against,
          sets_diff:    s.sets_diff,
          score_for:    s.score_for,
          score_against: s.score_against,
          score_diff:   s.score_diff,
          rank:         s.rank,
        })
        .eq('id', gp.id)
    })
  )

  return standings
}
