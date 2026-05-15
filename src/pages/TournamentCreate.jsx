import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Trophy, Check, AlertCircle, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { DISCIPLINE_LIST, DEFAULT_EVENT_SCORING_RULES } from '@/lib/constants'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { cn } from '@/lib/utils/cn'
import { sanitizeAndTrim } from '@/lib/utils/sanitize'

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current }) {
  const steps = ['Thông tin giải đấu', 'Nội dung thi đấu']
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, idx) => {
        const step  = idx + 1
        const done  = step < current
        const active = step === current
        return (
          <div key={step} className="flex items-center gap-2">
            {idx > 0 && <div className={cn('h-px w-8 sm:w-16 shrink-0', done ? 'bg-blue-500' : 'bg-gray-200')} />}
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
                done   && 'bg-blue-500 text-white',
                active && 'bg-blue-600 text-white ring-4 ring-blue-100',
                !done && !active && 'bg-gray-100 text-gray-400',
              )}>
                {done ? <Check className="w-3.5 h-3.5" /> : step}
              </div>
              <span className={cn(
                'text-sm hidden sm:block',
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

// ── Discipline card (selectable) ──────────────────────────────────────────────
function DisciplineCard({ discipline, selected, disabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onToggle(discipline.value)}
      disabled={disabled}
      className={cn(
        'relative w-full text-left p-4 rounded-xl border-2 transition-all focus:outline-none',
        selected
          ? 'border-blue-500 bg-blue-50'
          : disabled
          ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
          : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-gray-50',
      )}
    >
      {selected && (
        <span className="absolute top-2.5 right-2.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </span>
      )}
      <span className="text-2xl mb-2 block leading-none">{discipline.icon}</span>
      <span className={cn(
        'text-sm font-semibold block',
        selected ? 'text-blue-700' : 'text-gray-700',
      )}>
        {discipline.label}
      </span>
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TournamentCreate() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [step, setStep] = useState(1)

  // Step 1 fields
  const [name, setName]         = useState('')
  const [location, setLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]   = useState('')
  const [nameError, setNameError] = useState(null)

  // Step 2 fields
  const [selected, setSelected] = useState(['mens_singles'])  // at least 1 pre-selected
  const [selectError, setSelectError] = useState(null)

  const [maxEvents, setMaxEvents]  = useState(null) // null = unlimited
  const [loading, setLoading]     = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    if (!profile?.id) return
    supabase.rpc('get_creator_plan', { p_creator_id: profile.id }).then(({ data }) => {
      setMaxEvents(data?.plan?.max_events ?? null)
    })
  }, [profile?.id])

  // ── Step 1 → Step 2 ────────────────────────────────────────────────────────
  function handleNext() {
    if (!name.trim()) {
      setNameError('Tên giải đấu là bắt buộc')
      return
    }
    setNameError(null)
    setStep(2)
  }

  // ── Discipline toggle ──────────────────────────────────────────────────────
  function toggleDiscipline(value) {
    setSelected(prev => {
      if (prev.includes(value)) return prev.filter(v => v !== value)
      if (maxEvents !== null && prev.length >= maxEvents) {
        setSelectError(`Gói của bạn chỉ cho phép tối đa ${maxEvents} nội dung thi đấu`)
        return prev
      }
      return [...prev, value]
    })
    setSelectError(null)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (selected.length === 0) {
      setSelectError('Vui lòng chọn ít nhất 1 nội dung thi đấu')
      return
    }
    if (maxEvents !== null && selected.length > maxEvents) {
      setSelectError(`Gói của bạn chỉ cho phép tối đa ${maxEvents} nội dung thi đấu`)
      return
    }
    setLoading(true)
    setSubmitError(null)
    try {
      // Check tournament limit (ignore RPC errors to avoid blocking on infra issues)
      const { data: limitCheck } = await supabase.rpc('check_tournament_limit', {
        p_creator_id: profile?.id,
      })
      if (limitCheck?.allowed === false) {
        setSubmitError(`Gói ${limitCheck.plan_slug ?? 'hiện tại'} chỉ cho phép ${limitCheck.max} giải đấu active. Bạn đang có ${limitCheck.current} giải.`)
        setLoading(false)
        return
      }

      // 1. Create tournament
      const { data: tournament, error: tErr } = await supabase
        .from('tournaments')
        .insert({
          name:       sanitizeAndTrim(name, 100),
          status:     'setup',
          location:   sanitizeAndTrim(location, 200) || null,
          start_date: startDate || null,
          end_date:   endDate   || null,
          creator_id: profile?.id ?? null,
        })
        .select()
        .single()
      if (tErr) throw tErr

      // 2. Create one event per selected discipline (in display order)
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
        }))

      const { error: eErr } = await supabase.from('events').insert(eventsToInsert)
      if (eErr) throw eErr

      navigate(`/tournament/${tournament.id}`)
    } catch (err) {
      console.error(err)
      setSubmitError(`Không thể tạo giải đấu: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Back */}
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Quay lại
      </Link>

      {/* Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Tạo giải đấu mới</h1>
            <p className="text-sm text-gray-500">Bước {step}/2</p>
          </div>
        </div>

        <StepIndicator current={step} />

        {/* ── STEP 1: Basic info ── */}
        {step === 1 && (
          <div className="space-y-5">
            <Input
              label="Tên giải đấu *"
              placeholder="VD: Giải Cầu Lông Mùa Hè 2026"
              value={name}
              onChange={e => { setName(e.target.value); setNameError(null) }}
              error={nameError}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleNext()}
            />

            <Input
              label="Địa điểm tổ chức"
              placeholder="VD: Nhà thi đấu quận 1, TP.HCM"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Ngày bắt đầu"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
              <Input
                label="Ngày kết thúc"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button onClick={handleNext}>
                Tiếp theo
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Disciplines ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-1">
                Chọn nội dung thi đấu *
              </h2>
              <p className="text-xs text-gray-400 mb-1">
                Có thể chọn nhiều nội dung. Mỗi nội dung sẽ được cấu hình riêng ở bước tiếp theo.
              </p>
              {maxEvents !== null && (
                <p className="text-xs text-amber-600 mb-3">
                  Gói hiện tại cho phép tối đa <strong>{maxEvents}</strong> nội dung/giải.{' '}
                  <Link to="/plans" className="underline">Nâng cấp</Link> để mở thêm.
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {DISCIPLINE_LIST.map(d => (
                  <DisciplineCard
                    key={d.value}
                    discipline={d}
                    selected={selected.includes(d.value)}
                    disabled={maxEvents !== null && !selected.includes(d.value) && selected.length >= maxEvents}
                    onToggle={toggleDiscipline}
                  />
                ))}
              </div>

              {selectError && (
                <div className="flex items-center gap-2 mt-3 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {selectError}
                </div>
              )}
            </div>

            {/* Summary chip */}
            {selected.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-700">
                Đã chọn <strong>{selected.length}</strong> nội dung:{' '}
                {DISCIPLINE_LIST.filter(d => selected.includes(d.value)).map(d => d.label).join(' · ')}
              </div>
            )}

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
                {submitError.includes('chỉ cho phép') && (
                  <Link
                    to="/plans"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium text-xs mt-2"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Xem các gói dịch vụ để nâng cấp
                  </Link>
                )}
              </div>
            )}

            <div className="pt-2 flex items-center justify-between">
              <Button variant="secondary" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4" />
                Quay lại
              </Button>
              <Button onClick={handleSubmit} loading={loading}>
                <Trophy className="w-4 h-4" />
                Tạo giải đấu
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
