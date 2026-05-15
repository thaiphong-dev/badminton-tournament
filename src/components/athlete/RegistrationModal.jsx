import { useState } from 'react'
import { X, Loader2, CheckCircle2, AlertCircle, Search, UserCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { DISCIPLINE_LABELS, DISCIPLINE_ICONS } from '@/lib/constants'
import { isDoublesDiscipline } from '@/lib/utils/eventHelpers'
import { cn } from '@/lib/utils/cn'

/**
 * Modal cho athlete đăng ký nội dung trong giải đấu.
 * Doubles events → yêu cầu thông tin partner.
 */
export default function RegistrationModal({ tournament, events, athleteId, existingEventIds, onClose, onSuccess }) {
  const [selected, setSelected]         = useState(new Set())
  const [note, setNote]                 = useState('')
  const [saving, setSaving]             = useState(false)
  const [done, setDone]                 = useState(false)
  const [error, setError]               = useState(null)

  // Partner state (cho doubles)
  const [partnerPhone, setPartnerPhone] = useState('')
  const [partnerSearching, setPartnerSearching] = useState(false)
  const [partnerProfile, setPartnerProfile] = useState(null)  // found profile
  const [partnerNotFound, setPartnerNotFound] = useState(false)
  const [partnerName, setPartnerName]   = useState('')
  const [partnerClub, setPartnerClub]   = useState('')

  const available      = events.filter(e => !existingEventIds.has(e.id))
  const selectedDoubles = [...selected].some(eid => {
    const ev = available.find(e => e.id === eid)
    return ev && isDoublesDiscipline(ev.discipline)
  })
  const needsPartner = selectedDoubles

  function toggleEvent(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setError(null)
  }

  // ── Partner search by phone ──────────────────────────────────────────────────

  async function handleSearchPartner() {
    const digits = partnerPhone.replace(/\D/g, '')
    if (digits.length < 9) { setError('Số điện thoại không hợp lệ (ít nhất 9 chữ số).'); return }
    if (digits === (await getMyPhone())) { setError('Không thể chọn chính mình làm partner.'); return }

    setPartnerSearching(true)
    setPartnerProfile(null)
    setPartnerNotFound(false)
    setError(null)

    const { data } = await supabase
      .from('profiles')
      .select('id, name, club, phone')
      .eq('phone', digits)
      .maybeSingle()

    setPartnerSearching(false)
    if (data) {
      setPartnerProfile(data)
      setPartnerName('')
      setPartnerClub('')
    } else {
      setPartnerNotFound(true)
    }
  }

  async function getMyPhone() {
    const { data } = await supabase.from('profiles').select('phone').eq('id', athleteId).maybeSingle()
    return data?.phone ?? ''
  }

  function clearPartner() {
    setPartnerProfile(null)
    setPartnerNotFound(false)
    setPartnerPhone('')
    setPartnerName('')
    setPartnerClub('')
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (selected.size === 0) return
    setError(null)

    // Validate doubles partner
    if (needsPartner) {
      if (!partnerProfile) {
        const hasManualName = partnerName.trim()
        if (!hasManualName) {
          setError('Vui lòng nhập thông tin partner cho nội dung đôi.')
          return
        }
        if (!partnerClub.trim()) {
          setError('Vui lòng nhập CLB của partner.')
          return
        }
      }
    }

    setSaving(true)
    const inserts = [...selected].map(eventId => {
      const ev = available.find(e => e.id === eventId)
      const doubles = ev && isDoublesDiscipline(ev.discipline)
      return {
        tournament_id: tournament.id,
        event_id:      eventId,
        athlete_id:    athleteId,
        status:        'pending',
        note:          note.trim() || null,
        ...(doubles ? {
          partner_id:   partnerProfile?.id ?? null,
          partner_name: partnerProfile ? null : (partnerName.trim() || null),
          partner_club: partnerProfile ? null : (partnerClub.trim() || null),
        } : {}),
      }
    })

    const { error: err } = await supabase
      .from('tournament_registrations')
      .insert(inserts)

    if (err && !err.message?.includes('unique')) {
      setError('Đã có lỗi xảy ra. Vui lòng thử lại.')
      setSaving(false)
      return
    }

    setDone(true)
    setSaving(false)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900">Đăng ký tham gia</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{tournament.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {done ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="font-semibold text-gray-900 mb-1">Đã gửi đơn đăng ký!</p>
              <p className="text-sm text-gray-500">Ban tổ chức sẽ xem xét và phản hồi sớm nhất.</p>
            </div>
          ) : available.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Bạn đã đăng ký tất cả nội dung của giải này.</p>
            </div>
          ) : (
            <>
              {/* Event selection */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Chọn nội dung tham gia</p>
                <div className="space-y-2">
                  {available.map(e => {
                    const checked  = selected.has(e.id)
                    const doubles  = isDoublesDiscipline(e.discipline)
                    return (
                      <button
                        key={e.id}
                        onClick={() => toggleEvent(e.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors',
                          checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300',
                        )}
                      >
                        <span className="text-xl">{DISCIPLINE_ICONS[e.discipline] ?? '🏸'}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-800 block">
                            {DISCIPLINE_LABELS[e.discipline] ?? e.name}
                          </span>
                          {doubles && (
                            <span className="text-xs text-orange-500">Yêu cầu thông tin partner</span>
                          )}
                        </div>
                        <div className={cn(
                          'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                          checked ? 'border-blue-500 bg-blue-500' : 'border-gray-300',
                        )}>
                          {checked && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Partner section — only when a doubles event is selected */}
              {needsPartner && (
                <div className="border border-orange-200 rounded-xl p-4 bg-orange-50/50 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Thông tin partner 🤝</p>
                    <p className="text-xs text-gray-500 mt-0.5">Bắt buộc cho nội dung đánh đôi</p>
                  </div>

                  {/* Search by phone */}
                  {!partnerProfile && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        Tìm tài khoản partner theo SĐT
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="tel"
                          value={partnerPhone}
                          onChange={e => { setPartnerPhone(e.target.value); setPartnerNotFound(false) }}
                          placeholder="0901234567"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={handleSearchPartner}
                          disabled={partnerSearching}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          {partnerSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                          Tìm
                        </button>
                      </div>

                      {partnerNotFound && (
                        <p className="text-xs text-gray-500 mt-1.5">
                          Không tìm thấy tài khoản. Nhập thủ công bên dưới.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Found partner profile */}
                  {partnerProfile && (
                    <div className="flex items-center gap-3 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl">
                      <UserCheck className="w-5 h-5 text-green-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{partnerProfile.name}</p>
                        <p className="text-xs text-gray-500">{partnerProfile.club || '–'} · {partnerProfile.phone}</p>
                      </div>
                      <button onClick={clearPartner} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Manual partner entry */}
                  {!partnerProfile && (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-600">Hoặc nhập thủ công</label>
                      <input
                        type="text"
                        value={partnerName}
                        onChange={e => setPartnerName(e.target.value)}
                        placeholder="Tên partner *"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={partnerClub}
                        onChange={e => setPartnerClub(e.target.value)}
                        placeholder="CLB / Đội *"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Ghi chú <span className="text-gray-400 font-normal">(tuỳ chọn)</span>
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  placeholder="Thông tin thêm cho ban tổ chức..."
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!done && available.length > 0 && (
          <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex gap-3 shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Huỷ
            </button>
            <button
              onClick={handleSubmit}
              disabled={selected.size === 0 || saving}
              className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Gửi đăng ký
            </button>
          </div>
        )}

        {done && (
          <div className="px-5 pb-5 pt-3 border-t border-gray-100 shrink-0">
            <button
              onClick={onSuccess}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
