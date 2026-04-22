import { supabase } from '@/lib/supabase'

// ── Bracket sizing ──────────────────────────────────────────────────────────
function getBracketSize(n) {
  if (n <= 4)  return 4
  if (n <= 8)  return 8
  if (n <= 16) return 16
  if (n <= 32) return 32
  return 64
}

// All stages in order for each bracket size (first stage = largest round)
const BRACKET_MAIN_STAGES = {
  4:  ['semi', 'final'],
  8:  ['quarter', 'semi', 'final'],
  16: ['round_of_16', 'quarter', 'semi', 'final'],
  32: ['round_of_32', 'round_of_16', 'quarter', 'semi', 'final'],
  64: ['round_of_64', 'round_of_32', 'round_of_16', 'quarter', 'semi', 'final'],
}

// Number of matches per stage
const STAGE_MATCH_COUNT = {
  round_of_64: 32,
  round_of_32: 16,
  round_of_16: 8,
  quarter:     4,
  semi:        2,
  final:       1,
}

/**
 * Standard tournament seeding positions.
 * Returns an array of bracketSize indices (0-based) where adjacent pairs
 * form first-round match pairings.  Top seeds are distributed so they
 * only meet in later rounds.
 *
 * e.g. size=8 → [0,7,3,4,1,6,2,5]
 *   pairs: (seed1 vs seed8), (seed4 vs seed5), (seed2 vs seed7), (seed3 vs seed6)
 */
function buildSeedPositions(size) {
  if (size === 2) return [0, 1]
  const half   = buildSeedPositions(size / 2)
  const result = new Array(size)
  for (let i = 0; i < half.length; i++) {
    result[i * 2]     = half[i]
    result[i * 2 + 1] = size - 1 - half[i]
  }
  return result
}

/**
 * Build bracket match rows (no IDs yet — used before DB insert).
 *
 * Returns { rows: Array, mainStages: string[], bracketSize: number }
 */
export function buildBracketRows(qualifiedPlayers, tournamentId, eventId = null) {
  const n           = qualifiedPlayers.length
  const bracketSize = getBracketSize(n)
  const seeded      = [...qualifiedPlayers].sort((a, b) => a.seed - b.seed)
  const mainStages  = BRACKET_MAIN_STAGES[bracketSize]
  const firstStage  = mainStages[0]

  const makeRow = (stage, matchNum, p1 = null, p2 = null, extra = {}) => ({
    tournament_id:  tournamentId,
    stage,
    match_number:   matchNum,
    player1_id:     p1,
    player2_id:     p2,
    player1_scores: [],
    player2_scores: [],
    status:         'pending',
    ...extra,
    ...(eventId ? { event_id: eventId } : {}),
  })

  // ── First round with seeded pairings ──────────────────────────────────────
  const seedPos         = buildSeedPositions(bracketSize)
  const firstRoundRows  = []

  for (let i = 0; i < bracketSize; i += 2) {
    const matchNum = i / 2 + 1
    const p1       = seeded[seedPos[i]]?.player_id     ?? null
    const p2       = seeded[seedPos[i + 1]]?.player_id ?? null

    // A "bye" match has exactly one player — that player auto-advances
    const isBye      = (p1 !== null && p2 === null) || (p1 === null && p2 !== null)
    const byeWinner  = isBye ? (p1 ?? p2) : null

    firstRoundRows.push(makeRow(
      firstStage, matchNum, p1, p2,
      isBye ? { status: 'completed', winner_id: byeWinner } : {},
    ))
  }

  // ── Later rounds (all TBD) ────────────────────────────────────────────────
  const allRows = [...firstRoundRows]
  for (const stage of mainStages.slice(1)) {
    const count = STAGE_MATCH_COUNT[stage]
    for (let i = 1; i <= count; i++) allRows.push(makeRow(stage, i))
  }

  // Always add third_place match
  allRows.push(makeRow('third_place', 1))

  return { rows: allRows, mainStages, bracketSize }
}

// ── In-flight deduplication ─────────────────────────────────────────────────
const _inFlight = new Map()

/**
 * Save the full knockout bracket to Supabase.
 * Bracket size is determined automatically from qualifiedPlayers.length.
 * Bye matches (odd player counts) are pre-completed so the winner advances.
 */
export function saveKnockoutBracket(qualifiedPlayers, tournamentId, eventId = null) {
  const key = eventId ?? `t:${tournamentId}`
  if (_inFlight.has(key)) return _inFlight.get(key)

  const p = _saveKnockoutBracketInner(qualifiedPlayers, tournamentId, eventId)
    .finally(() => _inFlight.delete(key))
  _inFlight.set(key, p)
  return p
}

async function _saveKnockoutBracketInner(qualifiedPlayers, tournamentId, eventId) {
  // ── Idempotency guard ────────────────────────────────────────────────────
  let idempQ = supabase.from('matches').select('*').neq('stage', 'group').order('match_number')
  idempQ     = eventId
    ? idempQ.eq('event_id', eventId)
    : idempQ.eq('tournament_id', tournamentId)

  const { data: existing, error: existErr } = await idempQ
  if (existErr) throw existErr
  if (existing && existing.length > 0) return existing

  const { rows, mainStages } = buildBracketRows(qualifiedPlayers, tournamentId, eventId)

  // ── Step 1: Insert all matches ────────────────────────────────────────────
  const { data: saved, error: insertErr } = await supabase
    .from('matches').insert(rows).select()
  if (insertErr) throw insertErr

  const byStageNum = (stage, num) =>
    saved.find(m => m.stage === stage && m.match_number === num)

  // ── Step 2: next_match_id / next_match_position links ─────────────────────
  // Pair consecutive stages: every two matches in stage[i] feed one match in stage[i+1]
  const links = []

  for (let si = 0; si < mainStages.length - 2; si++) {
    const curStage  = mainStages[si]
    const nextStage = mainStages[si + 1]
    const curCount  = STAGE_MATCH_COUNT[curStage]

    for (let m = 0; m < curCount; m += 2) {
      const nextMatchNum = m / 2 + 1
      const cur1 = byStageNum(curStage, m + 1)
      const cur2 = byStageNum(curStage, m + 2)
      const nxt  = byStageNum(nextStage, nextMatchNum)
      if (cur1 && cur2 && nxt) {
        links.push([cur1.id, nxt.id, 'player1'])
        links.push([cur2.id, nxt.id, 'player2'])
      }
    }
  }

  // Semi → Final (special: player1/player2 determined by semi match_number)
  const sf1 = byStageNum('semi', 1)
  const sf2 = byStageNum('semi', 2)
  const fin = byStageNum('final', 1)
  if (sf1 && sf2 && fin) {
    links.push([sf1.id, fin.id, 'player1'])
    links.push([sf2.id, fin.id, 'player2'])
  }

  await Promise.all(
    links.map(([id, nextId, pos]) =>
      supabase.from('matches')
        .update({ next_match_id: nextId, next_match_position: pos })
        .eq('id', id)
    )
  )

  // ── Step 3: Advance bye winners to their next match ───────────────────────
  const byeMatches = saved.filter(m => m.status === 'completed' && m.winner_id)

  if (byeMatches.length > 0) {
    const advanceOps = []

    for (const bye of byeMatches) {
      const stageIdx = mainStages.indexOf(bye.stage)
      if (stageIdx < 0 || stageIdx >= mainStages.length - 1) continue

      const nextStage    = mainStages[stageIdx + 1]
      const nextMatchNum = Math.ceil(bye.match_number / 2)
      const nextField    = bye.match_number % 2 === 1 ? 'player1_id' : 'player2_id'
      const nxt          = byStageNum(nextStage, nextMatchNum)

      if (nxt) {
        advanceOps.push(
          supabase.from('matches')
            .update({ [nextField]: bye.winner_id })
            .eq('id', nxt.id)
        )
      }
    }

    if (advanceOps.length > 0) {
      await Promise.all(advanceOps)

      // Re-fetch to return data that reflects bye advancements
      let refetchQ = supabase.from('matches').select('*').neq('stage', 'group').order('match_number')
      refetchQ = eventId
        ? refetchQ.eq('event_id', eventId)
        : refetchQ.eq('tournament_id', tournamentId)
      const { data: refreshed } = await refetchQ
      return refreshed || saved
    }
  }

  return saved
}
