/**
 * Greedy wave-based court scheduler.
 *
 * Hard constraint: no player appears in 2 matches of the same wave.
 * Soft constraint: prefer players who did NOT play in the previous wave (rest).
 *
 * @param {Array}  matches    - match objects with { id, player1_id, player2_id, round_number?, stage? }
 * @param {number} numCourts  - courts available per wave
 * @param {number} startWave  - wave number to start from (default 1)
 * @param {Object} opts
 * @param {string|Date|null} opts.startTime        - ISO datetime string for wave 1 start (enables time scheduling)
 * @param {number}           opts.waveDurationMins - minutes per wave (default 45)
 * @returns {Array} assignments - [{ id, court_number, wave_number, scheduled_time? }, ...]
 */
const FINAL_STAGES = new Set(['final', 'third_place'])

export function generateSchedule(matches, numCourts, startWave = 1, opts = {}) {
  const { startTime = null, waveDurationMins = 45 } = opts

  // Precompute start time for a given wave number
  function waveStartTime(waveNum) {
    if (!startTime) return null
    const base = new Date(startTime).getTime()
    const offsetMs = (waveNum - startWave) * waveDurationMins * 60 * 1000
    return new Date(base + offsetMs).toISOString()
  }

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

    const scheduledTime = waveStartTime(waveNum)

    for (const match of sorted) {
      if (waveAssignments.length >= numCourts) break
      if (usedPlayers.has(match.player1_id) || usedPlayers.has(match.player2_id)) continue

      usedPlayers.add(match.player1_id)
      usedPlayers.add(match.player2_id)
      const entry = {
        id:           match.id,
        court_number: waveAssignments.length + 1,
        wave_number:  waveNum,
      }
      if (scheduledTime) entry.scheduled_time = scheduledTime
      waveAssignments.push(entry)
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
    const scheduledTime = waveStartTime(waveNum)
    finalMatches.forEach((match, i) => {
      const entry = { id: match.id, court_number: i + 1, wave_number: waveNum }
      if (scheduledTime) entry.scheduled_time = scheduledTime
      assignments.push(entry)
    })
  }

  return assignments
}

/**
 * Format a scheduled_time ISO string to Vietnamese short time display.
 * e.g. "2026-05-17T08:30:00.000Z" → "08:30"
 */
export function formatWaveTime(isoString, timezone = 'Asia/Ho_Chi_Minh') {
  if (!isoString) return null
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return null
    return d.toLocaleTimeString('vi-VN', {
      hour: '2-digit', minute: '2-digit', timeZone: timezone,
    })
  } catch {
    return null
  }
}
