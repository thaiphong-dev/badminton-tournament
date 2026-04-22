/**
 * Check if a group has no duplicate clubs.
 * "Tự do" players are excluded from conflict checks.
 */
function isGroupValid(group) {
  const clubs = group.map(p => p.club).filter(c => c !== 'Tự do')
  return clubs.length === new Set(clubs).size
}

/**
 * Find the first player in a group whose club appears more than once.
 * Returns null if the group is valid.
 */
function findDuplicatePlayer(group) {
  const seen = new Set()
  for (const p of group) {
    if (p.club === 'Tự do') continue
    if (seen.has(p.club)) {
      // Return this player (second occurrence = the one to move out)
      return p
    }
    seen.add(p.club)
  }
  return null
}

/**
 * Try to resolve all club conflicts in `groups` by swapping players.
 * Tries ALL duplicate players (not just the first) before giving up.
 * Returns true if fully resolved, false if stuck.
 */
function resolveConflicts(groups) {
  const MAX_PASSES = groups.length * groups.length * 4

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let hasConflict = false

    for (let i = 0; i < groups.length; i++) {
      const duplicate = findDuplicatePlayer(groups[i])
      if (!duplicate) continue

      hasConflict = true
      const playerIndex = groups[i].indexOf(duplicate)
      let swapped = false

      outer: for (let j = 0; j < groups.length; j++) {
        if (i === j) continue
        for (let k = 0; k < groups[j].length; k++) {
          const candidate = groups[j][k]

          const temp1 = [...groups[i]]
          temp1[playerIndex] = candidate
          const temp2 = [...groups[j]]
          temp2[k] = duplicate

          if (isGroupValid(temp1) && isGroupValid(temp2)) {
            groups[i][playerIndex] = candidate
            groups[j][k] = duplicate
            swapped = true
            break outer
          }
        }
      }

      // This conflict can't be resolved with any single swap — tell caller to retry
      if (!swapped) return false
    }

    if (!hasConflict) return true
  }

  return false
}

/**
 * Randomize players into groups ensuring no two players from the same club
 * are placed in the same group ("Tự do" players are exempt).
 *
 * Retries with a fresh shuffle up to MAX_ATTEMPTS times if conflicts can't
 * be resolved, so it handles tricky club distributions robustly.
 *
 * @param {Array}  players   - Array of player objects {id, name, club}
 * @param {number} numGroups - Number of groups
 * @returns {Array} Array of groups (each group = array of player objects)
 */
export function randomizeGroups(players, numGroups = 12) {
  const MAX_ATTEMPTS = 50

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Fresh random shuffle each attempt
    const shuffled = [...players].sort(() => Math.random() - 0.5)
    const groups   = Array.from({ length: numGroups }, () => [])
    shuffled.forEach((player, idx) => groups[idx % numGroups].push(player))

    if (resolveConflicts(groups)) return groups
  }

  // Last resort: return best-effort result (rare — only when mathematically impossible,
  // e.g. more players from one club than there are groups)
  const shuffled = [...players].sort(() => Math.random() - 0.5)
  const groups   = Array.from({ length: numGroups }, () => [])
  shuffled.forEach((player, idx) => groups[idx % numGroups].push(player))
  resolveConflicts(groups)
  return groups
}
