import { supabase } from '@/lib/supabase'
import { checkAndCompleteTournament } from '@/lib/utils/tournamentCompletion'

/**
 * Bracket advancement map – computed from stage + match_number,
 * NOT from next_match_id (which can be stale after bracket repair).
 *
 * R16:  M1,M2 → QF M1   M3,M4 → QF M2   M5,M6 → QF M3   M7,M8 → QF M4
 * QF:   M1,M2 → SF M1   M3,M4 → SF M2
 * SF:   M1,M2 → Final M1   losers → Third Place M1
 */
function getNextMatchInfo(stage, matchNumber) {
  switch (stage) {
    case 'round_of_16':
      return {
        nextStage:    'quarter',
        nextMatchNum: Math.ceil(matchNumber / 2),
        nextField:    matchNumber % 2 === 1 ? 'player1_id' : 'player2_id',
      }
    case 'quarter':
      return {
        nextStage:    'semi',
        nextMatchNum: Math.ceil(matchNumber / 2),
        nextField:    matchNumber % 2 === 1 ? 'player1_id' : 'player2_id',
      }
    case 'semi':
      return {
        nextStage:    'final',
        nextMatchNum: 1,
        nextField:    matchNumber === 1 ? 'player1_id' : 'player2_id',
      }
    default:
      return null
  }
}

/**
 * After a knockout match is completed, advance the winner to the next round.
 * Uses stage+match_number lookup so it works even when next_match_id is stale.
 *
 * @param {Object} completedMatch – Full match row (must include winner_id, stage, match_number, tournament_id, event_id?)
 */
export async function advanceWinner(completedMatch) {
  const { winner_id, player1_id, player2_id, stage, match_number, tournament_id, event_id } = completedMatch

  if (!winner_id) return

  const updates = []

  // Helper: scope a match lookup to event or tournament
  const scopeMatchQ = (q) => event_id
    ? q.eq('event_id', event_id)
    : q.eq('tournament_id', tournament_id)

  // ── Advance winner to next round ─────────────────────────────────────────
  const nextInfo = getNextMatchInfo(stage, match_number)
  if (nextInfo) {
    // Use limit(1) instead of single() — handles duplicate rows from double-inserts gracefully
    const { data: rows } = await scopeMatchQ(
      supabase
        .from('matches')
        .select('id')
        .eq('stage', nextInfo.nextStage)
        .eq('match_number', nextInfo.nextMatchNum)
        .order('id')
        .limit(1)
    )
    const nextMatch = rows?.[0] ?? null

    if (nextMatch) {
      updates.push(
        supabase
          .from('matches')
          .update({ [nextInfo.nextField]: winner_id })
          .eq('id', nextMatch.id)
      )
    }
  }

  // ── Semi-final: loser → third-place match ────────────────────────────────
  if (stage === 'semi') {
    const loser_id  = player1_id === winner_id ? player2_id : player1_id
    const loserField = match_number === 1 ? 'player1_id' : 'player2_id'

    const { data: rows } = await scopeMatchQ(
      supabase
        .from('matches')
        .select('id')
        .eq('stage', 'third_place')
        .eq('match_number', 1)
        .order('id')
        .limit(1)
    )
    const thirdMatch = rows?.[0] ?? null

    if (thirdMatch && loser_id) {
      updates.push(
        supabase
          .from('matches')
          .update({ [loserField]: loser_id })
          .eq('id', thirdMatch.id)
      )
    }
  }

  // ── Final completed: mark event (or legacy tournament) as done ───────────
  if (stage === 'final') {
    if (event_id) {
      // Per-event flow: mark event completed with timestamp
      updates.push(
        supabase
          .from('events')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', event_id)
      )
    } else {
      // Legacy flow: mark tournament directly
      updates.push(
        supabase
          .from('tournaments')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', tournament_id)
      )
    }
  }

  await Promise.all(updates)

  // ── After event completes, check if whole tournament is done ─────────────
  if (stage === 'final' && event_id) {
    await checkAndCompleteTournament(tournament_id)
  }
}

/**
 * Re-apply winner advancements for all completed matches in a bracket.
 * Call this on page load to repair any QF/SF/Final slots that were missed
 * (e.g. after deduplication of a double-generated bracket).
 *
 * @param {Array}  matches      – all knockout matches for the tournament/event
 * @param {string} tournamentId
 * @param {string} [eventId]   – Optional: scope to this event
 */
export async function repairBracketLinks(matches, tournamentId, eventId = null) {
  // Process in round order so earlier rounds fill before later ones check
  const STAGE_ORDER = ['round_of_16', 'quarter', 'semi']
  const completed = STAGE_ORDER
    .flatMap(stage =>
      matches.filter(m => m.stage === stage && m.status === 'completed' && m.winner_id)
    )

  if (completed.length === 0) return

  // Run sequentially per stage to avoid race conditions writing to the same slot
  for (const match of completed) {
    await advanceWinner({ ...match, tournament_id: tournamentId, event_id: eventId ?? match.event_id ?? null })
  }
}
