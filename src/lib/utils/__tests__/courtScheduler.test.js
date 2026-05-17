import { generateSchedule, formatWaveTime } from '@/lib/utils/courtScheduler'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mkMatch(id, p1, p2, opts = {}) {
  return { id, player1_id: p1, player2_id: p2, round_number: 1, ...opts }
}

// ─── generateSchedule ─────────────────────────────────────────────────────────

describe('generateSchedule', () => {
  it('returns empty array when no matches', () => {
    expect(generateSchedule([], 2)).toEqual([])
  })

  it('schedules 1 match on 1 court into wave 1', () => {
    const matches = [mkMatch('m1', 'p1', 'p2')]
    const result = generateSchedule(matches, 1)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'm1', court_number: 1, wave_number: 1 })
  })

  it('schedules up to numCourts matches per wave', () => {
    // 4 unique matches, 2 courts → 2 waves of 2
    const matches = [
      mkMatch('m1', 'p1', 'p2'),
      mkMatch('m2', 'p3', 'p4'),
      mkMatch('m3', 'p5', 'p6'),
      mkMatch('m4', 'p7', 'p8'),
    ]
    const result = generateSchedule(matches, 2)
    const wave1 = result.filter(a => a.wave_number === 1)
    const wave2 = result.filter(a => a.wave_number === 2)
    expect(wave1).toHaveLength(2)
    expect(wave2).toHaveLength(2)
  })

  it('respects player conflict — same player cannot appear twice in a wave', () => {
    // p1 appears in both m1 and m2 → must be in separate waves
    const matches = [mkMatch('m1', 'p1', 'p2'), mkMatch('m2', 'p1', 'p3')]
    const result = generateSchedule(matches, 2)

    const m1 = result.find(a => a.id === 'm1')
    const m2 = result.find(a => a.id === 'm2')
    expect(m1.wave_number).not.toBe(m2.wave_number)
  })

  it('assigns sequential court numbers within a wave', () => {
    const matches = [
      mkMatch('m1', 'p1', 'p2'),
      mkMatch('m2', 'p3', 'p4'),
    ]
    const result = generateSchedule(matches, 2)
    const courtNums = result.map(a => a.court_number).sort()
    expect(courtNums).toEqual([1, 2])
  })

  it('places final/third_place stages in their own last wave', () => {
    const matches = [
      mkMatch('semi',  'p1', 'p2', { stage: 'semi' }),
      mkMatch('final', 'p3', 'p4', { stage: 'final' }),
    ]
    const result = generateSchedule(matches, 2)
    const semiEntry  = result.find(a => a.id === 'semi')
    const finalEntry = result.find(a => a.id === 'final')

    expect(semiEntry.wave_number).toBeLessThan(finalEntry.wave_number)
  })

  it('puts both final and third_place in the same last wave', () => {
    const matches = [
      mkMatch('m1',    'p1', 'p2'),
      mkMatch('final', 'p3', 'p4', { stage: 'final' }),
      mkMatch('third', 'p5', 'p6', { stage: 'third_place' }),
    ]
    const result = generateSchedule(matches, 2)
    const finalEntry = result.find(a => a.id === 'final')
    const thirdEntry = result.find(a => a.id === 'third')
    expect(finalEntry.wave_number).toBe(thirdEntry.wave_number)
  })

  it('respects startWave parameter — first wave uses startWave', () => {
    const matches = [mkMatch('m1', 'p1', 'p2')]
    const result = generateSchedule(matches, 1, 3)
    expect(result[0].wave_number).toBe(3)
  })

  it('does not include scheduled_time when startTime is null', () => {
    const matches = [mkMatch('m1', 'p1', 'p2')]
    const result = generateSchedule(matches, 1)
    expect(result[0].scheduled_time).toBeUndefined()
  })

  it('includes scheduled_time ISO string when startTime is provided', () => {
    const matches = [mkMatch('m1', 'p1', 'p2')]
    const result = generateSchedule(matches, 1, 1, {
      startTime: '2026-05-17T01:00:00.000Z',
      waveDurationMins: 45,
    })
    expect(result[0].scheduled_time).toBeDefined()
    expect(typeof result[0].scheduled_time).toBe('string')
    // Should be a valid ISO string
    expect(() => new Date(result[0].scheduled_time)).not.toThrow()
  })

  it('increments scheduled_time by waveDurationMins per wave', () => {
    // 1 court, 2 matches (different players) → wave 1 and wave 2
    const matches = [
      mkMatch('m1', 'p1', 'p2'),
      mkMatch('m2', 'p3', 'p4'),
    ]
    const startTime = '2026-05-17T01:00:00.000Z'
    const result = generateSchedule(matches, 1, 1, { startTime, waveDurationMins: 45 })

    const t1 = new Date(result[0].scheduled_time).getTime()
    const t2 = new Date(result[1].scheduled_time).getTime()
    expect(t2 - t1).toBe(45 * 60 * 1000)
  })

  it('schedules all matches (no leftover unscheduled)', () => {
    const matches = [
      mkMatch('m1', 'p1', 'p2'),
      mkMatch('m2', 'p3', 'p4'),
      mkMatch('m3', 'p1', 'p3'),
      mkMatch('m4', 'p2', 'p4'),
    ]
    const result = generateSchedule(matches, 2)
    const ids = result.map(a => a.id).sort()
    expect(ids).toEqual(['m1', 'm2', 'm3', 'm4'].sort())
  })

  it('prefers rested players over played-last-wave players (soft constraint)', () => {
    // With 1 court:
    // p1 vs p2 → wave 1 (p1,p2 played)
    // p3 vs p4 → wave 2 (rested → preferred)
    // p1 vs p3 → wave 3
    const matches = [
      mkMatch('m1', 'p1', 'p2', { round_number: 1 }),
      mkMatch('m2', 'p3', 'p4', { round_number: 1 }),
      mkMatch('m3', 'p1', 'p3', { round_number: 2 }),
    ]
    const result = generateSchedule(matches, 1)
    const wave1Ids = result.filter(a => a.wave_number === 1).map(a => a.id)
    const wave2Ids = result.filter(a => a.wave_number === 2).map(a => a.id)
    // m2 has neither p1 nor p2 → should be scheduled before m3 (which has p1, played wave1)
    expect(wave1Ids).toContain('m1')
    expect(wave2Ids).toContain('m2')
  })
})

// ─── formatWaveTime ───────────────────────────────────────────────────────────

describe('formatWaveTime', () => {
  it('returns null for null input', () => {
    expect(formatWaveTime(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(formatWaveTime(undefined)).toBeNull()
  })

  it('returns null for invalid date string', () => {
    expect(formatWaveTime('not-a-date')).toBeNull()
  })

  it('returns a time string in HH:MM format for valid ISO input', () => {
    const result = formatWaveTime('2026-05-17T01:30:00.000Z')
    // Should be non-null
    expect(result).not.toBeNull()
    // Should contain colon (HH:MM or similar)
    expect(result).toMatch(/:/)
  })

  it('converts UTC time correctly to Asia/Ho_Chi_Minh (UTC+7)', () => {
    // 01:30 UTC = 08:30 HCM
    const result = formatWaveTime('2026-05-17T01:30:00.000Z', 'Asia/Ho_Chi_Minh')
    expect(result).toContain('08')
    expect(result).toContain('30')
  })

  it('uses Asia/Ho_Chi_Minh as default timezone', () => {
    const withDefault  = formatWaveTime('2026-05-17T01:30:00.000Z')
    const withExplicit = formatWaveTime('2026-05-17T01:30:00.000Z', 'Asia/Ho_Chi_Minh')
    expect(withDefault).toBe(withExplicit)
  })
})
