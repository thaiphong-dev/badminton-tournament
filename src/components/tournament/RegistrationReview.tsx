import { useState, useEffect, useCallback } from 'react'
import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle, Filter, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { DISCIPLINE_LABELS, DISCIPLINE_ICONS } from '@/lib/constants'
import { isDoublesDiscipline } from '@/lib/utils/eventHelpers'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils/cn'
import { sendPush } from '@/lib/utils/sendPush'

export default function RegistrationReview({ tournamentId, tournamentName = '' }) {
  const { t } = useI18n()
  const [regs, setRegs]         = useState([])
  const [events, setEvents]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [filterEvent, setFilter] = useState('all')
  const [rejectModal, setRejectModal] = useState(null)  // { regId }
  const [actionId, setActionId] = useState(null)
  const [error, setError]       = useState(null)
  const [limitWarning, setLimitWarning] = useState(null)

  const fetchRegs = useCallback(async () => {
    const [rRes, eRes] = await Promise.all([
      supabase
        .from('tournament_registrations')
        .select(`
          id, status, note, created_at,
          athlete_id, partner_id, partner_name, partner_club,
          events(id, name, discipline, max_teams),
          profiles!athlete_id(id, name, phone, club),
          partner_profile:profiles!partner_id(id, name, club)
        `)
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: true }),
      supabase
        .from('events')
        .select('id, name, discipline, max_teams')
        .eq('tournament_id', tournamentId),
    ])
    setRegs(rRes.data || [])
    setEvents(eRes.data || [])
    setLoading(false)
  }, [tournamentId])

  useEffect(() => { fetchRegs() }, [fetchRegs]) // eslint-disable-line react-hooks/set-state-in-effect

  async function handleApprove(id) {
    setActionId(id)
    setError(null)
    const reg = regs.find(r => r.id === id)
    if (!reg) {
      setActionId(null)
      return
    }

    const event = reg.events
    if (event && event.max_teams !== null) {
      // Query database for current player count of this event
      const { count, error: countErr } = await supabase
        .from('players')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id)

      if (countErr) {
        setError(countErr.message)
        setActionId(null)
        return
      }

      if ((count ?? 0) >= event.max_teams) {
        const label = DISCIPLINE_LABELS[event.discipline] || event.name || ''
        setLimitWarning({
          eventName: label,
          maxTeams: event.max_teams
        })
        setActionId(null)
        return
      }
    }

    const { error: err } = await supabase
      .from('tournament_registrations')
      .update({ status: 'approved' })
      .eq('id', id)
    if (err) {
      setError(err.message)
    } else {
      const reg = regs.find(r => r.id === id)
      if (reg) {
        await createPlayerFromRegistration(reg)
        await supabase.rpc('notify_registration_status', {
          p_athlete_id:      reg.athlete_id,
          p_status:          'approved',
          p_tournament_name: tournamentName,
        })
        sendPush(
          reg.athlete_id,
          t('reg.approvedPush'),
          t('reg.approvedMsg', { name: tournamentName }),
          '/athlete',
        )
      }
      setRegs(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r))
    }
    setActionId(null)
  }

  async function createPlayerFromRegistration(reg) {
    const athlete = reg.profiles
    const event   = reg.events
    if (!athlete || !event) return

    const doubles     = isDoublesDiscipline(event.discipline)
    const partnerName = reg.partner_profile?.name || reg.partner_name || ''
    const playerName  = doubles ? `${athlete.name} / ${partnerName}`.trim() : athlete.name

    const { error } = await supabase
      .from('players')
      .insert({
        tournament_id: tournamentId,
        event_id:      event.id,
        name:          playerName,
        club:          athlete.club || null,
        athlete_id:    reg.athlete_id,
      })
    // Ignore unique-constraint error (already approved once)
    if (error && !error.code?.includes('23505')) {
      console.error('createPlayer error:', error.message)
    }
  }

  async function handleReject(id, reason) {
    setActionId(id)
    setError(null)
    const { error: err } = await supabase
      .from('tournament_registrations')
      .update({ status: 'rejected', note: reason || null })
      .eq('id', id)
    if (err) {
      setError(err.message)
    } else {
      const reg = regs.find(r => r.id === id)
      if (reg) {
        await supabase.rpc('notify_registration_status', {
          p_athlete_id:      reg.athlete_id,
          p_status:          'rejected',
          p_tournament_name: tournamentName,
          p_reject_reason:   reason || null,
        })
        sendPush(
          reg.athlete_id,
          t('reg.rejectedPush'),
          t('reg.rejectedMsg', { name: tournamentName }),
          '/athlete',
        )
      }
      setRegs(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected', note: reason } : r))
    }
    setActionId(null)
    setRejectModal(null)
  }

  const filtered = filterEvent === 'all'
    ? regs
    : regs.filter(r => r.events?.id === filterEvent)

  const pending  = filtered.filter(r => r.status === 'pending')
  const approved = filtered.filter(r => r.status === 'approved')
  const rejected = filtered.filter(r => r.status === 'rejected')

  const pendingTotal = regs.filter(r => r.status === 'pending').length

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Filter + summary */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{regs.length}</span> {t('reg.modal.title').includes('reject') ? 'registrations' : 'đơn'}
            {pendingTotal > 0 && (
              <span className="ml-2 inline-flex items-center bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {t('reg.pendingBadge', { n: pendingTotal })}
              </span>
            )}
          </span>
        </div>

        {events.length > 1 && (
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={filterEvent}
              onChange={e => setFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('reg.allEvents')}</option>
              {events.map(e => (
                <option key={e.id} value={e.id}>
                  {DISCIPLINE_ICONS[e.discipline] ?? '🏸'} {DISCIPLINE_LABELS[e.discipline] ?? e.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-sm text-gray-400">{t('reg.noRegistrations')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <RegGroup
              title={t('reg.status.pending')}
              regs={pending}
              showActions
              actionId={actionId}
              onApprove={handleApprove}
              onReject={id => setRejectModal({ regId: id })}
              t={t}
            />
          )}
          {approved.length > 0 && (
            <RegGroup title={t('reg.status.approved')} regs={approved} t={t} />
          )}
          {rejected.length > 0 && (
            <RegGroup title={t('reg.status.rejected')} regs={rejected} t={t} />
          )}
        </div>
      )}

      {/* Reject reason modal */}
      {rejectModal && (
        <RejectReasonModal
          onConfirm={reason => handleReject(rejectModal.regId, reason)}
          onClose={() => setRejectModal(null)}
          saving={!!actionId}
          t={t}
        />
      )}

      {/* Warning capacity limit modal */}
      {limitWarning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all p-6">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-gray-900">Không thể duyệt</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Nội dung <strong>{limitWarning.eventName}</strong> đã đạt số lượng giới hạn tối đa ({limitWarning.maxTeams} đội/VĐV). Vui lòng nâng giới hạn số đội trong phần Cấu hình giải đấu hoặc từ chối đơn đăng ký.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setLimitWarning(null)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Status config (derived from t()) ─────────────────────────────────────────

function getStatusConfig(status, t) {
  return {
    pending:  { label: t('reg.status.pending'),  color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    approved: { label: t('reg.status.approved'), color: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
    rejected: { label: t('reg.status.rejected'), color: 'bg-red-100 text-red-700',      icon: XCircle },
  }[status] ?? { label: status, color: 'bg-gray-100 text-gray-500', icon: Clock }
}

// ── Reg group ─────────────────────────────────────────────────────────────────

function RegGroup({ title, regs, showActions = false, actionId, onApprove, onReject, t }) {
  const cfg = getStatusConfig(regs[0]?.status, t)
  const Icon = cfg.icon
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color: 'inherit' }} />
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title} ({regs.length})</h3>
      </div>
      <div className="space-y-2">
        {regs.map(r => (
          <RegCard
            key={r.id}
            reg={r}
            showActions={showActions}
            isActing={actionId === r.id}
            onApprove={() => onApprove(r.id)}
            onReject={() => onReject(r.id)}
            t={t}
          />
        ))}
      </div>
    </div>
  )
}

function RegCard({ reg, showActions, isActing, onApprove, onReject, t }) {
  const athlete  = reg.profiles
  const event    = reg.events
  const cfg      = getStatusConfig(reg.status, t)
  const doubles  = event && isDoublesDiscipline(event.discipline)
  const partnerName = reg.partner_profile?.name || reg.partner_name || null
  const partnerClub = reg.partner_profile?.club || reg.partner_club || null

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        {/* Athlete info */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{athlete?.name ?? t('reg.athlete')}</p>
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5 flex-wrap">
            {athlete?.club && <span>{athlete.club}</span>}
            {athlete?.phone && <span>· {athlete.phone}</span>}
          </div>
        </div>

        {/* Event badge */}
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
          {DISCIPLINE_ICONS[event?.discipline] ?? '🏸'} {DISCIPLINE_LABELS[event?.discipline] ?? event?.name}
        </span>
      </div>

      {/* Partner info for doubles */}
      {doubles && partnerName && (
        <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 bg-orange-50 border border-orange-100 rounded-lg">
          <Users className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <div className="text-xs text-gray-700 min-w-0">
            <span className="font-medium">{partnerName}</span>
            {partnerClub && <span className="text-gray-400"> · {partnerClub}</span>}
            {reg.partner_profile && (
              <span className="ml-1 text-green-600">{t('reg.hasAccount')}</span>
            )}
          </div>
        </div>
      )}

      {reg.note && (
        <p className="text-xs text-gray-500 mt-1.5 italic">"{reg.note}"</p>
      )}

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-400">
          {new Date(reg.created_at).toLocaleDateString('vi-VN')}
        </span>

        {showActions ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onReject}
              disabled={isActing}
              className="text-xs text-red-600 hover:text-red-700 font-medium px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
            >
              {t('reg.reject')}
            </button>
            <button
              onClick={onApprove}
              disabled={isActing}
              className="text-xs text-white bg-blue-600 hover:bg-blue-700 font-medium px-3 py-1 rounded-lg transition-colors disabled:opacity-40 flex items-center gap-1"
            >
              {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {t('reg.approve')}
            </button>
          </div>
        ) : (
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cfg.color)}>
            {cfg.label}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Reject reason modal ───────────────────────────────────────────────────────

function RejectReasonModal({ onConfirm, onClose, saving, t }) {
  const [reason, setReason] = useState('')
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
        <h2 className="text-base font-bold text-gray-900 mb-3">{t('reg.modal.title')}</h2>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('reg.modal.reason')} <span className="text-gray-400 font-normal">{t('reg.modal.optional')}</span>
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder={t('reg.modal.placeholder')}
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={saving}
            className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t('reg.modal.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
