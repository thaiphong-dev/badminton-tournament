/**
 * Greedy wave-based court scheduler.
 *
 * Hard constraint: no player appears in 2 matches of the same wave.
 * Soft constraint: prefer players who did NOT play in the previous wave (rest).
 *
 * @param {Array}  matches    - match objects with { id, player1_id, player2_id, round_number? }
 * @param {number} numCourts  - courts available per wave
 * @param {number} startWave  - wave number to start from (default 1)
 * @returns {Array} assignments - [{ id, court_number, wave_number }, ...]
 */
const FINAL_STAGES = new Set(['final', 'third_place'])

export function generateSchedule(matches, numCourts, startWave = 1) {
  // final/third_place always go into their own last wave
  const finalMatches   = matches.filter(m => FINAL_STAGES.has(m.stage))
  const regularMatches = matches.filter(m => !FINAL_STAGES.has(m.stage))

  const unscheduled = [...regularMatches]
  const assignments = []
  let waveNum = startWave
  let prevWavePlayers = new Set()

  while (unscheduled.length > 0) {
    const usedPlayers = new Set()
    const waveAssignments = []

    // Sort: rested players first, then earlier rounds, then lower group_id hash
    const sorted = [...unscheduled].sort((a, b) => {
      const aRested = prevWavePlayers.has(a.player1_id) || prevWavePlayers.has(a.player2_id) ? 1 : 0
      const bRested = prevWavePlayers.has(b.player1_id) || prevWavePlayers.has(b.player2_id) ? 1 : 0
      if (aRested !== bRested) return aRested - bRested
      return (a.round_number ?? 0) - (b.round_number ?? 0)
    })

    for (const match of sorted) {
      if (waveAssignments.length >= numCourts) break
      if (usedPlayers.has(match.player1_id) || usedPlayers.has(match.player2_id)) continue

      usedPlayers.add(match.player1_id)
      usedPlayers.add(match.player2_id)
      waveAssignments.push({
        id:           match.id,
        court_number: waveAssignments.length + 1,
        wave_number:  waveNum,
      })
    }

    if (waveAssignments.length === 0) break // no more progress possible

    assignments.push(...waveAssignments)

    const scheduledIds = new Set(waveAssignments.map(a => a.id))
    for (let i = unscheduled.length - 1; i >= 0; i--) {
      if (scheduledIds.has(unscheduled[i].id)) unscheduled.splice(i, 1)
    }

    prevWavePlayers = usedPlayers
    waveNum++
  }

  // Place final + third_place together in the last wave (always after all others)
  if (finalMatches.length > 0) {
    finalMatches.forEach((match, i) => {
      assignments.push({ id: match.id, court_number: i + 1, wave_number: waveNum })
    })
  }

  return assignments
}
