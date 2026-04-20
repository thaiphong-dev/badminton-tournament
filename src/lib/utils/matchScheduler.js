import { supabase } from '@/lib/supabase'

/**
 * Generate round-robin matches for a group using the circle method.
 * @param {Array} players - Player objects with at least an `id` field
 * @returns {Array} [{round, player1_id, player2_id}, ...]
 */
export function generateRoundRobinMatches(players) {
  const n = players.length
  if (n < 2) return []

  const hasBye = n % 2 === 1
  const participants = hasBye
    ? [...players, { id: 'bye' }]
    : [...players]
  const total = participants.length
  const numRounds = total - 1
  const matches = []

  for (let round = 0; round < numRounds; round++) {
    for (let i = 0; i < total / 2; i++) {
      // Circle method: fix last slot, rotate the rest
      const home = i === 0 ? total - 1 : (round + i) % (total - 1)
      const away = (round + total - 1 - i) % (total - 1)

      const p1 = participants[home]
      const p2 = participants[away]

      if (p1.id !== 'bye' && p2.id !== 'bye') {
        matches.push({ round: round + 1, player1_id: p1.id, player2_id: p2.id })
      }
    }
  }

  return matches
}

/**
 * Save groups + group_players + round-robin matches for all groups to Supabase.
 * Returns the inserted group records.
 *
 * @param {Array}  localGroups  - Array of player arrays from randomizeGroups()
 * @param {string} tournamentId
 * @returns {Array} savedGroups - Inserted group rows from DB
 */
export async function saveGroupsAndMatches(localGroups, tournamentId) {
  // ── 1. Insert groups ────────────────────────────────────────────────────────
  const groupsToInsert = localGroups.map((_, idx) => ({
    tournament_id: tournamentId,
    group_number: idx + 1,
    name: `Bảng ${String.fromCharCode(65 + idx)}`, // A, B, C …
  }))

  const { data: savedGroups, error: groupErr } = await supabase
    .from('groups')
    .insert(groupsToInsert)
    .select()

  if (groupErr) throw groupErr

  // Sort by group_number so index matches localGroups index
  savedGroups.sort((a, b) => a.group_number - b.group_number)

  // ── 2. Insert group_players ─────────────────────────────────────────────────
  const groupPlayers = savedGroups.flatMap((group, idx) =>
    localGroups[idx].map(player => ({
      group_id: group.id,
      player_id: player.id,
    }))
  )

  const { error: gpErr } = await supabase.from('group_players').insert(groupPlayers)
  if (gpErr) throw gpErr

  // ── 3. Generate and insert round-robin matches ──────────────────────────────
  let globalMatchNum = 1
  const matchesToInsert = savedGroups.flatMap((group, idx) => {
    const players = localGroups[idx]
    const roundRobin = generateRoundRobinMatches(players)

    return roundRobin.map(m => ({
      tournament_id: tournamentId,
      stage: 'group',
      group_id: group.id,
      round_number: m.round,
      match_number: globalMatchNum++,
      player1_id: m.player1_id,
      player2_id: m.player2_id,
      status: 'pending',
      player1_scores: [],
      player2_scores: [],
    }))
  })

  const { error: matchErr } = await supabase.from('matches').insert(matchesToInsert)
  if (matchErr) throw matchErr

  // ── 4. Update tournament status to group_stage ──────────────────────────────
  const { error: tErr } = await supabase
    .from('tournaments')
    .update({ status: 'group_stage' })
    .eq('id', tournamentId)

  if (tErr) throw tErr

  return savedGroups
}
