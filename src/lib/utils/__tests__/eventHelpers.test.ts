import { describe, it, expect } from 'vitest'
import { isAgeEligible, ageCategoryHint, getAgeCategoryLabel } from '../eventHelpers'

describe('eventHelpers - Age Limit restrictions', () => {
  describe('getAgeCategoryLabel', () => {
    it('returns correct labels for different formats', () => {
      expect(getAgeCategoryLabel('open')).toBe('Mở')
      expect(getAgeCategoryLabel('u17')).toBe('U17')
      expect(getAgeCategoryLabel('u35plus')).toBe('U35+')
      expect(getAgeCategoryLabel('u15')).toBe('U15')
      expect(getAgeCategoryLabel('u40plus')).toBe('U40+')
      expect(getAgeCategoryLabel('u18to30')).toBe('18-30')
    })
  })

  describe('ageCategoryHint', () => {
    it('returns correct hint string depending on current year', () => {
      const y = new Date().getFullYear()
      expect(ageCategoryHint('open')).toBeNull()
      expect(ageCategoryHint('u17')).toContain(`sinh năm ${y - 17} trở đi`)
      expect(ageCategoryHint('u35plus')).toContain(`sinh năm ${y - 35} trở về trước`)
      expect(ageCategoryHint('u18to30')).toBe(`sinh năm ${y - 30} đến ${y - 18} (từ 18 đến 30 tuổi)`)
    })
  })

  describe('isAgeEligible', () => {
    const currentYear = new Date().getFullYear()

    it('always returns true for open category', () => {
      expect(isAgeEligible(null, 'open')).toBe(true)
      expect(isAgeEligible('2000-01-01', 'open')).toBe(true)
    })

    it('validates under categories (U)', () => {
      // Limit: U17 (age <= 17)
      // Born 17 years ago -> exact age 17
      const birthYearEligible = currentYear - 17
      const birthYearIneligible = currentYear - 18

      expect(isAgeEligible(`${birthYearEligible}-06-15`, 'u17')).toBe(true)
      expect(isAgeEligible(`${birthYearIneligible}-06-15`, 'u17')).toBe(false)
    })

    it('validates over categories (+)', () => {
      // Limit: U35+ (age >= 35)
      const birthYearEligible = currentYear - 35
      const birthYearIneligible = currentYear - 34

      expect(isAgeEligible(`${birthYearEligible}-06-15`, 'u35plus')).toBe(true)
      expect(isAgeEligible(`${birthYearIneligible}-06-15`, 'u35plus')).toBe(false)
    })

    it('validates range categories (e.g. 18-30)', () => {
      // Limit: 18-30 (age >= 18 && age <= 30)
      const age18BirthYear = currentYear - 18
      const age30BirthYear = currentYear - 30
      const age17BirthYear = currentYear - 17
      const age31BirthYear = currentYear - 31

      expect(isAgeEligible(`${age18BirthYear}-06-15`, 'u18to30')).toBe(true)
      expect(isAgeEligible(`${age30BirthYear}-06-15`, 'u18to30')).toBe(true)
      expect(isAgeEligible(`${age17BirthYear}-06-15`, 'u18to30')).toBe(false) // too young (17)
      expect(isAgeEligible(`${age31BirthYear}-06-15`, 'u18to30')).toBe(false) // too old (31)
    })
  })
})
