import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Trophy, Check, AlertCircle, ExternalLink,
  Upload, X, FileText, Image, Info, ClipboardList, Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { DISCIPLINE_LIST, DEFAULT_EVENT_SCORING_RULES } from '@/lib/constants'
import { useI18n } from '@/i18n'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { cn } from '@/lib/utils/cn'
import { sanitizeAndTrim } from '@/lib/utils/sanitize'

const STEP_LABELS = ['Thông tin giải đấu', 'Nội dung thi đấu', 'Cấu hình thêm']

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-1 mb-8">
      {STEP_LABELS.map((label, idx) => {
        const step   = idx + 1
        const done   = step < current
        const active = step === current
        return (
          <div key={step} className="flex items-center gap-1 flex-1 last:flex-none">
            {idx > 0 && (
              <div className={cn('h-px flex-1 shrink', done ? 'bg-blue-400' : 'bg-gray-200')} />
            )}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                done   && 'bg-blue-500 text-white',
                active && 'bg-blue-600 text-white ring-4 ring-blue-100',
                !done && !active && 'bg-gray-100 text-gray-400',
              )}>
                {done ? <Check className="w-3.5 h-3.5" /> : step}
              </div>
              <span className={cn(
                'text-xs hidden sm:block whitespace-nowrap',
                active ? 'font-semibold text-gray-900' : 'text-gray-400',
              )}>
                {label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Discipline card (selectable + max teams) ──────────────────────────────────
function DisciplineCard({ discipline, selected, disabled, maxTeams, onToggle, onMaxTeamsChange }) {
  return (
    <div className={cn(
      'rounded-xl border-2 transition-all',
      selected  ? 'border-blue-500 bg-blue-50'
      : disabled ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
      : 'border-gray-200 bg-white hover:border-blue-200',
    )}>
      <button
        type="button"
        onClick={() => !disabled && onToggle(discipline.value)}
        disabled={disabled}
        className="relative w-full text-left p-3.5 focus:outline-none"
      >
        {selected && (
          <span className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </span>
        )}
        <span className="text-xl mb-1.5 block leading-none">{discipline.icon}</span>
        <span className={cn('text-xs font-semibold block', selected ? 'text-blue-700' : 'text-gray-700')}>
          {discipline.label}
        </span>
      </button>

      {selected && (
        <div className="px-3 pb-3 -mt-1">
          <input
            type="number"
            min={2}
            max={512}
            placeholder="Số đội (tùy chọn)"
            value={maxTeams ?? ''}
            onChange={e => onMaxTeamsChange(discipline.value, e.target.value ? parseInt(e.target.value) : null)}
            onClick={e => e.stopPropagation()}
            className="w-full px-2.5 py-1.5 text-xs border border-blue-200 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-700 placeholder:text-gray-400"
          />
        </div>
      )}
    </div>
  )
}

// ── File upload widget ────────────────────────────────────────────────────────
function FileUpload({ label, hint, accept, icon: Icon, file, onSelect, onClear, uploading = false }) {
  const ref = useRef(null)
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-1.5">{label}</p>
      {uploading ? (
        <div className="flex items-center gap-2.5 px-3 py-3.5 border border-blue-200 bg-blue-50 rounded-xl">
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
          <span className="text-xs text-blue-600 truncate flex-1 font-medium">Đang tải lên tài liệu...</span>
        </div>
      ) : file ? (
        <div className="flex items-center gap-2.5 px-3 py-2.5 border border-blue-200 bg-blue-50 rounded-xl">
          <Icon className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-xs text-blue-700 truncate flex-1">{file.name}</span>
          <button
            type="button"
            onClick={onClear}
            className="p-0.5 text-blue-400 hover:text-red-500 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="w-full flex items-center gap-2.5 px-3 py-3 border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
        >
          <Upload className="w-4 h-4 text-gray-400 shrink-0" />
          <div>
            <p className="text-xs font-medium text-gray-600">Chọn file</p>
            <p className="text-xs text-gray-400">{hint}</p>
          </div>
        </button>
      )}
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={e => e.target.files?.[0] && onSelect(e.target.files[0])} disabled={uploading} />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TournamentCreate() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { t } = useI18n()
  const [step, setStep] = useState(1)

  // Step 1 fields
  const [name, setName]               = useState('')
  const [location, setLocation]       = useState('')
  const [startDate, setStartDate]     = useState('')
  const [endDate, setEndDate]         = useState('')
  const [regDeadline, setRegDeadline] = useState('')
  const [step1Errors, setStep1Errors] = useState<Record<string, string | null>>({})

  // Step 2 fields
  const [selected, setSelected]       = useState(['mens_singles'])
  const [maxTeamsMap, setMaxTeamsMap] = useState({})  // {discipline: number | null}
  const [selectError, setSelectError] = useState(null)

  // Step 3 fields
  const [prizeStructure, setPrizeStructure]   = useState('')
  const [regulationsFile, setRegulationsFile] = useState(null)
  const [chatQrFile, setChatQrFile]           = useState(null)
  const [requirePlayerCode, setRequirePlayerCode] = useState(false)
  const [attendanceEnabled, setAttendanceEnabled] = useState(false)

  const [maxEvents, setMaxEvents]     = useState(null)
  const [loading, setLoading]         = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    if (!profile?.id) return
    supabase.rpc('get_creator_plan', { p_creator_id: profile.id }).then(({ data }) => {
      setMaxEvents(data?.plan?.max_events ?? null)
    })
  }, [profile?.id])

  function validateStep1() {
    const errs: Record<string, string> = {}
    const trimmed = name.trim()
    if (!trimmed) {
      errs.name = 'Tên giải đấu là bắt buộc'
    } else if (trimmed.length < 3) {
      errs.name = 'Tên giải đấu phải có ít nhất 3 ký tự'
    }
    if (!startDate) {
      errs.startDate = 'Ngày bắt đầu là bắt buộc'
    }
    if (!endDate) {
      errs.endDate = 'Ngày kết thúc là bắt buộc'
    } else if (startDate && endDate < startDate) {
      errs.endDate = 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu'
    }
    if (regDeadline && startDate && regDeadline > startDate) {
      errs.regDeadline = 'Hạn đăng ký phải trước hoặc bằng ngày bắt đầu'
    }
    return errs
  }

  function handleNext1() {
    const errs = validateStep1()
    if (Object.keys(errs).length) { setStep1Errors(errs); return }
    setStep1Errors({})
    setStep(2)
  }

  // ── Step 2 ─────────────────────────────────────────────────────────────────
  function toggleDiscipline(value) {
    setSelectError(null)
    setSelected(prev => {
      if (prev.includes(value)) return prev.length > 1 ? prev.filter(v => v !== value) : prev
      if (maxEvents !== null && prev.length >= maxEvents) {
        setSelectError(t('create.maxEventsError', { max: maxEvents }))
        return prev
      }
      return [...prev, value]
    })
  }

  function handleNext2() {
    if (selected.length === 0) { setSelectError(t('create.selectAtLeastOne')); return }
    setSelectError(null)
    setStep(3)
  }

  // ── Submit (from step 3) ────────────────────────────────────────────────────
  // Requires DB migrations:
  //   ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_deadline date;
  //   ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS prize_structure text;
  //   ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS regulations_url text;
  //   ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS chat_qr_url text;
  //   ALTER TABLE events ADD COLUMN IF NOT EXISTS max_teams int;
  async function handleSubmit() {
    setLoading(true)
    setSubmitError(null)
    try {
      // 1. Check plan limit
      const { data: limitCheck } = await supabase.rpc('check_tournament_limit', {
        p_creator_id: profile?.id,
      })
      if (limitCheck?.allowed === false) {
        setSubmitError(t('create.limitError', {
          plan: limitCheck.plan_slug ?? 'current',
          max: limitCheck.max, current: limitCheck.current,
        }))
        setLoading(false)
        return
      }

      // 2. Create tournament
      const { data: tournament, error: tErr } = await supabase
        .from('tournaments')
        .insert({
          name:                  sanitizeAndTrim(name, 100),
          status:                'setup',
          location:              sanitizeAndTrim(location, 200) || null,
          start_date:            startDate || null,
          end_date:              endDate   || null,
          registration_deadline: regDeadline || null,
          prize_structure:       prizeStructure.trim() || null,
          creator_id:            profile?.id ?? null,
          require_player_code:   requirePlayerCode,
          attendance_enabled:    attendanceEnabled,
        })
        .select()
        .single()
      if (tErr) throw tErr

      // 3. Upload files → get URLs
      let regulationsUrl = null
      let chatQrUrl      = null

      if (regulationsFile) {
        const ext  = regulationsFile.name.split('.').pop()
        const { data: upData, error: upErr } = await supabase.storage
          .from('tournament-assets')
          .upload(`${tournament.id}/regulations.${ext}`, regulationsFile, { upsert: true })
        if (upErr) console.warn('regulations upload failed:', upErr.message)
        else {
          const { data: { publicUrl } } = supabase.storage.from('tournament-assets').getPublicUrl(upData.path)
          regulationsUrl = publicUrl
        }
      }

      if (chatQrFile) {
        const ext  = chatQrFile.name.split('.').pop()
        const { data: upData, error: upErr } = await supabase.storage
          .from('tournament-assets')
          .upload(`${tournament.id}/chat_qr.${ext}`, chatQrFile, { upsert: true })
        if (upErr) console.warn('chat QR upload failed:', upErr.message)
        else {
          const { data: { publicUrl } } = supabase.storage.from('tournament-assets').getPublicUrl(upData.path)
          chatQrUrl = publicUrl
        }
      }

      // 4. Update with file URLs if any
      if (regulationsUrl || chatQrUrl) {
        await supabase.from('tournaments').update({
          regulations_url: regulationsUrl,
          chat_qr_url:     chatQrUrl,
        }).eq('id', tournament.id)
      }

      // 5. Create events with max_teams
      const eventsToInsert = DISCIPLINE_LIST
        .filter(d => selected.includes(d.value))
        .map((d, idx) => ({
          tournament_id:             tournament.id,
          discipline:                d.value,
          name:                      d.label,
          status:                    'setup',
          format:                    'group_then_knockout',
          num_groups:                4,
          num_first_place_qualify:   4,
          num_second_place_qualify:  0,
          scoring_rules:             DEFAULT_EVENT_SCORING_RULES,
          sort_order:                idx,
          max_teams:                 maxTeamsMap[d.value] ?? null,
          require_player_code:       requirePlayerCode,
          attendance_enabled:        attendanceEnabled,
        }))

      const { error: eErr } = await supabase.from('events').insert(eventsToInsert)
      if (eErr) throw eErr

      navigate(`/tournament/${tournament.id}`)
    } catch (err) {
      console.error(err)
      setSubmitError(t('create.createError', { msg: err.message }))
    } finally {
      setLoading(false)
    }
  }

  const atLimit  = maxEvents !== null && selected.length >= maxEvents
  const overLimit = maxEvents !== null && selected.length > maxEvents

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> {t('common.back')}
      </Link>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{t('create.title')}</h1>
            <p className="text-sm text-gray-500">Bước {step}/3</p>
          </div>
        </div>

        <StepIndicator current={step} />

        {/* ── STEP 1: Basic info ── */}
        {step === 1 && (
          <div className="space-y-4">
            <Input
              label={<>{t('create.nameLabel')} <span className="text-red-500">*</span></>}
              placeholder={t('create.namePlaceholder')}
              value={name}
              onChange={e => { setName(e.target.value); setStep1Errors(p => ({ ...p, name: null })) }}
              error={step1Errors.name}
              autoFocus
              maxLength={100}
            />

            <Input
              label={t('create.locationLabel')}
              placeholder={t('create.locationPlaceholder')}
              value={location}
              onChange={e => setLocation(e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={<>{t('create.startDate')} <span className="text-red-500">*</span></>}
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setStep1Errors(p => ({ ...p, startDate: null, regDeadline: null })) }}
                error={step1Errors.startDate}
              />
              <Input
                label={<>{t('create.endDate')} <span className="text-red-500">*</span></>}
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={e => { setEndDate(e.target.value); setStep1Errors(p => ({ ...p, endDate: null })) }}
                error={step1Errors.endDate}
              />
            </div>

            <Input
              label={
                <span className="flex items-center gap-1">
                  Hạn đăng ký
                  <span className="text-xs font-normal text-gray-400">(tùy chọn)</span>
                </span>
              }
              type="date"
              value={regDeadline}
              max={startDate || undefined}
              onChange={e => { setRegDeadline(e.target.value); setStep1Errors(p => ({ ...p, regDeadline: null })) }}
              error={step1Errors.regDeadline}
            />

            {/* Edit-window rules notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700 space-y-0.5">
                <p><strong>Quy định chỉnh sửa:</strong> Sau khi tạo, bạn có thể chỉnh sửa giải đấu tối đa <strong>5 ngày trước ngày bắt đầu</strong>.</p>
                <p>Ngày bắt đầu chỉ có thể thay đổi nếu còn hơn <strong>15 ngày</strong> trước khi khai mạc.</p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button onClick={handleNext1}>
                {t('common.next')} <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Disciplines ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-0.5">{t('create.disciplineTitle')}</h2>
              <p className="text-xs text-gray-400 mb-1">{t('create.disciplineSubtitle')}</p>
              <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                <Info className="w-3 h-3 shrink-0" />
                Nhập số đội tối đa cho từng nội dung để kiểm soát số lượng đăng ký.
              </p>

              {maxEvents !== null && (
                <p className="text-xs text-amber-600 mb-3 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {t('create.planLimit', { max: maxEvents })}{' '}
                  <Link to="/plans" className="underline">{t('create.upgradeLink')}</Link>
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {DISCIPLINE_LIST.map(d => (
                  <DisciplineCard
                    key={d.value}
                    discipline={d}
                    selected={selected.includes(d.value)}
                    disabled={maxEvents !== null && !selected.includes(d.value) && selected.length >= maxEvents}
                    maxTeams={maxTeamsMap[d.value] ?? null}
                    onToggle={toggleDiscipline}
                    onMaxTeamsChange={(disc, val) => setMaxTeamsMap(p => ({ ...p, [disc]: val }))}
                  />
                ))}
              </div>

              {selectError && (
                <div className="flex items-center gap-2 mt-3 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0" />{selectError}
                </div>
              )}

              {overLimit && (
                <div className="flex items-center gap-2 mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Đã vượt giới hạn gói hiện tại ({maxEvents} nội dung). Bạn có thể tiếp tục nhưng hãy cân nhắc nâng cấp.
                </div>
              )}
            </div>

            {selected.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-700">
                {t('create.selected', { n: selected.length })}{' '}
                {DISCIPLINE_LIST.filter(d => selected.includes(d.value)).map(d => d.label).join(' · ')}
              </div>
            )}

            <div className="pt-1 flex items-center justify-between">
              <Button variant="secondary" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4" /> {t('common.back')}
              </Button>
              <Button onClick={handleNext2}>
                {t('common.next')} <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Extra config ── */}
        {step === 3 && (
          <div className="space-y-5">
            {/* Chế độ thi đấu & Điểm danh */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-4">
              {/* Chế độ thi đấu */}
              <div className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <Info className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Chế độ thi đấu</h3>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={requirePlayerCode}
                      onClick={() => setRequirePlayerCode(v => !v)}
                      className={cn(
                        'relative w-9 h-5 rounded-full transition-colors focus:outline-none shrink-0 cursor-pointer',
                        requirePlayerCode ? 'bg-blue-500' : 'bg-gray-200',
                      )}
                    >
                      <span className={cn(
                        'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                        requirePlayerCode ? 'translate-x-4' : 'translate-x-0',
                      )} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 font-medium">
                    Giải chuyên nghiệp — yêu cầu mã số VĐV
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Giải phong trào — không cần mã số, nhập tên tự do.
                  </p>
                </div>
              </div>

              {/* Điểm danh */}
              <div className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                  <ClipboardList className="w-5 h-5 text-red-500" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Điểm danh</h3>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={attendanceEnabled}
                      onClick={() => setAttendanceEnabled(v => !v)}
                      className={cn(
                        'relative w-9 h-5 rounded-full transition-colors focus:outline-none shrink-0 cursor-pointer',
                        attendanceEnabled ? 'bg-blue-500' : 'bg-gray-200',
                      )}
                    >
                      <span className={cn(
                        'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                        attendanceEnabled ? 'translate-x-4' : 'translate-x-0',
                      )} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 font-medium">
                    Bật bắt buộc điểm danh trước khi thi đấu
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Các trận đấu sẽ bị khóa cho đến khi VĐV được đánh dấu có mặt. VĐV vắng mặt sẽ bị xử thua W/O ở tất cả các trận của họ.
                  </p>
                </div>
              </div>
            </div>

            {/* Prize structure */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Cơ cấu giải thưởng
                <span className="text-xs font-normal text-gray-400 ml-1">(tùy chọn)</span>
              </label>
              <textarea
                value={prizeStructure}
                onChange={e => setPrizeStructure(e.target.value)}
                rows={4}
                placeholder={'VD:\nGiải nhất: 10.000.000đ + Cúp\nGiải nhì: 5.000.000đ\nGiải ba: 2.000.000đ'}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-700 placeholder:text-gray-400"
              />
            </div>

            {/* Regulations file */}
            <FileUpload
              label="Điều lệ giải"
              hint="PDF, DOC · Tối đa 10MB"
              accept=".pdf,.doc,.docx"
              icon={FileText}
              file={regulationsFile}
              onSelect={setRegulationsFile}
              onClear={() => setRegulationsFile(null)}
              uploading={loading}
            />

            {/* Chat QR image */}
            <FileUpload
              label="QR nhóm chat"
              hint="PNG, JPG · Tối đa 5MB"
              accept="image/png,image/jpeg,image/webp"
              icon={Image}
              file={chatQrFile}
              onSelect={setChatQrFile}
              onClear={() => setChatQrFile(null)}
              uploading={loading}
            />

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{submitError}</span>
                </div>
                {(submitError.includes('allows') || submitError.includes('chỉ cho phép')) && (
                  <Link to="/plans" className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium text-xs mt-2">
                    <ExternalLink className="w-3 h-3" />{t('create.viewPlans')}
                  </Link>
                )}
              </div>
            )}

            <div className="pt-1 flex items-center justify-between">
              <Button variant="secondary" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4" /> {t('common.back')}
              </Button>
              <Button onClick={handleSubmit} loading={loading}>
                <Trophy className="w-4 h-4" />
                {t('create.submit')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
