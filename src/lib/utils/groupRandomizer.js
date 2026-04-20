/**
 * Check if a group has no duplicate clubs.
 * "Tự do" players are excluded from conflict checks
 * (multiple "Tự do" players may be in the same group).
 */
function isGroupValid(group) {
  const clubs = group.map(p => p.club).filter(c => c !== 'Tự do')
  return clubs.length === new Set(clubs).size
}

/**
 * Randomize players into groups with club constraint
 * @param {Array} players - Array of player objects {id, name, club}
 * @param {number} numGroups - Number of groups (default: 12)
 * @returns {Array} Array of groups, each containing player objects
 */
export function randomizeGroups(players, numGroups = 12) {
  // Step 1: Shuffle players randomly
  const shuffled = [...players].sort(() => Math.random() - 0.5)

  // Step 2: Initialize empty groups
  const groups = Array.from({ length: numGroups }, () => [])

  // Step 3: Distribute players round-robin
  shuffled.forEach((player, index) => {
    const groupIndex = index % numGroups
    groups[groupIndex].push(player)
  })

  // Step 4: Fix club conflicts
  let maxIterations = 100
  let iteration = 0

  while (iteration < maxIterations) {
    let hasConflict = false

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i]
      // "Tự do" players never conflict with each other
      const clubs = group.map(p => p.club).filter(c => c !== 'Tự do')
      const uniqueClubs = new Set(clubs)

      if (clubs.length !== uniqueClubs.size) {
        hasConflict = true

        const clubCounts = {}
        clubs.forEach(club => {
          clubCounts[club] = (clubCounts[club] || 0) + 1
        })

        const duplicateClub = Object.keys(clubCounts).find(
          club => clubCounts[club] > 1
        )

        const playerToSwap = group.find(p => p.club === duplicateClub)
        const playerIndex = group.indexOf(playerToSwap)

        let swapped = false
        for (let j = 0; j < groups.length; j++) {
          if (i === j) continue

          const otherGroup = groups[j]

          for (let k = 0; k < otherGroup.length; k++) {
            const candidatePlayer = otherGroup[k]

            const tempGroup1 = [...group]
            tempGroup1[playerIndex] = candidatePlayer

            const tempGroup2 = [...otherGroup]
            tempGroup2[k] = playerToSwap

            const valid1 = isGroupValid(tempGroup1)
            const valid2 = isGroupValid(tempGroup2)

            if (valid1 && valid2) {
              groups[i][playerIndex] = candidatePlayer
              groups[j][k] = playerToSwap
              swapped = true
              break
            }
          }

          if (swapped) break
        }

        if (!swapped) {
          console.warn('Could not resolve club conflict in group', i)
        }
      }
    }

    if (!hasConflict) break
    iteration++
  }

  if (iteration >= maxIterations) {
    console.error('Failed to resolve all club conflicts after', maxIterations, 'iterations')
  }

  return groups
}
