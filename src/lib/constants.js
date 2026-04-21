export const TOURNAMENT_STATUS = {
  SETUP: 'setup',
  GROUP_STAGE: 'group_stage',
  KNOCKOUT: 'knockout',
  COMPLETED: 'completed',
}

export const MATCH_STAGE = {
  GROUP: 'group',
  ROUND_OF_16: 'round_of_16',
  QUARTER: 'quarter',
  SEMI: 'semi',
  FINAL: 'final',
  THIRD_PLACE: 'third_place',
}

export const MATCH_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
}

export const DEFAULT_SCORING_RULES = {
  group_stage: { sets: 1, points_per_set: 21 },
  knockout_regular: { sets: 1, points_per_set: 21 },
  knockout_semi_final: { sets: 3, points_per_set: 15 },
}

export const DEFAULT_TOURNAMENT_CONFIG = {
  num_groups: 12,
  num_first_place_qualify: 12,
  num_second_place_qualify: 4,
  scoring_rules: DEFAULT_SCORING_RULES,
}

export const STAGE_LABELS = {
  [MATCH_STAGE.GROUP]: 'Vòng bảng',
  [MATCH_STAGE.ROUND_OF_16]: '1/8',
  [MATCH_STAGE.QUARTER]: 'Tứ kết',
  [MATCH_STAGE.SEMI]: 'Bán kết',
  [MATCH_STAGE.FINAL]: 'Chung kết',
  [MATCH_STAGE.THIRD_PLACE]: 'Tranh hạng 3',
}

export const STATUS_LABELS = {
  [TOURNAMENT_STATUS.SETUP]: 'Thiết lập',
  [TOURNAMENT_STATUS.GROUP_STAGE]: 'Vòng bảng',
  [TOURNAMENT_STATUS.KNOCKOUT]: 'Knockout',
  [TOURNAMENT_STATUS.COMPLETED]: 'Hoàn thành',
}
