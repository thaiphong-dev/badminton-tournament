import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Trophy, Check, AlertCircle, Info, Upload, X, FileText,
  Image, Loader2, Save, Clock, AlertTriangle, Lock, Phone,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { sendPush } from '@/lib/utils/sendPush'
import { cn } from '@/lib/utils/cn'
import { sanitizeAndTrim } from '@/lib/utils/sanitize'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

// ── Edit window helpers ───────────────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return Infinity
  const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(diff / 86400000)
}

// ── File upload widget ────────────────────────────────────────────────────────
function FileUpload({ label, hint, accept, icon: Icon, file, existingUrl, onSelect, onClear }) {
  const ref = useRef(null)
  const hasFile   = !!file
  const hasExisting = !!existingUrl && !file

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-1.5">{label}</p>
      {hasFile ? (
        <div className="flex items-center gap-2.5 px-3 py-2.5 border border-blue-200 bg-blue-50 rounded-xl">
          <Icon className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-xs text-blue-700 truncate flex-1">{file.name}</span>
          <button type="button" onClick={onClear} className="p-0.5 text-blue-400 hover:text-red-500 transition-colors shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : hasExisting ? (
        <div className="flex items-center gap-2.5 px-3 py-2.5 border border-green-200 bg-green-50 rounded-xl">
          <Icon className="w-4 h-4 text-green-500 shrink-0" />
          <span className="text-xs text-green-700 truncate flex-1">Đã có file (nhấn để thay thế)</span>
          <button type="button" onClick={() => ref.current?.click()} className="text-xs text-blue-600 hover:underline shrink-0">
            Thay thế
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
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => e.target.files?.[0] && onSelect(e.target.files[0])} />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TournamentEdit() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const { profile } = useAuth()

  const [tournament, setTournament]   = useState(null)
  const [events, setEvents]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState(null)
  const [saveError, setSaveError]     = useState(null)

  // Editable fields
  const [name, setName]               = useState('')
  const [location, setLocation]       = useState('')
  const [startDate, setStartDate]     = useState('')
  const [endDate, setEndDate]         = useState('')
  const [regDeadline, setRegDeadline] = useState('')
  const [prizeStructure, setPrize]    = useState('')
  const [regulationsFile, setRegFile] = useState(null)
  const [chatQrFile, setQrFile]       = useState(null)
  const [maxTeamsMap, setMaxTeamsMap] = useState({})  // eventId → number | null
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [tRes, eRes] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', id).single(),
        supabase.from('events').select('*').eq('tournament_id', id).order('sort_order'),
      ])
      if (tRes.error) { setError(tRes.error.message); setLoading(false); return }

      const t = tRes.data
      setTournament(t)
      setEvents(eRes.data || [])
      setName(t.name || '')
      setLocation(t.location || '')
      setStartDate(t.start_date || '')
      setEndDate(t.end_date || '')
      setRegDeadline(t.registration_deadline || '')
      setPrize(t.prize_structure || '')
      const mtMap = {}
      for (const ev of eRes.data || []) mtMap[ev.id] = ev.max_teams ?? null
      setMaxTeamsMap(mtMap)
      setLoading(false)
    }
    load()
  }, [id])

  // ── Access control ──────────────────────────────────────────────────────────
  if (!loading && tournament) {
    const isOwner = profile?.id === tournament.creator_id || profile?.role === 'admin'
    if (!isOwner) {
      return (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-600 font-semibold mb-2">Không có quyền truy cập</p>
          <Link to={`/tournament/${id}`} className="text-sm text-blue-600 hover:underline">
            ← Quay lại giải đấu
          </Link>
        </div>
      )
    }
  }

  const days          = daysUntil(tournament?.start_date)
  const canEdit       = days > 5   // locked if ≤ 5 days before start (or no start date set)
  const canEditStart  = days > 15  // can only change start_date if > 15 days out

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate() {
    const errs = {}
    if (!name.trim() || name.trim().length < 3) errs.name = 'Tên giải đấu phải có ít nhất 3 ký tự'
    if (!startDate) errs.startDate = 'Ngày bắt đầu là bắt buộc'
    if (!endDate) errs.endDate = 'Ngày kết thúc là bắt buộc'
    else if (startDate && endDate < startDate) errs.endDate = 'Ngày kết thúc phải sau ngày bắt đầu'
    if (regDeadline && startDate && regDeadline > startDate) errs.regDeadline = 'Hạn đăng ký phải trước ngày bắt đầu'
    return errs
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length) { setFieldErrors(errs); return }
    setFieldErrors({})
    setSaving(true)
    setSaveError(null)

    try {
      // 1. Update tournament — setting info_updated_at signals the DB trigger
      //    to send bell + PWA notifications to all approved athletes
      const { error: tErr } = await supabase
        .from('tournaments')
        .update({
          name:                  sanitizeAndTrim(name, 100),
          location:              sanitizeAndTrim(location, 200) || null,
          start_date:            canEditStart ? (startDate || null) : tournament.start_date,
          end_date:              endDate || null,
          registration_deadline: regDeadline || null,
          prize_structure:       prizeStructure.trim() || null,
          info_updated_at:       new Date().toISOString(),
        })
        .eq('id', id)
      if (tErr) throw tErr

      // 2. Upload new files if provided
      let regulationsUrl = tournament.regulations_url
      let chatQrUrl      = tournament.chat_qr_url

      if (regulationsFile) {
        const ext = regulationsFile.name.split('.').pop()
        const { data: upData, error: upErr } = await supabase.storage
          .from('tournament-assets')
          .upload(`${id}/regulations.${ext}`, regulationsFile, { upsert: true })
        if (upErr) console.warn('regulations upload failed:', upErr.message)
        else {
          const { data: { publicUrl } } = supabase.storage.from('tournament-assets').getPublicUrl(upData.path)
          regulationsUrl = publicUrl
        }
      }

      if (chatQrFile) {
        const ext = chatQrFile.name.split('.').pop()
        const { data: upData, error: upErr } = await supabase.storage
          .from('tournament-assets')
          .upload(`${id}/chat_qr.${ext}`, chatQrFile, { upsert: true })
        if (upErr) console.warn('chat QR upload failed:', upErr.message)
        else {
          const { data: { publicUrl } } = supabase.storage.from('tournament-assets').getPublicUrl(upData.path)
          chatQrUrl = publicUrl
        }
      }

      if (regulationsUrl !== tournament.regulations_url || chatQrUrl !== tournament.chat_qr_url) {
        await supabase.from('tournaments').update({ regulations_url: regulationsUrl, chat_qr_url: chatQrUrl }).eq('id', id)
      }

      // 3. Update event max_teams
      await Promise.all(
        events.map(ev =>
          supabase.from('events').update({ max_teams: maxTeamsMap[ev.id] ?? null }).eq('id', ev.id)
        )
      )

      // Bell notifications for athletes + umpires are sent server-side by
      // the on_tournament_info_update DB trigger. PWA push must be sent
      // client-side because Edge Functions cannot be called from triggers.
      const tournamentName = sanitizeAndTrim(name, 100)
      const [athletesRes, umpiresRes] = await Promise.all([
        supabase
          .from('tournament_registrations')
          .select('athlete_id')
          .eq('tournament_id', id)
          .eq('status', 'approved'),
        supabase
          .from('tournament_umpires')
          .select('umpire_id')
          .eq('tournament_id', id),
      ])

      const pushTitle = 'Giải đấu cập nhật thông tin'
      for (const row of (athletesRes.data ?? [])) {
        sendPush(
          row.athlete_id,
          pushTitle,
          `Ban tổ chức vừa cập nhật thông tin giải ${tournamentName}. Vui lòng kiểm tra lại.`,
          `/tournament/${id}`,
        )
      }
      for (const row of (umpiresRes.data ?? [])) {
        sendPush(
          row.umpire_id,
          pushTitle,
          `Ban tổ chức vừa cập nhật thông tin giải ${tournamentName}. Vui lòng kiểm tra lịch thi đấu.`,
          `/tournament/${id}`,
        )
      }

      navigate(`/tournament/${id}`)
    } catch (err) {
      console.error(err)
      setSaveError(err.message || 'Lỗi khi lưu. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  // ── Render: loading / error ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error || !tournament) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-600">{error || 'Không tìm thấy giải đấu.'}</p>
        <Link to="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline">← Trang chủ</Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Link to={`/tournament/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Quay lại giải đấu
      </Link>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Chỉnh sửa giải đấu</h1>
            <p className="text-sm text-gray-500 truncate">{tournament.name}</p>
          </div>
        </div>

        {/* ── Edit-window rules (always visible) ── */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 space-y-1.5">
          <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0" /> Quy định chỉnh sửa giải đấu
          </p>
          <p className="text-xs text-blue-600">
            • Bạn có thể chỉnh sửa mọi thông tin tối đa <strong>5 ngày trước ngày bắt đầu</strong>.
            Sau thời hạn này, vui lòng liên hệ admin để được hỗ trợ.
          </p>
          <p className="text-xs text-blue-600">
            • <strong>Ngày bắt đầu giải đấu</strong> chỉ có thể thay đổi nếu còn hơn <strong>15 ngày</strong> trước khi khai mạc.
          </p>
        </div>

        {/* ── Locked banner ── */}
        {!canEdit && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">Đã hết hạn chỉnh sửa</p>
                <p className="text-xs text-red-500 mt-0.5">
                  Giải đấu sẽ bắt đầu trong {days <= 0 ? 'hôm nay hoặc đã bắt đầu' : `${days} ngày nữa`}.
                  Bạn không thể chỉnh sửa trong giai đoạn này.
                  Nếu có vấn đề cần giải quyết, vui lòng liên hệ admin.
                </p>
                <a
                  href="mailto:admin@badminton.app"
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline mt-1.5 font-medium"
                >
                  <Phone className="w-3 h-3" /> Liên hệ admin
                </a>
              </div>
            </div>
          </div>
        )}

        {canEdit && (
          <div className="space-y-5">
            {/* ── Tournament info ── */}
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">
                Thông tin giải đấu
              </h2>
              <div className="space-y-4">
                <Input
                  label={<>Tên giải đấu <span className="text-red-500">*</span></>}
                  value={name}
                  onChange={e => { setName(e.target.value); setFieldErrors(p => ({ ...p, name: null })) }}
                  error={fieldErrors.name}
                  maxLength={100}
                />

                <Input
                  label="Địa điểm thi đấu"
                  placeholder="Nhà thi đấu ABC, TP. Hồ Chí Minh"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Input
                      label={
                        <span className="flex items-center gap-1">
                          Ngày bắt đầu <span className="text-red-500">*</span>
                          {!canEditStart && (
                            <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-medium">
                              Khóa ({days} ngày)
                            </span>
                          )}
                        </span>
                      }
                      type="date"
                      value={startDate}
                      disabled={!canEditStart}
                      onChange={e => { setStartDate(e.target.value); setFieldErrors(p => ({ ...p, startDate: null })) }}
                      error={fieldErrors.startDate}
                    />
                    {!canEditStart && (
                      <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 shrink-0" />
                        Cần &gt;15 ngày để thay đổi ngày khai mạc
                      </p>
                    )}
                  </div>
                  <Input
                    label={<>Ngày kết thúc <span className="text-red-500">*</span></>}
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={e => { setEndDate(e.target.value); setFieldErrors(p => ({ ...p, endDate: null })) }}
                    error={fieldErrors.endDate}
                  />
                </div>

                <Input
                  label={
                    <span className="flex items-center gap-1">
                      Hạn đăng ký <span className="text-xs font-normal text-gray-400">(tùy chọn)</span>
                    </span>
                  }
                  type="date"
                  value={regDeadline}
                  max={startDate || undefined}
                  onChange={e => { setRegDeadline(e.target.value); setFieldErrors(p => ({ ...p, regDeadline: null })) }}
                  error={fieldErrors.regDeadline}
                />
              </div>
            </section>

            {/* ── Nội dung thi đấu (max_teams only) ── */}
            {events.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">
                  Số đội tối đa mỗi nội dung
                </h2>
                <div className="space-y-2.5">
                  {events.map(ev => (
                    <div key={ev.id} className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 flex-1">
                        {ev.name || ev.discipline}
                      </span>
                      <input
                        type="number"
                        min={2}
                        max={512}
                        placeholder="Không giới hạn"
                        value={maxTeamsMap[ev.id] ?? ''}
                        onChange={e => setMaxTeamsMap(p => ({
                          ...p,
                          [ev.id]: e.target.value ? parseInt(e.target.value) : null,
                        }))}
                        className="w-32 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-700 placeholder:text-gray-400"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Cơ cấu + tài liệu ── */}
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">
                Giải thưởng & Tài liệu
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Cơ cấu giải thưởng <span className="text-xs font-normal text-gray-400">(tùy chọn)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={prizeStructure}
                    onChange={e => setPrize(e.target.value)}
                    placeholder="VD: Vô địch: 5.000.000đ / Á quân: 3.000.000đ …"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  />
                </div>

                <FileUpload
                  label="Điều lệ giải đấu (PDF)"
                  hint="PDF, tối đa 10MB"
                  accept=".pdf"
                  icon={FileText}
                  file={regulationsFile}
                  existingUrl={tournament.regulations_url}
                  onSelect={setRegFile}
                  onClear={() => setRegFile(null)}
                />

                <FileUpload
                  label="QR nhóm chat"
                  hint="JPG / PNG / WEBP, tối đa 5MB"
                  accept="image/*"
                  icon={Image}
                  file={chatQrFile}
                  existingUrl={tournament.chat_qr_url}
                  onSelect={setQrFile}
                  onClear={() => setQrFile(null)}
                />
              </div>
            </section>

            {/* ── Notification warning ── */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Sau khi lưu, tất cả vận động viên đã được duyệt sẽ nhận được thông báo về việc giải đấu cập nhật thông tin.
              </p>
            </div>

            {/* ── Error ── */}
            {saveError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {saveError}
              </div>
            )}

            {/* ── Actions ── */}
            <div className="flex items-center justify-between pt-2">
              <Button variant="secondary" onClick={() => navigate(`/tournament/${id}`)}>
                <ArrowLeft className="w-4 h-4" /> Huỷ
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang lưu…</>
                  : <><Save className="w-4 h-4" /> Lưu thay đổi</>
                }
              </Button>
            </div>
          </div>
        )}

        {!canEdit && (
          <div className="mt-4 flex justify-center">
            <Link
              to={`/tournament/${id}`}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
            >
              <ArrowLeft className="w-4 h-4" /> Quay lại giải đấu
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
