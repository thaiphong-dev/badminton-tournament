import { DEFAULT_EVENT_SCORING_RULES } from '@/lib/constants'

/**
 * Given an event's scoring_rules config and a match stage,
 * return the { sets, pointsPerSet } to apply for that match.
 *
 * Priority:
 *  1. knockout_late  – applies from a specific stage onwards (e.g. 'semi')
 *  2. group_stage    – for group matches
 *  3. knockout_regular – default for all other knockout stages
 *
 * @param {Object|null} scoringRules - event.scoring_rules (JSONB from DB)
 * @param {string}      stage        - match stage key (e.g. 'semi', 'group')
 * @returns {{ sets: number, pointsPerSet: number }}
 */
export function getStageScoringRule(scoringRules, stage) {
  const rules = scoringRules ?? DEFAULT_EVENT_SCORING_RULES

  // Stage order for "applies_from" comparison
  const STAGE_ORDER = ['round_of_16', 'quarter', 'semi', 'final', 'third_place']

  const late = rules.knockout_late
  if (late?.applies_from && STAGE_ORDER.includes(stage)) {
    const lateIdx  = STAGE_ORDER.indexOf(late.applies_from)
    const stageIdx = STAGE_ORDER.indexOf(stage)
    if (stageIdx >= lateIdx) {
      return { sets: late.sets ?? 3, pointsPerSet: late.points_per_set ?? 15 }
    }
  }

  if (stage === 'group') {
    const gs = rules.group_stage ?? DEFAULT_EVENT_SCORING_RULES.group_stage
    return { sets: gs.sets ?? 1, pointsPerSet: gs.points_per_set ?? 21 }
  }

  const reg = rules.knockout_regular ?? DEFAULT_EVENT_SCORING_RULES.knockout_regular
  return { sets: reg.sets ?? 1, pointsPerSet: reg.points_per_set ?? 21 }
}

/**
 * Check whether all events in a tournament have been completed.
 *
 * @param {Array} events - array of event rows from DB
 * @returns {boolean}
 */
export function isTournamentComplete(events) {
  if (!events || events.length === 0) return false
  return events.every(e => e.status === 'completed')
}

/**
 * Is this discipline a doubles event?
 * Doubles disciplines have pairs as "players".
 *
 * @param {string} discipline
 * @returns {boolean}
 */
export function isDoublesDiscipline(discipline) {
  return ['mens_doubles', 'womens_doubles', 'mixed_doubles'].includes(discipline)
}

/**
 * Build a default event config object for the EventSetup form.
 *
 * @returns {Object}
 */
export function defaultEventConfig() {
  return {
    format: 'group_then_knockout',
    num_groups: 4,
    num_first_place_qualify: 4,
    num_second_place_qualify: 0,
    scoring_rules: { ...DEFAULT_EVENT_SCORING_RULES },
  }
}

/**
 * Nearest power of 2 >= n.
 * Used to validate that qualified player count fits a bracket.
 */
export function nextPowerOfTwo(n) {
  let p = 1
  while (p < n) p *= 2
  return p
}

/**
 * Check whether the total qualify count is a clean power of 2.
 * Returns true if OK, false if bracket size would be awkward.
 */
export function isValidBracketSize(numFirst, numSecond) {
  const total = numFirst + numSecond
  if (total <= 0) return false
  return (total & (total - 1)) === 0  // bitwise power-of-2 check
}
