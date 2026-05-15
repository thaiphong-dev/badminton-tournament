import { describe, it, expect, vi } from 'vitest'

// Mock supabase — getQualifiedPlayers uses it; we test selectQualifiedPlayers (pure)
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { selectQualifiedPlayers } from '../qualifyPlayers'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRecord(playerId, rank, groupNumber, opts = {}) {
  return {
    player_id:    playerId,
    player_name:  playerId,
    club:         null,
    rank,
    group_number: groupNumber,
    wins:         opts.wins         ?? 2,
    losses:       opts.losses       ?? 1,
    sets_for:     opts.sets_for     ?? 4,
    sets_against: opts.sets_against ?? 2,
    score_for:    opts.score_for    ?? 80,
    score_against: opts.score_against ?? 60,
    score_diff:   opts.score_diff   ?? 20,
  }
}

// ── selectQualifiedPlayers ────────────────────────────────────────────────────

describe('selectQualifiedPlayers', () => {
  it('lấy tất cả rank-1 theo thứ tự group_number', () => {
    const records = [
      makeRecord('p1', 1, 3),
      makeRecord('p2', 1, 1),
      makeRecord('p3', 1, 2),
    ]
    const result = selectQualifiedPlayers(records, 3, 0)
    expect(result.map(r => r.player_id)).toEqual(['p2', 'p3', 'p1'])
  })

  it('gán seed đúng cho rank-1: seed = group_number', () => {
    const records = [makeRecord('a', 1, 2), makeRecord('b', 1, 5)]
    const result = selectQualifiedPlayers(records, 2, 0)
    expect(result.find(r => r.player_id === 'a').seed).toBe(2)
    expect(result.find(r => r.player_id === 'b').seed).toBe(5)
  })

  it('lấy đúng top numSecond từ rank-2 theo win_rate giảm dần', () => {
    const records = [
      makeRecord('p1', 1, 1),
      makeRecord('g1_2', 2, 1, { wins: 3, losses: 0, sets_for: 6, sets_against: 0, score_for: 100, score_against: 50, score_diff: 50 }),
      makeRecord('g2_2', 2, 2, { wins: 1, losses: 2, sets_for: 2, sets_against: 4, score_for: 50, score_against: 80, score_diff: -30 }),
      makeRecord('g3_2', 2, 3, { wins: 2, losses: 1, sets_for: 4, sets_against: 2, score_for: 80, score_against: 60, score_diff: 20 }),
    ]
    // numFirst=1, numSecond=2 → lấy 2 rank-2 tốt nhất
    const result = selectQualifiedPlayers(records, 1, 2)
    const secondPlaceResults = result.filter(r => r.qualified_as === 'Nhì bảng')
    expect(secondPlaceResults).toHaveLength(2)
    // g1_2 (win_rate 1.0) và g3_2 (win_rate 0.67) → g2_2 (win_rate 0.33) bị loại
    expect(secondPlaceResults.map(r => r.player_id)).not.toContain('g2_2')
  })

  it('gán seed numFirst+1, numFirst+2, ... cho rank-2', () => {
    const records = [
      makeRecord('a', 1, 1),
      makeRecord('b', 1, 2),
      makeRecord('x', 2, 1),
      makeRecord('y', 2, 2),
    ]
    const result = selectQualifiedPlayers(records, 2, 2)
    const seconds = result.filter(r => r.qualified_as === 'Nhì bảng')
    const seeds = seconds.map(r => r.seed).sort((a, b) => a - b)
    expect(seeds).toEqual([3, 4]) // numFirst=2 → seed 3, 4
  })

  it('trả về [] khi không có records', () => {
    expect(selectQualifiedPlayers([], 4, 2)).toEqual([])
  })

  it('không lấy rank-2 nếu numSecond=0', () => {
    const records = [makeRecord('a', 1, 1), makeRecord('b', 2, 1)]
    const result = selectQualifiedPlayers(records, 1, 0)
    expect(result).toHaveLength(1)
    expect(result[0].qualified_as).toBe('Nhất bảng')
  })

  it('tiebreak sets_ratio khi win_rate bằng nhau', () => {
    // 2 rank-2 cùng win_rate, khác sets_ratio → người có sets_ratio cao hơn được chọn
    const records = [
      makeRecord('a', 2, 1, { wins: 2, losses: 1, sets_for: 5, sets_against: 1, score_for: 90, score_against: 50, score_diff: 40 }),
      makeRecord('b', 2, 2, { wins: 2, losses: 1, sets_for: 4, sets_against: 2, score_for: 80, score_against: 60, score_diff: 20 }),
    ]
    const result = selectQualifiedPlayers(records, 0, 1)
    // a: sets_ratio = 5/6 ≈ 0.833, b: sets_ratio = 4/6 ≈ 0.667 → a thắng
    expect(result[0].player_id).toBe('a')
  })
})
