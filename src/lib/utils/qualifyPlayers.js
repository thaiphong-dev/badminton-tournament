import { supabase } from '@/lib/supabase'

/**
 * Select qualified players for the knockout stage.
 *
 * Logic:
 *  - Take all rank-1 players (one per group) → numFirst players
 *  - From rank-2 players, sort by points → wins → score_diff DESC and take top numSecond
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
      score_for:    gp.score_for,
      score_against: gp.score_against,
      score_diff:   gp.score_diff,
      group_number: g.group_number,
      group_id:     g.id,
    }))
  )

  // ── First-place players ────────────────────────────────────────────────────
  const firstPlace = allRecords
    .filter(r => r.rank === 1)
    .sort((a, b) => a.group_number - b.group_number)   // order by group

  // ── Second-place players (best numSecond) ─────────────────────────────────
  const secondPlace = allRecords
    .filter(r => r.rank === 2)
    .sort((a, b) => {
      if (b.points     !== a.points)     return b.points     - a.points
      if (b.wins       !== a.wins)       return b.wins       - a.wins
      return b.score_diff - a.score_diff
    })
    .slice(0, numSecond)

  // ── Assign seeds ──────────────────────────────────────────────────────────
  const qualified = [
    ...firstPlace.map(p => ({ ...p, seed: p.group_number, qualified_as: 'Nhất bảng' })),
    ...secondPlace.map((p, i) => ({ ...p, seed: numFirst + i + 1, qualified_as: 'Nhì bảng' })),
  ]

  return qualified
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
