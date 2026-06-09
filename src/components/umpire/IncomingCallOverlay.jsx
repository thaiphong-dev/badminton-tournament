import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, X, Feather } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import useCallStore from '@/lib/stores/callStore'
import { cn } from '@/lib/utils/cn'

const COUNTDOWN_TOTAL = 180
const R = 36
const C = 2 * Math.PI * R

function createRingtone() {
  let stopped = false
  let ctx

  async function ring() {
    if (stopped) return
    for (const freq of [880, 1100]) {
      if (stopped) break
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.12)
      await new Promise(r => setTimeout(r, 150))
    }
    await new Promise(r => setTimeout(r, 1000))
    ring()
  }

  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    ring()
  } catch (e) {
    console.warn('[IncomingCallOverlay] Audio unavailable:', e)
  }

  return function stop() {
    stopped = true
    try { ctx?.close() } catch { /* noop */ }
  }
}

export default function IncomingCallOverlay() {
  const navigate = useNavigate()
  const { incomingCall, clearIncomingCall } = useCallStore()

  const [countdown,   setCountdown]   = useState(COUNTDOWN_TOTAL)
  const [declining,   setDeclining]   = useState(false)
  const [declineNote, setDeclineNote] = useState('')
  const [loading,     setLoading]     = useState(false)

  useEffect(() => {
    setCountdown(COUNTDOWN_TOTAL)
    setDeclining(false)
    setDeclineNote('')
    setLoading(false)
  }, [incomingCall?.matchId])

  useEffect(() => {
    if (!incomingCall) return
    const stop = createRingtone()
    return () => stop()
  }, [incomingCall?.matchId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAccept() {
    if (!incomingCall) return
    setLoading(true)
    const now = new Date().toISOString()
    await supabase.from('matches').update({ status: 'active', call_ended_at: now }).eq('id', incomingCall.matchId)
    await supabase.from('match_call_logs')
      .update({ response: 'accepted', responded_at: now })
      .eq('match_id', incomingCall.matchId)
      .is('responded_at', null)
    clearIncomingCall()
    navigate(`/umpire/match/${incomingCall.matchId}`)
  }

  async function handleDecline(reason = 'declined') {
    if (!incomingCall) return
    setLoading(true)
    const now = new Date().toISOString()
    await supabase.from('matches').update({ status: 'pending', call_ended_at: now }).eq('id', incomingCall.matchId)
    await supabase.from('match_call_logs')
      .update({
        response:     reason,
        responded_at: now,
        decline_note: reason === 'declined' ? (declineNote || null) : null,
      })
      .eq('match_id', incomingCall.matchId)
      .is('responded_at', null)
    clearIncomingCall()
    setDeclining(false)
    setDeclineNote('')
  }

  useEffect(() => {
    if (!incomingCall || loading) return
    if (countdown <= 0) { handleDecline('timeout'); return }
    const t = setInterval(() => setCountdown(c => c - 1), 1000)
    return () => clearInterval(t)
  }, [countdown, incomingCall, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!incomingCall) return null

  const { matchLabel, matchNumber, player1Name, player2Name } = incomingCall
  const offset = C * (1 - countdown / COUNTDOWN_TOTAL)
  const urgent = countdown <= 30

  return (
    <div className="fixed inset-0 z-[9999] bg-surface flex flex-col items-center justify-center px-6">

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
          <Feather size={18} className="text-blue-600" />
        </div>
        <p className="text-sm font-bold text-gray-500 tracking-widest uppercase">
          Phân công trọng tài
        </p>
      </div>

      {/* Stage badge */}
      {matchLabel && (
        <div className="inline-flex items-center bg-blue-50 border border-blue-200 rounded-full px-3 py-1 mb-5">
          <span className="text-xs font-bold text-blue-600 tracking-wide uppercase">
            {matchLabel}
          </span>
        </div>
      )}

      {/* Match card */}
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-7">
        {matchNumber && (
          <div className="bg-gray-50 border-b border-gray-100 px-5 py-2 text-center">
            <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">
              {matchNumber}
            </span>
          </div>
        )}
        <div className="flex items-stretch">
          {/* Player 1 */}
          <div className="flex-1 px-4 py-5 text-center border-r border-gray-100">
            <div className="text-[10px] font-bold text-blue-500 tracking-widest mb-2 uppercase">Bên A</div>
            <p className={cn('font-extrabold text-gray-900 leading-snug break-words', player1Name?.length > 16 ? 'text-sm' : 'text-base')}>
              {player1Name}
            </p>
          </div>
          {/* VS */}
          <div className="flex items-center justify-center px-1 min-w-[36px]">
            <span className="text-xs font-black text-gray-300">VS</span>
          </div>
          {/* Player 2 */}
          <div className="flex-1 px-4 py-5 text-center border-l border-gray-100">
            <div className="text-[10px] font-bold text-amber-500 tracking-widest mb-2 uppercase">Bên B</div>
            <p className={cn('font-extrabold text-gray-900 leading-snug break-words', player2Name?.length > 16 ? 'text-sm' : 'text-base')}>
              {player2Name}
            </p>
          </div>
        </div>
      </div>

      {/* Countdown ring */}
      <div className="relative w-[90px] h-[90px] mb-8">
        <svg width="90" height="90" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="45" cy="45" r={R} fill="none" stroke="#e5e7eb" strokeWidth="6" />
          <circle
            cx="45" cy="45" r={R} fill="none"
            stroke={urgent ? '#ef4444' : '#2563eb'} strokeWidth="6"
            strokeDasharray={C} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('text-xl font-black font-mono', urgent ? 'text-red-500' : 'text-gray-800')}>
            {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Decline flow */}
      {declining ? (
        <div className="w-full max-w-xs">
          <p className="text-sm text-gray-400 mb-3 text-center">Lý do từ chối (tuỳ chọn)</p>
          <input
            value={declineNote}
            onChange={e => setDeclineNote(e.target.value)}
            placeholder="Nhập lý do..."
            className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white outline-none focus:border-blue-400 mb-3"
          />
          <div className="flex gap-2.5">
            <button
              onClick={() => setDeclining(false)}
              disabled={loading}
              className="flex-1 py-3.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 transition-colors"
            >
              Quay lại
            </button>
            <button
              onClick={() => handleDecline('declined')}
              disabled={loading}
              className="flex-1 py-3.5 rounded-xl bg-red-600 text-white font-extrabold text-sm hover:bg-red-700 transition-colors"
            >
              Xác nhận
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 w-full max-w-[300px]">
          {/* Accept */}
          <button
            onClick={handleAccept}
            disabled={loading}
            className="flex-1 flex flex-col items-center gap-1.5 py-4 rounded-2xl bg-green-600 hover:bg-green-700 disabled:bg-green-300 transition-colors shadow-lg shadow-green-200"
          >
            <Check size={22} className="text-white" strokeWidth={3} />
            <span className="text-[11px] font-extrabold text-white tracking-wide uppercase">
              Nhận nhiệm vụ
            </span>
          </button>

          {/* Decline */}
          <button
            onClick={() => setDeclining(true)}
            disabled={loading}
            className="flex-1 flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
          >
            <X size={22} className="text-red-500" strokeWidth={3} />
            <span className="text-[11px] font-extrabold text-red-500 tracking-wide uppercase">
              Từ chối
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
