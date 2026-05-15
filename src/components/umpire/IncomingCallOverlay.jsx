import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, X, Feather } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import useCallStore from '@/lib/stores/callStore'

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
    setCountdown(COUNTDOWN_TOTAL) // eslint-disable-line react-hooks/set-state-in-effect
    setDeclining(false)
    setDeclineNote('')
    setLoading(false)
  }, [incomingCall?.matchId])

  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (!incomingCall) return
    const stop = createRingtone()
    return () => stop()
  }, [incomingCall?.matchId])

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
    if (countdown <= 0) { handleDecline('timeout'); return } // eslint-disable-line react-hooks/set-state-in-effect
    const t = setInterval(() => setCountdown(c => c - 1), 1000)
    return () => clearInterval(t)
  }, [countdown, incomingCall, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!incomingCall) return null

  const { matchLabel, matchNumber, player1Name, player2Name } = incomingCall
  const offset = C * (1 - countdown / COUNTDOWN_TOTAL)
  const urgent = countdown <= 30

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(160deg, #0a0f1a 0%, #0d1627 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Feather size={18} color="#22d3ee" />
        </div>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.08em' }}>
          PHÂN CÔNG TRỌNG TÀI
        </p>
      </div>

      {/* Stage badge */}
      {matchLabel && (
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.18)',
          borderRadius: 99, padding: '3px 12px', marginBottom: 20,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#22d3ee', letterSpacing: '0.06em' }}>
            {matchLabel.toUpperCase()}
          </span>
        </div>
      )}

      {/* Match card */}
      <div style={{
        background: '#111827', borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.07)',
        width: '100%', maxWidth: 340,
        overflow: 'hidden', marginBottom: 28,
      }}>
        {/* Match number bar */}
        {matchNumber && (
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '8px 20px', textAlign: 'center',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>
              {matchNumber.toUpperCase()}
            </span>
          </div>
        )}

        {/* Players row */}
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {/* Player 1 */}
          <div style={{
            flex: 1, padding: '22px 16px', textAlign: 'center',
            borderRight: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'rgba(34,211,238,0.6)',
              letterSpacing: '0.1em', marginBottom: 8,
            }}>BÊN A</div>
            <p style={{
              fontSize: player1Name?.length > 16 ? 13 : 15,
              fontWeight: 800, color: '#e2e8f0', lineHeight: 1.3,
              wordBreak: 'break-word',
            }}>{player1Name}</p>
          </div>

          {/* VS divider */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', minWidth: 40,
          }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.05em' }}>
              VS
            </span>
          </div>

          {/* Player 2 */}
          <div style={{
            flex: 1, padding: '22px 16px', textAlign: 'center',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'rgba(251,191,36,0.6)',
              letterSpacing: '0.1em', marginBottom: 8,
            }}>BÊN B</div>
            <p style={{
              fontSize: player2Name?.length > 16 ? 13 : 15,
              fontWeight: 800, color: '#e2e8f0', lineHeight: 1.3,
              wordBreak: 'break-word',
            }}>{player2Name}</p>
          </div>
        </div>
      </div>

      {/* Countdown ring */}
      <div style={{ position: 'relative', width: 90, height: 90, marginBottom: 32 }}>
        <svg width="90" height="90" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="45" cy="45" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <circle
            cx="45" cy="45" r={R} fill="none"
            stroke={urgent ? '#ef4444' : '#22d3ee'} strokeWidth="6"
            strokeDasharray={C} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'monospace', color: urgent ? '#ef4444' : '#fff' }}>
            {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Decline flow */}
      {declining ? (
        <div style={{ width: '100%', maxWidth: 320 }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 12, textAlign: 'center' }}>
            Lý do từ chối (tuỳ chọn)
          </p>
          <input
            value={declineNote}
            onChange={e => setDeclineNote(e.target.value)}
            placeholder="Nhập lý do..."
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 14, boxSizing: 'border-box',
              background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', fontSize: 14, marginBottom: 12, outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setDeclining(false)} disabled={loading} style={{
              flex: 1, padding: '14px 0', borderRadius: 14,
              background: 'rgba(255,255,255,0.06)', color: '#fff',
              border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14,
            }}>
              Quay lại
            </button>
            <button onClick={() => handleDecline('declined')} disabled={loading} style={{
              flex: 1, padding: '14px 0', borderRadius: 14,
              background: '#b91c1c', color: '#fff',
              border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: 14,
            }}>
              Xác nhận
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 300 }}>
          {/* Accept */}
          <button
            onClick={handleAccept}
            disabled={loading}
            style={{
              flex: 1, padding: '16px 0', borderRadius: 16, border: 'none',
              cursor: loading ? 'default' : 'pointer',
              background: loading ? '#14532d' : '#15803d',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              boxShadow: loading ? 'none' : '0 0 24px rgba(21,128,61,0.45)',
              transition: 'background 0.2s, box-shadow 0.2s',
            }}
          >
            <Check size={22} color="#fff" strokeWidth={3} />
            <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.05em' }}>
              NHẬN NHIỆM VỤ
            </span>
          </button>

          {/* Decline */}
          <button
            onClick={() => setDeclining(true)}
            disabled={loading}
            style={{
              flex: 1, padding: '16px 0', borderRadius: 16,
              cursor: loading ? 'default' : 'pointer',
              background: 'rgba(185,28,28,0.25)', border: '1px solid rgba(185,28,28,0.4)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}
          >
            <X size={22} color="#f87171" strokeWidth={3} />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#f87171', letterSpacing: '0.05em' }}>
              TỪ CHỐI
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
