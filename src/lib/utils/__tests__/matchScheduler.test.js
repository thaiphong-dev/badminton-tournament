import { vi } from 'vitest'
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { generateRoundRobinMatches } from '@/lib/utils/matchScheduler'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePlayers(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}` }))
}

function pairKey(a, b) {
  return [a, b].sort().join('-')
}

// ─── generateRoundRobinMatches ────────────────────────────────────────────────

describe('generateRoundRobinMatches', () => {
  it('returns [] for 0 players', () => {
    expect(generateRoundRobinMatches([])).toEqual([])
  })

  it('returns [] for 1 player', () => {
    expect(generateRoundRobinMatches([{ id: 'p1' }])).toEqual([])
  })

  it('returns 1 match for 2 players', () => {
    const result = generateRoundRobinMatches(makePlayers(2))
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ player1_id: expect.any(String), player2_id: expect.any(String) })
  })

  it('returns 3 matches for 3 players (odd — bye added)', () => {
    const result = generateRoundRobinMatches(makePlayers(3))
    expect(result).toHaveLength(3)
  })

  it('returns 6 matches for 4 players', () => {
    const result = generateRoundRobinMatches(makePlayers(4))
    expect(result).toHaveLength(6)
  })

  it('returns 10 matches for 5 players', () => {
    // n=5 (odd), bye added → 6 participants → 5 rounds × 3 pairs = 15, minus 5 bye = 10
    const result = generateRoundRobinMatches(makePlayers(5))
    expect(result).toHaveLength(10)
  })

  it('returns 15 matches for 6 players', () => {
    const result = generateRoundRobinMatches(makePlayers(6))
    expect(result).toHaveLength(15)
  })

  it('returns n*(n-1)/2 matches for any even n', () => {
    for (const n of [2, 4, 6, 8]) {
      const result = generateRoundRobinMatches(makePlayers(n))
      expect(result).toHaveLength((n * (n - 1)) / 2)
    }
  })

  it('no player plays against themselves', () => {
    const result = generateRoundRobinMatches(makePlayers(6))
    result.forEach(m => expect(m.player1_id).not.toBe(m.player2_id))
  })

  it('no duplicate match pairs (order-independent)', () => {
    const result = generateRoundRobinMatches(makePlayers(6))
    const pairs = result.map(m => pairKey(m.player1_id, m.player2_id))
    const unique = new Set(pairs)
    expect(unique.size).toBe(pairs.length)
  })

  it('each player appears exactly n-1 times for even n', () => {
    const n = 4
    const players = makePlayers(n)
    const result = generateRoundRobinMatches(players)

    players.forEach(p => {
      const count = result.filter(m => m.player1_id === p.id || m.player2_id === p.id).length
      expect(count).toBe(n - 1)
    })
  })

  it('each player appears exactly n-1 times for odd n', () => {
    const n = 5
    const players = makePlayers(n)
    const result = generateRoundRobinMatches(players)

    players.forEach(p => {
      const count = result.filter(m => m.player1_id === p.id || m.player2_id === p.id).length
      expect(count).toBe(n - 1)
    })
  })

  it('all pairs are covered exactly once for 4 players', () => {
    const players = makePlayers(4)
    const result = generateRoundRobinMatches(players)
    const pairs = new Set(result.map(m => pairKey(m.player1_id, m.player2_id)))

    // All 6 pairs: p1-p2, p1-p3, p1-p4, p2-p3, p2-p4, p3-p4
    expect(pairs.has('p1-p2')).toBe(true)
    expect(pairs.has('p1-p3')).toBe(true)
    expect(pairs.has('p1-p4')).toBe(true)
    expect(pairs.has('p2-p3')).toBe(true)
    expect(pairs.has('p2-p4')).toBe(true)
    expect(pairs.has('p3-p4')).toBe(true)
  })

  it('all pairs are covered exactly once for 3 players (odd)', () => {
    const players = makePlayers(3)
    const result = generateRoundRobinMatches(players)
    const pairs = new Set(result.map(m => pairKey(m.player1_id, m.player2_id)))

    expect(pairs.has('p1-p2')).toBe(true)
    expect(pairs.has('p1-p3')).toBe(true)
    expect(pairs.has('p2-p3')).toBe(true)
  })

  it('bye placeholder never appears in any match', () => {
    // 3-player (odd) adds a "bye" participant internally
    const result = generateRoundRobinMatches(makePlayers(3))
    result.forEach(m => {
      expect(m.player1_id).not.toBe('bye')
      expect(m.player2_id).not.toBe('bye')
    })
  })

  it('round numbers start at 1', () => {
    const result = generateRoundRobinMatches(makePlayers(4))
    const rounds = result.map(m => m.round)
    expect(Math.min(...rounds)).toBe(1)
  })

  it('round numbers are sequential without gaps', () => {
    const result = generateRoundRobinMatches(makePlayers(4))
    const rounds = [...new Set(result.map(m => m.round))].sort((a, b) => a - b)
    rounds.forEach((r, i) => expect(r).toBe(i + 1))
  })

  it('matches within a round have unique player pairs (no same-round player conflict)', () => {
    // In round-robin with enough courts, same player shouldn't appear twice in 1 round
    const result = generateRoundRobinMatches(makePlayers(4))
    const byRound = new Map()
    result.forEach(m => {
      if (!byRound.has(m.round)) byRound.set(m.round, [])
      byRound.get(m.round).push(m)
    })
    byRound.forEach(roundMatches => {
      const playersInRound = roundMatches.flatMap(m => [m.player1_id, m.player2_id])
      const uniquePlayers = new Set(playersInRound)
      expect(uniquePlayers.size).toBe(playersInRound.length) // no duplicates
    })
  })

  it('returns same result structure regardless of player id type', () => {
    const uuidPlayers = [
      { id: 'uuid-aaa-111' },
      { id: 'uuid-bbb-222' },
      { id: 'uuid-ccc-333' },
    ]
    const result = generateRoundRobinMatches(uuidPlayers)
    expect(result).toHaveLength(3)
    result.forEach(m => {
      expect(m.player1_id).toMatch(/^uuid-/)
      expect(m.player2_id).toMatch(/^uuid-/)
    })
  })
})
