import { useEffect, useState, startTransition } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Settings, LayoutList, GitBranch, AlertCircle, CheckCircle,
  ChevronRight, Loader2, Info, ClipboardList, Grid,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { FORMAT_OPTIONS, FORMAT_LABELS } from '@/lib/constants'
import { isValidBracketSize, nextPowerOfTwo } from '@/lib/utils/eventHelpers'
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
function ScoringRuleRow({ label, sets, pointsPerSet, onSetsChange, onPointsChange }) {
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
          <span className="text-xs text-gray-400">điểm / set</span>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EventSetup() {
  const { id: tournamentId, eventId } = useParams()
  const navigate = useNavigate()

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

  function hydrateForm(ev) {
    setFormat(ev.format ?? 'group_then_knockout')
    setNumGroups(ev.num_groups ?? 4)
    setNumFirst(ev.num_first_place_qualify ?? 4)
    setNumSecond(ev.num_second_place_qualify ?? 0)
    setRequirePlayerCode(ev.require_player_code ?? false)
    setAttendanceEnabled(ev.attendance_enabled ?? false)

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
        supabase.from('tournaments').select('id, name').eq('id', tournamentId).single(),
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
      const scoringRules = {
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
          num_groups:                format === 'group_then_knockout' ? Number(numGroups) : null,
          num_first_place_qualify:   format === 'group_then_knockout' ? Number(numFirst)  : null,
          num_second_place_qualify:  format === 'group_then_knockout' ? Number(numSecond) : null,
          scoring_rules:             scoringRules,
          require_player_code:       requirePlayerCode,
          attendance_enabled:        attendanceEnabled,
          num_courts:                Number(numCourts),
        })
        .eq('id', eventId)
      if (err) throw err
      setSaved(true)
    } catch (err) {
      setError(`Lỗi lưu cấu hình: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAndNext() {
    await handleSave()
    navigate(`/tournament/${tournamentId}/event/${eventId}/players`)
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const totalQualify  = Number(numFirst) + Number(numSecond)
  const bracketOk     = format === 'knockout_only' || isValidBracketSize(Number(numFirst), Number(numSecond))
  const suggestedNext = bracketOk ? null : nextPowerOfTwo(totalQualify)

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

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Breadcrumb
        className="mb-6"
        items={[
          { label: 'Trang chủ', href: '/' },
          { label: tournament?.name ?? '…', href: `/tournament/${tournamentId}` },
          { label: event?.name ?? '…', href: `/tournament/${tournamentId}/event/${eventId}/setup` },
          { label: 'Cấu hình' },
        ]}
      />

      {/* Event header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl leading-none">{disciplineIcon}</span>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{event?.name}</h1>
          <p className="text-sm text-gray-400">Cấu hình thể thức & luật thi đấu</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* ── SECTION 1: Format ── */}
        <Section icon={Settings} title="Thể thức tổng">
          <RadioGroup
            options={[
              { value: FORMAT_OPTIONS.GROUP_THEN_KNOCKOUT, label: FORMAT_LABELS.group_then_knockout },
              { value: FORMAT_OPTIONS.KNOCKOUT_ONLY,       label: FORMAT_LABELS.knockout_only       },
            ]}
            value={format}
            onChange={v => { setFormat(v); setSaved(false) }}
          />
        </Section>

        {/* ── SECTION 2: Group config (only for group_then_knockout) ── */}
        {format === FORMAT_OPTIONS.GROUP_THEN_KNOCKOUT && (
          <Section icon={LayoutList} title="Cấu hình vòng bảng">
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Số bảng"
                type="number"
                min="1"
                max="32"
                value={numGroups}
                onChange={e => { setNumGroups(e.target.value); setSaved(false) }}
              />
              <Input
                label="Nhất bảng lấy"
                type="number"
                min="1"
                value={numFirst}
                onChange={e => { setNumFirst(e.target.value); setSaved(false) }}
              />
              <Input
                label="Nhì tốt nhất lấy"
                type="number"
                min="0"
                value={numSecond}
                onChange={e => { setNumSecond(e.target.value); setSaved(false) }}
              />
            </div>

            {/* Bracket size validation */}
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
                ? <span>Tổng vào knockout: <strong>{totalQualify} VĐV</strong> — hợp lệ cho bracket</span>
                : <span>
                    Tổng <strong>{totalQualify}</strong> không phải lũy thừa 2.
                    Gợi ý: lấy <strong>{suggestedNext}</strong> người (hoặc {suggestedNext / 2}) để bracket đều.
                  </span>
              }
            </div>
          </Section>
        )}

        {/* ── SECTION 3: Scoring rules ── */}
        <Section icon={GitBranch} title="Luật thi đấu">
          <div className="space-y-1">
            {format === FORMAT_OPTIONS.GROUP_THEN_KNOCKOUT && (
              <ScoringRuleRow
                label="Vòng bảng"
                sets={gsSet}
                pointsPerSet={gsPts}
                onSetsChange={v => { setGsSet(v); setSaved(false) }}
                onPointsChange={v => { setGsPts(v); setSaved(false) }}
              />
            )}
            <ScoringRuleRow
              label="Knockout (vòng thường)"
              sets={regSet}
              pointsPerSet={regPts}
              onSetsChange={v => { setRegSet(v); setSaved(false) }}
              onPointsChange={v => { setRegPts(v); setSaved(false) }}
            />

            {/* Late-round override toggle */}
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
                  Áp dụng luật khác cho vòng cuối
                </span>
              </label>

              {useLate && (
                <div className="mt-3 pl-11 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-gray-500 shrink-0">Áp dụng từ:</span>
                    <RadioGroup
                      options={[
                        { value: 'quarter',  label: 'Tứ kết'   },
                        { value: 'semi',     label: 'Bán kết'  },
                      ]}
                      value={lateFrom}
                      onChange={v => { setLateFrom(v); setSaved(false) }}
                    />
                  </div>
                  <ScoringRuleRow
                    label="Vòng cuối"
                    sets={lateSet}
                    pointsPerSet={latePts}
                    onSetsChange={v => { setLateSet(v); setSaved(false) }}
                    onPointsChange={v => { setLatePts(v); setSaved(false) }}
                  />
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* ── SECTION: Chế độ chuyên nghiệp ── */}
        <Section icon={Info} title="Chế độ thi đấu">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={requirePlayerCode}
              onClick={() => { setRequirePlayerCode(v => !v); setSaved(false) }}
              className={cn(
                'relative mt-0.5 w-9 h-5 rounded-full transition-colors focus:outline-none shrink-0',
                requirePlayerCode ? 'bg-blue-500' : 'bg-gray-200',
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                requirePlayerCode ? 'translate-x-4' : 'translate-x-0',
              )} />
            </button>
            <div>
              <p className="text-sm font-medium text-gray-700">Giải chuyên nghiệp — yêu cầu mã số VĐV</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {requirePlayerCode
                  ? 'File import phải có cột "Mã số" (CCCD / ID). Dùng mã này làm định danh duy nhất.'
                  : 'Giải phong trào — không cần mã số, nhập tên tự do.'}
              </p>
            </div>
          </label>
        </Section>

        {/* ── SECTION: Điểm danh ── */}
        <Section icon={ClipboardList} title="Điểm danh">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={attendanceEnabled}
              onClick={() => { setAttendanceEnabled(v => !v); setSaved(false) }}
              className={cn(
                'relative mt-0.5 w-9 h-5 rounded-full transition-colors focus:outline-none shrink-0',
                attendanceEnabled ? 'bg-blue-500' : 'bg-gray-200',
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                attendanceEnabled ? 'translate-x-4' : 'translate-x-0',
              )} />
            </button>
            <div>
              <p className="text-sm font-medium text-gray-700">Bật bước điểm danh trước khi thi đấu</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {attendanceEnabled
                  ? 'Các trận đấu sẽ bị khóa cho đến khi VĐV được đánh dấu có mặt. VĐV vắng mặt sẽ bị xử thua W/O ở tất cả các trận của họ.'
                  : 'Tất cả VĐV tự động được coi là có mặt — bỏ qua bước điểm danh.'}
              </p>
            </div>
          </label>
        </Section>

        {/* ── SECTION: Sân đấu ── */}
        <Section icon={Grid} title="Sân đấu">
          <div className="flex items-center gap-5">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Số sân thi đấu</p>
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
              Dùng để lập lịch tự động và hiển thị trên bảng sân đấu
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
            Đã lưu cấu hình thành công
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="secondary" onClick={handleSave} loading={saving}>
            Lưu cấu hình
          </Button>
          <Button onClick={handleSaveAndNext} loading={saving}>
            Tiếp theo: Import VĐV
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
