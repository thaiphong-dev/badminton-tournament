import { supabase } from '@/lib/supabase'

/**
 * Pure function: select qualified players from flattened group records.
 * Extracted for testability — called by getQualifiedPlayers after DB fetch.
 *
 * @param {Array}  allRecords - flat list of {player_id, rank, wins, losses, sets_for, sets_against, score_for, score_against, score_diff, group_number}
 * @param {number} numFirst   - how many rank-1 players to take
 * @param {number} numSecond  - how many best rank-2 players to take
 * @returns {Array} qualified players with seed assigned
 */
export function selectQualifiedPlayers(allRecords, numFirst, numSecond) {
  const firstPlace = allRecords
    .filter(r => r.rank === 1)
    .sort((a, b) => a.group_number - b.group_number)

  const secondPlace = allRecords
    .filter(r => r.rank === 2)
    .map(r => {
      const matchesPlayed = r.wins + r.losses
      return {
        ...r,
        win_rate:        matchesPlayed > 0 ? r.wins / matchesPlayed : 0,
        sets_ratio:      (r.sets_for + r.sets_against) > 0
                           ? r.sets_for / (r.sets_for + r.sets_against)
                           : 0,
        score_ratio:     (r.score_for + r.score_against) > 0
                           ? r.score_for / (r.score_for + r.score_against)
                           : 0,
        score_diff_rate: matchesPlayed > 0 ? r.score_diff / matchesPlayed : 0,
      }
    })
    .sort((a, b) => {
      if (b.win_rate        !== a.win_rate)        return b.win_rate        - a.win_rate
      if (b.sets_ratio      !== a.sets_ratio)      return b.sets_ratio      - a.sets_ratio
      if (b.score_ratio     !== a.score_ratio)     return b.score_ratio     - a.score_ratio
      return b.score_diff_rate - a.score_diff_rate
    })
    .slice(0, numSecond)

  return [
    ...firstPlace.map(p => ({ ...p, seed: p.group_number, qualified_as: 'Nhất bảng' })),
    ...secondPlace.map((p, i) => ({ ...p, seed: numFirst + i + 1, qualified_as: 'Nhì bảng' })),
  ]
}

/**
 * Select qualified players for the knockout stage.
 *
 * Logic:
 *  - Take all rank-1 players (one per group) → numFirst players
 *  - From rank-2 players, sort by win_rate → sets_ratio → score_ratio DESC and take top numSecond
 *  - Assign seeds: first-place seeds = group_number (1-N), second-place seeds = N+1 to N+numSecond
 *
 * @param {string} tournamentId
 * @param {number} numFirst   - default 12
 * @param {number} numSecond  - default 4
 * @param {string} [eventId]  - optional: scope to this event
 * @returns {Array} qualified players sorted by seed
 */
export async function getQualifiedPlayers(tournamentId, numFirst = 12, numSecond = 4, eventId) {
  // Build group query — scope by event when available
  let query = supabase
    .from('groups')
    .select(`
      id,
      group_number,
      group_players (
        rank,
        points,
        wins,
        losses,
        sets_for,
        sets_against,
        score_for,
        score_against,
        score_diff,
        players ( id, name, club )
      )
    `)
    .order('group_number')

  if (eventId) {
    query = query.eq('event_id', eventId)
  } else {
    query = query.eq('tournament_id', tournamentId)
  }

  const { data: groups, error } = await query
  if (error) throw error

  // Flatten: one record per group-player pair
  const allRecords = groups.flatMap(g =>
    (g.group_players || []).map(gp => ({
      player_id:    gp.players.id,
      player_name:  gp.players.name,
      club:         gp.players.club,
      rank:         gp.rank,
      points:       gp.points,
      wins:         gp.wins,
      losses:       gp.losses,
      sets_for:     gp.sets_for,
      sets_against: gp.sets_against,
      score_for:    gp.score_for,
      score_against: gp.score_against,
      score_diff:   gp.score_diff,
      group_number: g.group_number,
      group_id:     g.id,
    }))
  )

  return selectQualifiedPlayers(allRecords, numFirst, numSecond)
}

/**
 * Confirm qualification: update status to 'knockout'.
 * Per-event flow: updates events table.
 * Legacy flow: updates tournaments table.
 *
 * @param {string} tournamentId
 * @param {string} [eventId]
 */
export async function confirmQualification(tournamentId, eventId) {
  if (eventId) {
    const { error } = await supabase
      .from('events')
      .update({ status: 'knockout' })
      .eq('id', eventId)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('tournaments')
      .update({ status: 'knockout' })
      .eq('id', tournamentId)
    if (error) throw error
  }
}
