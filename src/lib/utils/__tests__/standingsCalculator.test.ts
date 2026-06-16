import { describe, it, expect, vi } from 'vitest'

// Mock supabase — only updateGroupStandingsInDB uses it
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { calculateStandings, validateMatchScores } from '../standingsCalculator'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePlayer(id, name) {
  return { id, name, club: null }
}

function makeMatch(id, p1Id, p2Id, winnerId, p1Scores, p2Scores) {
  return {
    id,
    player1_id:     p1Id,
    player2_id:     p2Id,
    winner_id:      winnerId,
    player1_scores: p1Scores,
    player2_scores: p2Scores,
    status:         'completed',
  }
}

// ── calculateStandings ────────────────────────────────────────────────────────

describe('calculateStandings', () => {
  it('trả về mảng rỗng khi players rỗng', () => {
    const result = calculateStandings([], [])
    expect(result).toEqual([])
  })

  it('trả về mảng với rank=1 khi chỉ có 1 player, 0 trận', () => {
    const players = [makePlayer('p1', 'Alice')]
    const result  = calculateStandings([], players)
    expect(result).toHaveLength(1)
    expect(result[0].rank).toBe(1)
    expect(result[0].wins).toBe(0)
  })

  it('sắp xếp đúng theo số trận thắng', () => {
    const players = [makePlayer('a', 'A'), makePlayer('b', 'B'), makePlayer('c', 'C')]
    const matches = [
      makeMatch('m1', 'a', 'b', 'a', [21], [10]),
      makeMatch('m2', 'a', 'c', 'a', [21], [15]),
      makeMatch('m3', 'b', 'c', 'b', [21], [18]),
    ]
    const result = calculateStandings(matches, players)
    expect(result[0].player_id).toBe('a')  // 2 wins
    expect(result[1].player_id).toBe('b')  // 1 win
    expect(result[2].player_id).toBe('c')  // 0 wins
    expect(result[0].rank).toBe(1)
    expect(result[1].rank).toBe(2)
    expect(result[2].rank).toBe(3)
  })

  it('tính đúng điểm (wins × 2)', () => {
    const players = [makePlayer('a', 'A'), makePlayer('b', 'B')]
    const matches = [makeMatch('m1', 'a', 'b', 'a', [21], [15])]
    const result  = calculateStandings(matches, players)
    const a = result.find(r => r.player_id === 'a')
    const b = result.find(r => r.player_id === 'b')
    expect(a.points).toBe(2)
    expect(b.points).toBe(0)
    expect(a.wins).toBe(1)
    expect(b.losses).toBe(1)
  })

  it('tính đúng sets_diff và score_diff', () => {
    const players = [makePlayer('a', 'A'), makePlayer('b', 'B')]
    // a thắng 2-1: [21-15, 15-21, 21-19]
    const matches = [makeMatch('m1', 'a', 'b', 'a', [21, 15, 21], [15, 21, 19])]
    const result  = calculateStandings(matches, players)
    const a = result.find(r => r.player_id === 'a')
    expect(a.sets_for).toBe(2)
    expect(a.sets_against).toBe(1)
    expect(a.sets_diff).toBe(1)
    expect(a.score_for).toBe(57)     // 21+15+21
    expect(a.score_against).toBe(55) // 15+21+19
    expect(a.score_diff).toBe(2)
  })

  it('tiebreak: head-to-head wins khi cùng số trận thắng', () => {
    // 3 player, round-robin, mỗi người thắng 1 thua 1
    const players = [makePlayer('a', 'A'), makePlayer('b', 'B'), makePlayer('c', 'C')]
    const matches = [
      makeMatch('m1', 'a', 'b', 'a', [21], [10]), // a > b
      makeMatch('m2', 'b', 'c', 'b', [21], [10]), // b > c
      makeMatch('m3', 'c', 'a', 'c', [21], [10]), // c > a
    ]
    // a: 1W, b: 1W, c: 1W — head-to-head: a>b, b>c, c>a → circular, falls to sets_diff
    const result = calculateStandings(matches, players)
    expect(result).toHaveLength(3)
    result.forEach((r, i) => expect(r.rank).toBe(i + 1))
  })

  it('bỏ qua trận chưa hoàn thành (status !== completed)', () => {
    const players = [makePlayer('a', 'A'), makePlayer('b', 'B')]
    const matches = [
      { id: 'm1', player1_id: 'a', player2_id: 'b', winner_id: null, player1_scores: [], player2_scores: [], status: 'pending' },
    ]
    const result = calculateStandings(matches, players)
    const a = result.find(r => r.player_id === 'a')
    expect(a.wins).toBe(0)
    expect(a.points).toBe(0)
  })

  it('bỏ qua player_id không có trong danh sách players', () => {
    const players = [makePlayer('a', 'A')]
    const matches = [makeMatch('m1', 'a', 'unknown', 'a', [21], [15])]
    // p2 = 'unknown' không có trong statsMap → skip
    expect(() => calculateStandings(matches, players)).not.toThrow()
    const result = calculateStandings(matches, players)
    expect(result[0].wins).toBe(0) // match bị skip vì p2 không tồn tại
  })
})

// ── validateMatchScores ───────────────────────────────────────────────────────

describe('validateMatchScores', () => {
  it('valid: 1 set, người đạt 21 điểm', () => {
    const r = validateMatchScores([21], [15], 'group')
    expect(r.valid).toBe(true)
    expect(r.winner).toBe(1)
  })

  it('invalid: 1 set, không ai đạt 21', () => {
    const r = validateMatchScores([20], [18], 'group')
    expect(r.valid).toBe(false)
  })

  it('invalid: hòa điểm', () => {
    const r = validateMatchScores([21], [21], 'group')
    expect(r.valid).toBe(false)
  })

  it('valid: best-of-3, thắng 2 set', () => {
    const r = validateMatchScores([15, 15], [10, 8], 'semi')
    expect(r.valid).toBe(true)
    expect(r.winner).toBe(1)
  })

  it('valid: best-of-3, set thứ 3 (3 sets)', () => {
    const r = validateMatchScores([15, 8, 15], [8, 15, 12], 'final')
    expect(r.valid).toBe(true)
    expect(r.winner).toBe(1)
  })

  it('invalid: best-of-3, chỉ có 1 set', () => {
    const r = validateMatchScores([15], [10], 'semi')
    expect(r.valid).toBe(false)
  })

  it('custom opts override stage defaults', () => {
    const r = validateMatchScores([21], [15], 'semi', { isBestOf3: false, pointsPerSet: 21 })
    expect(r.valid).toBe(true)
    expect(r.winner).toBe(1)
  })

  it('player 2 wins single-game', () => {
    const r = validateMatchScores([15], [21], 'group')
    expect(r.valid).toBe(true)
    expect(r.winner).toBe(2)
  })

  it('invalid: 4 sets provided in best-of-3', () => {
    const r = validateMatchScores([15, 10, 15, 12], [10, 15, 10, 15], 'final')
    expect(r.valid).toBe(false)
  })

  it('invalid: 2 sets played but neither player won 2 (each won 1)', () => {
    const r = validateMatchScores([15, 10], [10, 15], 'final')
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/chưa có người thắng 2 set/i)
  })

  it('invalid: best-of-3 set score insufficient', () => {
    const r = validateMatchScores([14, 15], [10, 8], 'final')
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/Set 1/)
  })

  it('isBestOf3:false ignores final stage default', () => {
    const r = validateMatchScores([21], [15], 'final', { isBestOf3: false, pointsPerSet: 21 })
    expect(r.valid).toBe(true)
    expect(r.winner).toBe(1)
  })
})

// ── calculateStandings: additional coverage ───────────────────────────────────

describe('calculateStandings — tiebreaker modes', () => {
  const players = [makePlayer('A', 'A'), makePlayer('B', 'B'), makePlayer('C', 'C')]

  // Circular 3-way tie: A>B 21-15, B>C 21-16, C>A 21-18
  // H2H score_diff: A=+3, B=-1, C=-2
  const circularMatches = [
    makeMatch('m1', 'A', 'B', 'A', [21], [15]),
    makeMatch('m2', 'B', 'C', 'B', [21], [16]),
    makeMatch('m3', 'C', 'A', 'C', [21], [18]),
  ]

  it('bwf mode: phân hạng theo H2H score_diff', () => {
    const result = calculateStandings(circularMatches, players, { tiebreakerMode: 'bwf' })
    expect(result[0].player_id).toBe('A')
    expect(result[1].player_id).toBe('B')
    expect(result[2].player_id).toBe('C')
  })

  it('sets_first mode: dùng overall score_diff khi sets bằng nhau', () => {
    const result = calculateStandings(circularMatches, players, { tiebreakerMode: 'sets_first' })
    expect(result[0].player_id).toBe('A')
  })

  it('h2h_score_first mode: dùng H2H score trước sets', () => {
    const result = calculateStandings(circularMatches, players, { tiebreakerMode: 'h2h_score_first' })
    expect(result[0].player_id).toBe('A')
    expect(result[1].player_id).toBe('B')
  })

  it('mặc định dùng bwf khi không truyền tiebreakerMode', () => {
    const def = calculateStandings(circularMatches, players)
    const bwf = calculateStandings(circularMatches, players, { tiebreakerMode: 'bwf' })
    expect(def.map(s => s.player_id)).toEqual(bwf.map(s => s.player_id))
  })
})

describe('calculateStandings — JSON string score parsing', () => {
  it('xử lý player1_scores là JSON string thay vì Array', () => {
    const players = [makePlayer('a', 'A'), makePlayer('b', 'B')]
    const match = {
      id: 'm1', player1_id: 'a', player2_id: 'b', winner_id: 'a',
      player1_scores: '[21]', player2_scores: '[10]', status: 'completed',
    }
    const result = calculateStandings([match], players)
    const a = result.find(r => r.player_id === 'a')
    expect(a.wins).toBe(1)
    expect(a.score_for).toBe(21)
    expect(a.score_against).toBe(10)
  })
})
