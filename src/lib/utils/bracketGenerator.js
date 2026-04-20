import { supabase } from '@/lib/supabase'

/**
 * Seeding pairs for Round of 16 (index into sorted-by-seed array)
 *
 *  Match 1: Seed  1 vs 16   Match 5: Seed  2 vs 15
 *  Match 2: Seed  8 vs  9   Match 6: Seed  7 vs 10
 *  Match 3: Seed  4 vs 13   Match 7: Seed  3 vs 14
 *  Match 4: Seed  5 vs 12   Match 8: Seed  6 vs 11
 *
 * Winners flow:
 *   M1,M2 → QF1   M3,M4 → QF2   M5,M6 → QF3   M7,M8 → QF4
 *   QF1,QF2 → SF1   QF3,QF4 → SF2
 *   SF1,SF2 → Final     SF losers → Third Place
 */
const R16_PAIRINGS = [
  [0, 15], [7, 8],  [3, 12], [4, 11],
  [1, 14], [6, 9],  [2, 13], [5, 10],
]

/**
 * Build bracket match rows (no IDs yet — used before DB insert).
 */
export function buildBracketRows(qualifiedPlayers, tournamentId) {
  const seeded = [...qualifiedPlayers].sort((a, b) => a.seed - b.seed)

  const base = (stage, matchNum, p1 = null, p2 = null) => ({
    tournament_id: tournamentId,
    stage,
    match_number: matchNum,
    player1_id: p1,
    player2_id: p2,
    player1_scores: [],
    player2_scores: [],
    status: 'pending',
  })

  const round16 = R16_PAIRINGS.map(([i1, i2], n) =>
    base('round_of_16', n + 1, seeded[i1]?.player_id ?? null, seeded[i2]?.player_id ?? null)
  )
  const quarters    = Array.from({ length: 4 }, (_, i) => base('quarter',     i + 1))
  const semis       = Array.from({ length: 2 }, (_, i) => base('semi',        i + 1))
  const final       = base('final',       1)
  const thirdPlace  = base('third_place', 1)

  return { round16, quarters, semis, final, thirdPlace }
}

/**
 * Save the full knockout bracket to Supabase in two steps:
 *  1. Insert all 16 matches → get IDs
 *  2. Update next_match_id / next_match_position links
 *
 * @param {Array}  qualifiedPlayers  - from getQualifiedPlayers()
 * @param {string} tournamentId
 * @returns {Array} All saved match rows (with IDs)
 */
export async function saveKnockoutBracket(qualifiedPlayers, tournamentId) {
  // ── Idempotency guard: return existing bracket if already generated ────────
  const { data: existing, error: existErr } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .neq('stage', 'group')
    .order('match_number')

  if (existErr) throw existErr
  if (existing && existing.length > 0) return existing

  const { round16, quarters, semis, final, thirdPlace } = buildBracketRows(qualifiedPlayers, tournamentId)

  // ── Step 1: Insert all matches ────────────────────────────────────────────
  const allRows = [...round16, ...quarters, ...semis, final, thirdPlace]

  const { data: saved, error: insertErr } = await supabase
    .from('matches')
    .insert(allRows)
    .select()

  if (insertErr) throw insertErr

  // Sort saved rows back into bracket order by stage + match_number
  const byStageNum = (stage, num) =>
    saved.find(m => m.stage === stage && m.match_number === num)

  const r16   = Array.from({ length: 8 }, (_, i) => byStageNum('round_of_16', i + 1))
  const qf    = Array.from({ length: 4 }, (_, i) => byStageNum('quarter',     i + 1))
  const sf    = Array.from({ length: 2 }, (_, i) => byStageNum('semi',        i + 1))
  const fin   = byStageNum('final',       1)
  const third = byStageNum('third_place', 1)

  // ── Step 2: Build next_match_id link table ────────────────────────────────
  // [matchId, nextMatchId, nextMatchPosition]
  const links = [
    // R16 → QF
    [r16[0].id, qf[0].id, 'player1'], [r16[1].id, qf[0].id, 'player2'],
    [r16[2].id, qf[1].id, 'player1'], [r16[3].id, qf[1].id, 'player2'],
    [r16[4].id, qf[2].id, 'player1'], [r16[5].id, qf[2].id, 'player2'],
    [r16[6].id, qf[3].id, 'player1'], [r16[7].id, qf[3].id, 'player2'],
    // QF → SF
    [qf[0].id, sf[0].id, 'player1'], [qf[1].id, sf[0].id, 'player2'],
    [qf[2].id, sf[1].id, 'player1'], [qf[3].id, sf[1].id, 'player2'],
    // SF → Final  (SF losers → 3rd Place handled by advanceWinner)
    [sf[0].id, fin.id, 'player1'],
    [sf[1].id, fin.id, 'player2'],
  ]

  await Promise.all(
    links.map(([id, nextId, pos]) =>
      supabase
        .from('matches')
        .update({ next_match_id: nextId, next_match_position: pos })
        .eq('id', id)
    )
  )

  return saved
}
