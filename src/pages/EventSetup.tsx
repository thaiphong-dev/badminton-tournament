import { useEffect, useState, startTransition } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Settings, LayoutList, GitBranch, AlertCircle, CheckCircle,
  ChevronRight, Loader2, Info, ClipboardList, Grid, Plus, Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { FORMAT_OPTIONS, FORMAT_LABELS } from '@/lib/constants'
import { isValidBracketSize, nextPowerOfTwo, ageCategoryHint } from '@/lib/utils/eventHelpers'
import { useI18n } from '@/i18n'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Breadcrumb from '@/components/layout/Breadcrumb'
import { cn } from '@/lib/utils/cn'

// ── Small radio-button group ──────────────────────────────────────────────────
function RadioGroup({ label, options, value, onChange, hint }) {
  return (
    <div>
      {label && <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>}
      <div className="flex gap-3 flex-wrap">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all',
              value === opt.value
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1.5">{hint}</p>}
    </div>
  )
}

// ── Section card ──────────────────────────────────────────────────────────────
function Section({ icon, title, children }) {
  const Icon = icon
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-blue-600" />
        </div>
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      </div>
      {children}
    </div>
  )
}

// ── Scoring rule sub-form ─────────────────────────────────────────────────────
function ScoringRuleRow({ label, sets, pointsPerSet, onSetsChange, onPointsChange, ptsLabel }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600 w-40 shrink-0">{label}</span>
      <div className="flex items-center gap-3 flex-wrap">
        <RadioGroup
          options={[
            { value: 1, label: '1 set' },
            { value: 3, label: '3 sets' },
          ]}
          value={sets}
          onChange={v => onSetsChange(Number(v))}
        />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">×</span>
          <div className="flex flex-col items-center gap-0.5">
            <input
              type="number"
              min="1"
              max="99"
              value={pointsPerSet}
              onChange={e => onPointsChange(Math.max(1, Math.min(99, Number(e.target.value))))}
              className="w-16 text-center text-sm border-2 border-gray-200 rounded-lg py-1.5 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <span className="text-xs text-gray-300" style={{ fontSize: 10 }}>1–99</span>
          </div>
          <span className="text-xs text-gray-400">{ptsLabel}</span>
        </div>
      </div>
    </div>
  )
}

// ── Custom field row (inside EventSetup) ─────────────────────────────────────
function CustomFieldRow({ field, onChange, onDelete }) {
  const FIELD_TYPES = [
    { value: 'text',     label: 'Văn bản tự do' },
    { value: 'select',   label: 'Chọn một đáp án' },
    { value: 'checkbox', label: 'Xác nhận (checkbox)' },
  ]
  return (
    <div className="flex items-start gap-2 p-3 border border-gray-200 rounded-xl bg-gray-50/50">
      <div className="flex-1 space-y-2 min-w-0">
        <input
          type="text"
          value={field.label}
          onChange={e => onChange({ ...field, label: e.target.value })}
          placeholder="Tên trường (vd: Size áo, Xác nhận nội quy...)"
          maxLength={60}
          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={field.type}
            onChange={e => onChange({ ...field, type: e.target.value, options: [] })}
            className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {FIELD_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={field.required}
              onChange={e => onChange({ ...field, required: e.target.checked })}
              className="rounded border-gray-300"
            />
            <span className="text-gray-600">Bắt buộc</span>
          </label>
        </div>
        {field.type === 'select' && (
          <input
            type="text"
            value={(field.options ?? []).join(', ')}
            onChange={e => onChange({
              ...field,
              options: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
            })}
            placeholder="Các lựa chọn cách nhau bởi dấu phẩy: A, B, AB, O"
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        title="Xóa trường này"
        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors shrink-0 mt-0.5"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EventSetup() {
  const { id: tournamentId, eventId } = useParams()
  const navigate = useNavigate()
  const { t, lang } = useI18n()

  const [tournament, setTournament] = useState(null)
  const [event, setEvent]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)
  const [saved, setSaved]           = useState(false)

  // ── Form state ──────────────────────────────────────────────────────────────
  const [format, setFormat]                     = useState('group_then_knockout')
  const [numGroups, setNumGroups]               = useState(4)
  const [numFirst, setNumFirst]                 = useState(4)
  const [numSecond, setNumSecond]               = useState(0)
  const [requirePlayerCode, setRequirePlayerCode] = useState(false)
  const [attendanceEnabled, setAttendanceEnabled] = useState(false)

  // Scoring rules
  const [gsSet, setGsSet]   = useState(1)
  const [gsPts, setGsPts]   = useState(21)
  const [regSet, setRegSet] = useState(1)
  const [regPts, setRegPts] = useState(21)
  const [useLate, setUseLate]   = useState(true)
  const [lateFrom, setLateFrom] = useState('semi')
  const [lateSet, setLateSet]   = useState(3)
  const [latePts, setLatePts]   = useState(15)
  const [numCourts, setNumCourts] = useState(2)
  const [ageCategory,        setAgeCategory]        = useState('open')
  const [customFields,       setCustomFields]       = useState([])
  const [tiebreakerMode,     setTiebreakerMode]     = useState('bwf')
  const [scheduleStartTime,  setScheduleStartTime]  = useState('')
  const [waveDurationMins,   setWaveDurationMins]   = useState(45)

  function hydrateForm(ev) {
    setFormat(ev.format ?? 'group_then_knockout')
    setNumGroups(ev.num_groups ?? 4)
    setNumFirst(ev.num_first_place_qualify ?? 4)
    setNumSecond(ev.num_second_place_qualify ?? 0)
    setRequirePlayerCode(ev.require_player_code ?? false)
    setAttendanceEnabled(ev.attendance_enabled ?? false)
    setAgeCategory(ev.age_category ?? 'open')
    setCustomFields(ev.custom_fields ?? [])
    setTiebreakerMode(ev.tiebreaker_mode ?? 'bwf')
    setScheduleStartTime(ev.schedule_start_time ? ev.schedule_start_time.slice(0, 16) : '')
    setWaveDurationMins(ev.wave_duration_minutes ?? 45)

    const sr = ev.scoring_rules ?? {}
    setGsSet(sr.group_stage?.sets ?? 1)
    setGsPts(sr.group_stage?.points_per_set ?? 21)
    setRegSet(sr.knockout_regular?.sets ?? 1)
    setRegPts(sr.knockout_regular?.points_per_set ?? 21)
    const late = sr.knockout_late
    setUseLate(!!late)
    setLateFrom(late?.applies_from ?? 'semi')
    setLateSet(late?.sets ?? 3)
    setLatePts(late?.points_per_set ?? 15)
    setNumCourts(ev.num_courts ?? 2)
  }

  async function fetchData() {
    setLoading(true)
    try {
      const [tRes, eRes] = await Promise.all([
        supabase.from('tournaments').select('id, name, start_date').eq('id', tournamentId).single(),
        supabase.from('events').select('*').eq('id', eventId).single(),
      ])
      if (tRes.error) throw tRes.error
      if (eRes.error) throw eRes.error
      setTournament(tRes.data)
      setEvent(eRes.data)
      hydrateForm(eRes.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { startTransition(() => { fetchData() }) }, [eventId])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      if (scheduleStartTime && tournament?.start_date) {
        const startLimit = new Date(`${tournament.start_date}T00:00`)
        const selectedTime = new Date(scheduleStartTime)
        if (selectedTime < startLimit) {
          const formattedDate = new Date(tournament.start_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'vi-VN')
          throw new Error(t('eventSetup.scheduleSection.invalidStartTimeError', { date: formattedDate }) || `Giờ bắt đầu không được trước ngày bắt đầu giải đấu (${formattedDate})`)
        }
      }
      if (ageCategory && ageCategory !== 'open') {
        const isValid = /^u\d+$/i.test(ageCategory) || /^u\d+plus$/i.test(ageCategory) || /^u\d+to\d+$/i.test(ageCategory)
        if (!isValid) {
          throw new Error(t('eventSetup.invalidAgeLimit') || 'Vui lòng nhập số tuổi giới hạn hợp lệ.')
        }

        const rangeMatch = ageCategory.match(/^u(\d+)to(\d+)$/i)
        if (rangeMatch) {
          const minVal = parseInt(rangeMatch[1], 10)
          const maxVal = parseInt(rangeMatch[2], 10)
          if (minVal >= maxVal) {
            throw new Error('Độ tuổi tối thiểu phải nhỏ hơn độ tuổi tối đa.')
          }
        }
      }
      const scoringRules = format === 'round_robin' ? {
        group_stage:      { sets: gsSet,  points_per_set: gsPts  },
      } : {
        group_stage:      { sets: gsSet,  points_per_set: gsPts  },
        knockout_regular: { sets: regSet, points_per_set: regPts },
        ...(useLate ? {
          knockout_late: { sets: lateSet, points_per_set: latePts, applies_from: lateFrom },
        } : {}),
      }
      const { error: err } = await supabase
        .from('events')
        .update({
          format,
          num_groups:                (format === 'group_then_knockout' || format === 'round_robin') ? Number(numGroups) : null,
          num_first_place_qualify:   format === 'group_then_knockout' ? Number(numFirst)  : null,
          num_second_place_qualify:  format === 'group_then_knockout' ? Number(numSecond) : null,
          scoring_rules:             scoringRules,
          require_player_code:       requirePlayerCode,
          attendance_enabled:        attendanceEnabled,
          age_category:              ageCategory,
          custom_fields:             customFields,
          num_courts:                Number(numCourts),
          tiebreaker_mode:           tiebreakerMode,
          schedule_start_time:       scheduleStartTime || null,
          wave_duration_minutes:     Number(waveDurationMins),
          setup_complete:            true,
        })
        .eq('id', eventId)
      if (err) throw err
      setSaved(true)
      return true
    } catch (err) {
      setError(t('eventSetup.saveError', { msg: err.message }))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAndNext() {
    const ok = await handleSave()
    if (ok) {
      navigate(`/tournament/${tournamentId}/event/${eventId}/players`)
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const totalQualify  = Number(numFirst) + Number(numSecond)
  const bracketOk     = format === 'knockout_only' || format === 'round_robin' || isValidBracketSize(Number(numFirst), Number(numSecond))
  const suggestedNext = bracketOk ? null : nextPowerOfTwo(totalQualify)

  // Age restriction helper variables
  let ageType = 'open'
  let ageNum = ''
  let ageMaxNum = ''
  if (ageCategory && ageCategory !== 'open') {
    const plusMatch = ageCategory.match(/^u(\d+)plus$/i)
    if (plusMatch) {
      ageType = 'over'
      ageNum = plusMatch[1]
    } else {
      const rangeMatch = ageCategory.match(/^u(\d+)to(\d+)$/i)
      if (rangeMatch) {
        ageType = 'range'
        ageNum = rangeMatch[1]
        ageMaxNum = rangeMatch[2]
      } else {
        const uMatch = ageCategory.match(/^u(\d+)$/i)
        if (uMatch) {
          ageType = 'under'
          ageNum = uMatch[1]
        }
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error && !event) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  const disciplineIcon = event?.discipline ? {
    mens_singles: '🏸', womens_singles: '🏸',
    mens_doubles: '👥', womens_doubles: '👥', mixed_doubles: '🤝',
  }[event.discipline] ?? '🏸' : '🏸'

  const ptsLabel = t('common.points')

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Breadcrumb
        className="mb-6"
        items={[
          { label: t('common.home'), href: '/' },
          { label: tournament?.name ?? '…', href: `/tournament/${tournamentId}` },
          { label: event?.name ?? '…', href: `/tournament/${tournamentId}/event/${eventId}/setup` },
          { label: t('eventSetup.breadcrumb') },
        ]}
      />

      {/* Event header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl leading-none">{disciplineIcon}</span>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{event?.name}</h1>
          <p className="text-sm text-gray-400">{t('eventSetup.subtitle')}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* ── SECTION 1: Format ── */}
        <Section icon={Settings} title={t('eventSetup.section.format')}>
          <RadioGroup
            options={[
              { value: FORMAT_OPTIONS.GROUP_THEN_KNOCKOUT, label: FORMAT_LABELS.group_then_knockout },
              { value: FORMAT_OPTIONS.KNOCKOUT_ONLY,       label: FORMAT_LABELS.knockout_only       },
              { value: FORMAT_OPTIONS.ROUND_ROBIN,         label: FORMAT_LABELS.round_robin         },
            ]}
            value={format}
            onChange={v => { setFormat(v); setSaved(false) }}
          />
        </Section>

        {/* ── SECTION 2: Group config ── */}
        {(format === FORMAT_OPTIONS.GROUP_THEN_KNOCKOUT || format === FORMAT_OPTIONS.ROUND_ROBIN) && (
          <Section icon={LayoutList} title={t('eventSetup.section.groupConfig')}>
            {format === FORMAT_OPTIONS.GROUP_THEN_KNOCKOUT ? (
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label={t('eventSetup.groups.numGroups')}
                  type="number"
                  min="1"
                  max="32"
                  value={numGroups}
                  onChange={e => { setNumGroups(e.target.value); setSaved(false) }}
                />
                <Input
                  label={t('eventSetup.groups.numFirst')}
                  type="number"
                  min="1"
                  value={numFirst}
                  onChange={e => { setNumFirst(e.target.value); setSaved(false) }}
                />
                <Input
                  label={t('eventSetup.groups.numSecond')}
                  type="number"
                  min="0"
                  value={numSecond}
                  onChange={e => { setNumSecond(e.target.value); setSaved(false) }}
                />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label={t('eventSetup.groups.numGroups')}
                  type="number"
                  min="1"
                  max="32"
                  value={numGroups}
                  onChange={e => { setNumGroups(e.target.value); setSaved(false) }}
                />
              </div>
            )}

            {format === FORMAT_OPTIONS.GROUP_THEN_KNOCKOUT && (
              /* Bracket size validation */
              <div className={cn(
                'flex items-start gap-2 mt-3 px-3 py-2.5 rounded-lg text-sm',
                bracketOk
                  ? 'bg-green-50 text-green-700'
                  : 'bg-yellow-50 text-yellow-700',
              )}>
                {bracketOk
                  ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  : <Info className="w-4 h-4 mt-0.5 shrink-0" />
                }
                {bracketOk
                  ? <span>{t('eventSetup.groups.bracketOk', { n: totalQualify })}</span>
                  : <span>
                      {t('eventSetup.groups.bracketBad', {
                        n: totalQualify,
                        suggested: suggestedNext,
                        half: suggestedNext / 2,
                      })}
                    </span>
                }
              </div>
            )}
          </Section>
        )}

        {/* ── SECTION 3: Scoring rules ── */}
        <Section icon={GitBranch} title={t('eventSetup.section.scoringRules')}>
          <div className="space-y-1">
            {(format === FORMAT_OPTIONS.GROUP_THEN_KNOCKOUT || format === FORMAT_OPTIONS.ROUND_ROBIN) && (
              <ScoringRuleRow
                label={format === FORMAT_OPTIONS.ROUND_ROBIN ? 'Đấu vòng tròn' : t('eventSetup.scoring.groupStage')}
                sets={gsSet}
                pointsPerSet={gsPts}
                ptsLabel={ptsLabel}
                onSetsChange={v => { setGsSet(v); setSaved(false) }}
                onPointsChange={v => { setGsPts(v); setSaved(false) }}
              />
            )}
            {format !== FORMAT_OPTIONS.ROUND_ROBIN && (
              <ScoringRuleRow
                label={t('eventSetup.scoring.knockoutRegular')}
                sets={regSet}
                pointsPerSet={regPts}
                ptsLabel={ptsLabel}
                onSetsChange={v => { setRegSet(v); setSaved(false) }}
                onPointsChange={v => { setRegPts(v); setSaved(false) }}
              />
            )}

            {format !== FORMAT_OPTIONS.ROUND_ROBIN && (
              /* Late-round override toggle */
              <div className="pt-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={useLate}
                    onClick={() => { setUseLate(v => !v); setSaved(false) }}
                    className={cn(
                      'relative w-9 h-5 rounded-full transition-colors focus:outline-none',
                      useLate ? 'bg-blue-500' : 'bg-gray-200',
                    )}
                  >
                    <span className={cn(
                      'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                      useLate ? 'translate-x-4' : 'translate-x-0',
                    )} />
                  </button>
                  <span className="text-sm font-medium text-gray-700">
                    {t('eventSetup.scoring.lateRoundToggle')}
                  </span>
                </label>

                {useLate && (
                  <div className="mt-3 pl-11 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm text-gray-500 shrink-0">{t('eventSetup.scoring.appliesFrom')}</span>
                      <RadioGroup
                        options={[
                          { value: 'quarter', label: t('eventSetup.scoring.quarter') },
                          { value: 'semi',    label: t('eventSetup.scoring.semi')    },
                        ]}
                        value={lateFrom}
                        onChange={v => { setLateFrom(v); setSaved(false) }}
                      />
                    </div>
                    <ScoringRuleRow
                      label={t('eventSetup.scoring.lateRound')}
                      sets={lateSet}
                      pointsPerSet={latePts}
                      ptsLabel={ptsLabel}
                      onSetsChange={v => { setLateSet(v); setSaved(false) }}
                      onPointsChange={v => { setLatePts(v); setSaved(false) }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* ── SECTION: Tiebreaker ── */}
        {(format === FORMAT_OPTIONS.GROUP_THEN_KNOCKOUT || format === FORMAT_OPTIONS.ROUND_ROBIN) && (
          <Section icon={GitBranch} title={t('eventSetup.section.tiebreaker')}>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  {t('eventSetup.tiebreaker.label')}
                </label>
                <select
                  value={tiebreakerMode}
                  onChange={e => { setTiebreakerMode(e.target.value); setSaved(false) }}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="bwf">{t('eventSetup.tiebreaker.bwf')}</option>
                  <option value="sets_first">{t('eventSetup.tiebreaker.setsFirst')}</option>
                  <option value="h2h_score_first">{t('eventSetup.tiebreaker.h2hScoreFirst')}</option>
                </select>
              </div>
            </div>
          </Section>
        )}

        {/* ── SECTION: Schedule ── */}
        <Section icon={GitBranch} title={t('eventSetup.section.schedule')}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  {t('eventSetup.scheduleSection.startTimeLabel')}
                </label>
                <input
                  type="datetime-local"
                  value={scheduleStartTime}
                  min={tournament?.start_date ? `${tournament.start_date}T00:00` : undefined}
                  onChange={e => { setScheduleStartTime(e.target.value); setSaved(false) }}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  {t('eventSetup.scheduleSection.durationLabel')}
                </label>
                <input
                  type="number"
                  min="10"
                  max="240"
                  value={waveDurationMins}
                  onChange={e => { setWaveDurationMins(e.target.value); setSaved(false) }}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              {t('eventSetup.scheduleSection.hint')}
            </p>
          </div>
        </Section>

        {/* ── SECTION: Mode ── */}
        <Section icon={Info} title={t('eventSetup.section.mode')}>
          <div className="flex items-start gap-3 select-none">
            <button
              type="button"
              role="switch"
              aria-checked={requirePlayerCode}
              disabled
              className={cn(
                'relative mt-0.5 w-9 h-5 rounded-full transition-colors focus:outline-none shrink-0 opacity-80 cursor-not-allowed',
                requirePlayerCode ? 'bg-blue-500' : 'bg-gray-200',
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                requirePlayerCode ? 'translate-x-4' : 'translate-x-0',
              )} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-700">{t('eventSetup.mode.requireCode')}</p>
                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                  Cấu hình chung
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {requirePlayerCode
                  ? t('eventSetup.mode.requireCodeOn')
                  : t('eventSetup.mode.requireCodeOff')}
              </p>
              <p className="text-[10px] text-blue-500 mt-1">
                Thiết lập này được áp dụng chung từ giải đấu. Bạn có thể thay đổi tại <Link to={`/tournament/${tournamentId}/edit`} className="underline hover:text-blue-700">Chỉnh sửa giải đấu</Link>.
              </p>
            </div>
          </div>
        </Section>

        {/* ── SECTION: Attendance ── */}
        <Section icon={ClipboardList} title={t('eventSetup.section.attendance')}>
          <div className="flex items-start gap-3 select-none">
            <button
              type="button"
              role="switch"
              aria-checked={attendanceEnabled}
              disabled
              className={cn(
                'relative mt-0.5 w-9 h-5 rounded-full transition-colors focus:outline-none shrink-0 opacity-80 cursor-not-allowed',
                attendanceEnabled ? 'bg-blue-500' : 'bg-gray-200',
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                attendanceEnabled ? 'translate-x-4' : 'translate-x-0',
              )} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-700">{t('eventSetup.mode.attendanceOn')}</p>
                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                  Cấu hình chung
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {attendanceEnabled
                  ? t('eventSetup.mode.attendanceOnHint')
                  : t('eventSetup.mode.attendanceOff')}
              </p>
              <p className="text-[10px] text-blue-500 mt-1">
                Thiết lập này được áp dụng chung từ giải đấu. Bạn có thể thay đổi tại <Link to={`/tournament/${tournamentId}/edit`} className="underline hover:text-blue-700">Chỉnh sửa giải đấu</Link>.
              </p>
            </div>
          </div>
        </Section>

        {/* ── SECTION: Age restriction ── */}
        <Section icon={Info} title="Giới hạn độ tuổi">
          <div className="space-y-3">
            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => { setAgeCategory('open'); setSaved(false) }}
                className={cn(
                  'px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                  ageType === 'open'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200',
                )}
              >
                Không giới hạn (Mở)
              </button>
              <button
                type="button"
                onClick={() => { setAgeCategory(`u${ageNum || '17'}`); setSaved(false) }}
                className={cn(
                  'px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                  ageType === 'under'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200',
                )}
              >
                Dưới hoặc bằng (U)
              </button>
              <button
                type="button"
                onClick={() => { setAgeCategory(`u${ageNum || '35'}plus`); setSaved(false) }}
                className={cn(
                  'px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                  ageType === 'over'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200',
                )}
              >
                Trở lên (Tuổi+)
              </button>
              <button
                type="button"
                onClick={() => { setAgeCategory(`u${ageNum || '18'}to${ageMaxNum || '30'}`); setSaved(false) }}
                className={cn(
                  'px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                  ageType === 'range'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200',
                )}
              >
                Trong khoảng (Từ - Đến)
              </button>
            </div>

            {ageType === 'range' && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-600 font-medium">Độ tuổi giới hạn:</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">Từ</span>
                  <input
                    type="number"
                    min="5"
                    max="99"
                    value={ageNum}
                    onChange={e => {
                      const num = e.target.value
                      setAgeCategory(`u${num}to${ageMaxNum || '30'}`)
                      setSaved(false)
                    }}
                    placeholder="18"
                    className="w-16 text-center text-sm border border-gray-200 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  />
                  <span className="text-xs text-gray-400">đến</span>
                  <input
                    type="number"
                    min="5"
                    max="99"
                    value={ageMaxNum}
                    onChange={e => {
                      const num = e.target.value
                      setAgeCategory(`u${ageNum || '18'}to${num}`)
                      setSaved(false)
                    }}
                    placeholder="30"
                    className="w-16 text-center text-sm border border-gray-200 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  />
                  <span className="text-sm text-gray-600">tuổi</span>
                </div>
              </div>
            )}

            {(ageType === 'under' || ageType === 'over') && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 font-medium">
                  {ageType === 'under' ? 'Độ tuổi giới hạn (U):' : 'Độ tuổi tối thiểu:'}
                </span>
                <div className="flex items-center gap-1.5">
                  {ageType === 'under' && <span className="text-sm font-bold text-gray-500">U</span>}
                  <input
                    type="number"
                    min="5"
                    max="99"
                    value={ageNum}
                    onChange={e => {
                      const num = e.target.value
                      if (ageType === 'under') {
                        setAgeCategory(num ? `u${num}` : 'open')
                      } else if (ageType === 'over') {
                        setAgeCategory(num ? `u${num}plus` : 'open')
                      }
                      setSaved(false)
                    }}
                    placeholder={ageType === 'under' ? '17' : '35'}
                    className="w-20 text-center text-sm border border-gray-200 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  />
                  {ageType === 'over' && <span className="text-sm font-bold text-gray-500">+</span>}
                </div>
              </div>
            )}

            {ageCategoryHint(ageCategory) && (
              <p className="text-xs text-gray-400">
                VĐV đủ điều kiện: {ageCategoryHint(ageCategory)}
              </p>
            )}
          </div>
        </Section>

        {/* ── SECTION: Custom registration fields ── */}
        <Section icon={ClipboardList} title="Trường đăng ký tùy chỉnh">
          <div className="space-y-3">
            <p className="text-xs text-gray-400">
              Thêm câu hỏi bổ sung cho VĐV khi đăng ký (tối đa 5 trường).
            </p>
            {customFields.map((field, idx) => (
              <CustomFieldRow
                key={field.id}
                field={field}
                onChange={updated => {
                  setCustomFields(prev => prev.map((f, i) => i === idx ? updated : f))
                  setSaved(false)
                }}
                onDelete={() => {
                  setCustomFields(prev => prev.filter((_, i) => i !== idx))
                  setSaved(false)
                }}
              />
            ))}
            {customFields.length < 5 ? (
              <button
                type="button"
                onClick={() => {
                  setCustomFields(prev => [...prev, {
                    id: crypto.randomUUID(),
                    label: '',
                    type: 'text',
                    required: false,
                    options: [],
                  }])
                  setSaved(false)
                }}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium py-1"
              >
                <Plus className="w-4 h-4" />
                Thêm trường tùy chỉnh
              </button>
            ) : (
              <p className="text-xs text-amber-600">Đã đạt giới hạn 5 trường.</p>
            )}
          </div>
        </Section>

        {/* ── SECTION: Courts ── */}
        <Section icon={Grid} title={t('eventSetup.section.courts')}>
          <div className="flex items-center gap-5">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">{t('eventSetup.courts.numCourts')}</p>
              <input
                type="number"
                min="1"
                max="20"
                value={numCourts}
                onChange={e => { setNumCourts(Math.max(1, Number(e.target.value))); setSaved(false) }}
                className="w-20 text-center text-sm border-2 border-gray-200 rounded-lg py-1.5 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <p className="text-xs text-gray-400 pt-5">
              {t('eventSetup.courts.hint')}
            </p>
          </div>
        </Section>

        {/* ── Errors / saved ── */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {saved && !error && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
            <CheckCircle className="w-4 h-4 shrink-0" />
            {t('eventSetup.savedOk')}
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="secondary" onClick={handleSave} loading={saving}>
            {t('eventSetup.saveBtn')}
          </Button>
          <Button onClick={handleSaveAndNext} loading={saving}>
            {t('eventSetup.nextBtn')}
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
