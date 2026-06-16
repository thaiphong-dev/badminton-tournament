// ── Disciplines (nội dung thi đấu) ───────────────────────────────────────────

export const DISCIPLINES = {
  MENS_SINGLES:   'mens_singles',
  WOMENS_SINGLES: 'womens_singles',
  MENS_DOUBLES:   'mens_doubles',
  WOMENS_DOUBLES: 'womens_doubles',
  MIXED_DOUBLES:  'mixed_doubles',
}

export const DISCIPLINE_LABELS = {
  mens_singles:   'Đơn Nam',
  womens_singles: 'Đơn Nữ',
  mens_doubles:   'Đôi Nam',
  womens_doubles: 'Đôi Nữ',
  mixed_doubles:  'Đôi Nam Nữ',
}

export const DISCIPLINE_ICONS = {
  mens_singles:   '🏸',
  womens_singles: '🏸',
  mens_doubles:   '👥',
  womens_doubles: '👥',
  mixed_doubles:  '🤝',
}

export const DISCIPLINE_LIST = [
  { value: 'mens_singles',   label: 'Đơn Nam',     icon: '🏸' },
  { value: 'womens_singles', label: 'Đơn Nữ',      icon: '🏸' },
  { value: 'mens_doubles',   label: 'Đôi Nam',     icon: '👥' },
  { value: 'womens_doubles', label: 'Đôi Nữ',      icon: '👥' },
  { value: 'mixed_doubles',  label: 'Đôi Nam Nữ',  icon: '🤝' },
]

// ── Event (nội dung thi đấu) status ──────────────────────────────────────────

export const EVENT_STATUS = {
  SETUP:       'setup',
  GROUP_STAGE: 'group_stage',
  KNOCKOUT:    'knockout',
  COMPLETED:   'completed',
}

export const EVENT_STATUS_LABELS = {
  setup:       'Thiết lập',
  attendance:  'Điểm danh',
  group_stage: 'Vòng bảng',
  knockout:    'Knockout',
  completed:   'Hoàn thành',
}

export const EVENT_STATUS_BADGE = {
  setup:       'yellow',
  attendance:  'orange',
  group_stage: 'blue',
  knockout:    'purple',
  completed:   'green',
}

// ── Format options ────────────────────────────────────────────────────────────

export const FORMAT_OPTIONS = {
  GROUP_THEN_KNOCKOUT: 'group_then_knockout',
  KNOCKOUT_ONLY:       'knockout_only',
  ROUND_ROBIN:         'round_robin',
}

export const FORMAT_LABELS = {
  group_then_knockout: 'Vòng bảng → Knockout',
  knockout_only:       'Toàn bộ đánh loại trực tiếp',
  round_robin:         'Vòng tròn tính điểm',
}

// ── Default scoring rules per event ──────────────────────────────────────────

export const DEFAULT_EVENT_SCORING_RULES = {
  group_stage:      { sets: 1, points_per_set: 21 },
  knockout_regular: { sets: 1, points_per_set: 21 },
  knockout_late:    { sets: 3, points_per_set: 15, applies_from: 'semi' },
}

// ── Tournament status ─────────────────────────────────────────────────────────

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
