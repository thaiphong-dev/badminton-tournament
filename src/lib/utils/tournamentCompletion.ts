import { supabase } from '@/lib/supabase'

/**
 * After an event is marked completed, check if ALL events in the tournament
 * are also completed. If so, mark the tournament itself as completed.
 *
 * @param {string} tournamentId
 */
export async function checkAndCompleteTournament(tournamentId) {
  const { data: events, error } = await supabase
    .from('events')
    .select('status')
    .eq('tournament_id', tournamentId)

  if (error || !events || events.length === 0) return

  const allDone = events.every(e => e.status === 'completed')
  if (allDone) {
    await supabase
      .from('tournaments')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', tournamentId)
  }
}
