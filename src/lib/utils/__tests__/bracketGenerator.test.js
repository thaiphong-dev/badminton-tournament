import { describe, it, expect, vi } from 'vitest'

// Mock supabase — only saveKnockoutBracket uses it
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { buildBracketRows } from '../bracketGenerator'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePlayers(n) {
  return Array.from({ length: n }, (_, i) => ({
    player_id: `p${i + 1}`,
    seed: i + 1,
  }))
}

// ── buildBracketRows ──────────────────────────────────────────────────────────

describe('buildBracketRows', () => {
  it('8 người → bracketSize=8, 3 rounds + third_place', () => {
    const { rows, bracketSize, mainStages } = buildBracketRows(makePlayers(8), 't1')
    expect(bracketSize).toBe(8)
    expect(mainStages).toEqual(['quarter', 'semi', 'final'])
    // 4 quarter + 2 semi + 1 final + 1 third_place = 8
    expect(rows).toHaveLength(8)
  })

  it('16 người → bracketSize=16, 4 rounds', () => {
    const { bracketSize, mainStages } = buildBracketRows(makePlayers(16), 't1')
    expect(bracketSize).toBe(16)
    expect(mainStages).toEqual(['round_of_16', 'quarter', 'semi', 'final'])
  })

  it('4 người → bracketSize=4, semi + final', () => {
    const { bracketSize, mainStages, rows } = buildBracketRows(makePlayers(4), 't1')
    expect(bracketSize).toBe(4)
    expect(mainStages).toEqual(['semi', 'final'])
    // 2 semi + 1 final + 1 third_place = 4
    expect(rows).toHaveLength(4)
  })

  it('6 người (non-power-of-2) → bracketSize=8, 2 bye matches', () => {
    const { bracketSize, rows } = buildBracketRows(makePlayers(6), 't1')
    expect(bracketSize).toBe(8)
    const byeMatches = rows.filter(r => r.status === 'completed' && r.winner_id)
    expect(byeMatches).toHaveLength(2)
  })

  it('bye match có đúng 1 player, player kia là null', () => {
    const { rows } = buildBracketRows(makePlayers(6), 't1')
    const byeMatches = rows.filter(r => r.status === 'completed' && r.winner_id)
    byeMatches.forEach(m => {
      const hasOnePlayer = (m.player1_id === null) !== (m.player2_id === null)
      expect(hasOnePlayer).toBe(true)
    })
  })

  it('2 người → bracketSize=4 (minimum), không throw', () => {
    expect(() => buildBracketRows(makePlayers(2), 't1')).not.toThrow()
    const { bracketSize } = buildBracketRows(makePlayers(2), 't1')
    expect(bracketSize).toBe(4)
  })

  it('seed 1 và seed 2 không gặp nhau ở vòng đầu (8-bracket)', () => {
    const { rows, mainStages } = buildBracketRows(makePlayers(8), 't1')
    const firstStage = mainStages[0]
    const firstRound = rows.filter(r => r.stage === firstStage)
    // Tìm match chứa seed 1 (p1) và match chứa seed 2 (p2)
    const matchWithSeed1 = firstRound.find(m => m.player1_id === 'p1' || m.player2_id === 'p1')
    const matchWithSeed2 = firstRound.find(m => m.player1_id === 'p2' || m.player2_id === 'p2')
    expect(matchWithSeed1).toBeDefined()
    expect(matchWithSeed2).toBeDefined()
    // Seed 1 và seed 2 phải ở các match khác nhau
    expect(matchWithSeed1?.match_number).not.toBe(matchWithSeed2?.match_number)
  })

  it('tất cả rows có tournament_id đúng', () => {
    const { rows } = buildBracketRows(makePlayers(8), 'tournament-abc')
    rows.forEach(r => expect(r.tournament_id).toBe('tournament-abc'))
  })

  it('tất cả rows có event_id khi được truyền vào', () => {
    const { rows } = buildBracketRows(makePlayers(8), 't1', 'event-xyz')
    rows.forEach(r => expect(r.event_id).toBe('event-xyz'))
  })

  it('luôn có đúng 1 trận third_place', () => {
    for (const n of [4, 6, 8, 12, 16]) {
      const { rows } = buildBracketRows(makePlayers(n), 't1')
      const thirdPlace = rows.filter(r => r.stage === 'third_place')
      expect(thirdPlace).toHaveLength(1)
    }
  })

  it('số trận vòng đầu = bracketSize / 2', () => {
    const { rows, mainStages, bracketSize } = buildBracketRows(makePlayers(8), 't1')
    const firstRound = rows.filter(r => r.stage === mainStages[0])
    expect(firstRound).toHaveLength(bracketSize / 2)
  })
})
