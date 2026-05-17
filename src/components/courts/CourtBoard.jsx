import { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { Play, Zap, X, Pencil, ArrowLeftRight, Trash2, PlusCircle, ChevronLeft, ChevronRight, ShieldCheck, PhoneOff, Clock, AlertTriangle, PhoneCall, RotateCcw, WifiOff, Phone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useBTCRealtime } from '@/lib/hooks/useBTCRealtime'
import { showToast } from '@/lib/hooks/useApiError'
import { cn } from '@/lib/utils/cn'
import { generateSchedule, formatWaveTime } from '@/lib/utils/courtScheduler'
import { sendPush } from '@/lib/utils/sendPush'
import Button from '@/components/ui/Button'
import ScoreModal from '@/components/shared/ScoreModal'

export default function CourtBoard({ event, matches, playerMap, scoringRules, onMatchUpdated, onRefresh, umpireMap = {}, onAssignUmpire = null, tournamentId, onExternalMatchUpdate = null }) {
  const { profile } = useAuth()
  const numCourts = event?.num_courts ?? 2

  const [scoreMatch,       setScoreMatch]       = useState(null)
  const [schedulePreview,  setSchedulePreview]  = useState(null)
  const [applying,         setApplying]         = useState(false)
  const [editingCourtNum,  setEditingCourtNum]  = useState(null)
  const [callingMatchIds,  setCallingMatchIds]  = useState(new Set()) // Set<matchId> — 1 BTC có thể gọi nhiều sân cùng lúc
  const [liveStats,        setLiveStats]        = useState({})   // { [matchId]: match_stats row }
  const [shuttleQueue,     setShuttleQueue]     = useState([])   // [{ courtNumber, umpireName }, ...]
  const [now,              setNow]              = useState(() => Date.now())
  const [callAthleteModal, setCallAthleteModal] = useState(null) // { results, courtNum } | null
  const seenShuttleRef = useRef(new Set())                       // dedup: "${matchId}_${timestamp}"

  // Tick every 15 s — quarter of heartbeat interval for responsive staleness display
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])

  function playShuttleBeep() {
    try {
      const AudioCtx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext
      const ctx = new AudioCtx()
      const beep = (freq, startTime) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.35, startTime)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12)
        osc.start(startTime)
        osc.stop(startTime + 0.12)
      }
      const t = ctx.currentTime
      beep(880, t)
      beep(660, t + 0.18)
      setTimeout(() => { try { ctx.close() } catch { /* noop */ } }, 600)
    } catch { /* browser không support AudioContext */ }
  }

  // Box callingMatchIds into ref so useBTCRealtime callback never goes stale
  const callingRef = useRef(callingMatchIds)
  useLayoutEffect(() => { callingRef.current = callingMatchIds })

  // ── BTC Realtime ───────────────────────────────────────────────────────────

  const handleStatsUpdate = useCallback((updatedStats) => {
    if (!updatedStats?.match_id) return
    setLiveStats(prev => ({ ...prev, [updatedStats.match_id]: updatedStats }))
  }, [])

  const handleMatchUpdate = useCallback((updatedMatch) => {
    onMatchUpdated(updatedMatch)
    onExternalMatchUpdate?.(updatedMatch)
    const calling = callingRef.current

    if (updatedMatch.status === 'active' && calling.has(updatedMatch.id)) {
      setCallingMatchIds(prev => { const s = new Set(prev); s.delete(updatedMatch.id); return s })
      showToast('✓ Trọng tài đã vào sân — Trận đang bắt đầu', 'success')
    }
    if (updatedMatch.status === 'pending' && calling.has(updatedMatch.id) && updatedMatch.call_ended_at) {
      setCallingMatchIds(prev => { const s = new Set(prev); s.delete(updatedMatch.id); return s })
      showToast('⚠ Trọng tài từ chối — Vui lòng thử lại', 'warning')
    }
    if (updatedMatch.status === 'completed') {
      const label = updatedMatch.match_number ? `Trận ${updatedMatch.match_number}` : 'Trận'
      showToast(`✓ ${label} đã kết thúc`, 'success')
    }

    // Shuttle request: chỉ xử lý nếu request mới (< 5 phút) và chưa seen
    if (updatedMatch.shuttle_request_at) {
      const key = `${updatedMatch.id}_${updatedMatch.shuttle_request_at}`
      const ageMs = Date.now() - new Date(updatedMatch.shuttle_request_at).getTime()
      if (ageMs < 300_000 && !seenShuttleRef.current.has(key)) {
        seenShuttleRef.current.add(key)
        setShuttleQueue(prev => {
          if (prev.length === 0) playShuttleBeep()
          return [...prev, {
            matchId:     updatedMatch.id,
            courtNumber: updatedMatch.court_number,
            umpireName:  umpireMap[updatedMatch.umpire_id]?.name ?? 'Trọng tài',
          }]
        })
      }
    }
  }, [onMatchUpdated, onExternalMatchUpdate, umpireMap])

  useBTCRealtime(tournamentId, handleMatchUpdate, handleStatsUpdate, '-board')

  // ── Wave analysis ──────────────────────────────────────────────────────────
  const scheduledMatches = useMemo(
    () => matches.filter(m => m.wave_number != null),
    [matches],
  )
  const pendingUnscheduled = useMemo(
    () => matches.filter(m => m.wave_number == null && m.status === 'pending'),
    [matches],
  )

  const allWaves = useMemo(() => {
    const nums = [...new Set(scheduledMatches.map(m => m.wave_number))].sort((a, b) => a - b)
    return nums
  }, [scheduledMatches])

  const activeWave = useMemo(() => {
    const w = allWaves.find(w => scheduledMatches.some(m => m.wave_number === w && m.status !== 'completed'))
    return w ?? allWaves[allWaves.length - 1] ?? 1
  }, [allWaves, scheduledMatches])

  const [selectedWave, setSelectedWave] = useState(null)
  const effectiveWave = selectedWave ?? activeWave

  useEffect(() => { setEditingCourtNum(null) }, [effectiveWave]) // eslint-disable-line react-hooks/set-state-in-effect

  const courtSlots = useMemo(
    () => Array.from({ length: numCourts }, (_, i) => {
      const courtNum = i + 1
      return scheduledMatches.find(m => m.wave_number === effectiveWave && m.court_number === courtNum) ?? null
    }),
    [scheduledMatches, effectiveWave, numCourts],
  )

  // ── Edit operations ────────────────────────────────────────────────────────

  async function handleUnschedule(matchId) {
    if (!window.confirm('Bỏ trận này khỏi lịch? Trận sẽ trở về danh sách chưa lập lịch.')) return
    const { data: updated, error } = await supabase
      .from('matches')
      .update({ court_number: null, wave_number: null })
      .eq('id', matchId)
      .select()
      .single()
    if (!error) { onMatchUpdated(updated); setEditingCourtNum(null) }
    else console.error('handleUnschedule:', error)
  }

  async function handleSwapCourts(matchA, matchB) {
    const [rA, rB] = await Promise.all([
      supabase.from('matches').update({ court_number: matchB.court_number }).eq('id', matchA.id).select().single(),
      supabase.from('matches').update({ court_number: matchA.court_number }).eq('id', matchB.id).select().single(),
    ])
    if (!rA.error) onMatchUpdated(rA.data)
    if (!rB.error) onMatchUpdated(rB.data)
    setEditingCourtNum(null)
  }

  async function handleAssignToSlot(unscheduledMatchId, courtNum, waveNum) {
    const { data: updated, error } = await supabase
      .from('matches')
      .update({ court_number: courtNum, wave_number: waveNum })
      .eq('id', unscheduledMatchId)
      .select()
      .single()
    if (!error) { onMatchUpdated(updated); setEditingCourtNum(null) }
    else console.error('handleAssignToSlot:', error)
  }

  // ── Match start / calling flow ─────────────────────────────────────────────

  async function handleStartMatch(match, courtNum) {
    if (!match.umpire_id) {
      // No umpire assigned — start immediately as before
      const { data: updated, error } = await supabase
        .from('matches')
        .update({ status: 'active', court_number: courtNum, started_at: new Date().toISOString() })
        .eq('id', match.id)
        .select()
        .single()
      if (!error) onMatchUpdated(updated)
      else console.error('handleStartMatch:', error)
      return
    }

    // Umpire assigned — use calling flow (nhiều sân có thể gọi cùng lúc)
    setCallingMatchIds(prev => new Set([...prev, match.id]))
    const now = new Date().toISOString()
    const [matchRes] = await Promise.all([
      supabase.from('matches')
        .update({ status: 'calling', call_started_at: now, court_number: courtNum })
        .eq('id', match.id)
        .select()
        .single(),
      supabase.from('match_call_logs').insert({
        match_id:  match.id,
        called_by: profile?.id ?? null,
        umpire_id: match.umpire_id,
      }),
    ])
    if (matchRes.data) onMatchUpdated(matchRes.data)
    if (matchRes.error) {
      console.error('handleStartMatch (calling):', matchRes.error)
      setCallingMatchIds(prev => { const s = new Set(prev); s.delete(match.id); return s })
      return
    }

    // Push notification to umpire — best-effort, does not block if they have no subscription
    sendPush(
      match.umpire_id,
      '📞 Vào sân ngay!',
      `Sân ${courtNum} đang gọi bạn vào điều hành.`,
      `/umpire/match/${match.id}`,
    )
  }

  async function handleCancelCall(matchId) {
    const now = new Date().toISOString()
    await Promise.all([
      supabase.from('matches').update({ status: 'pending', call_ended_at: now }).eq('id', matchId),
      supabase.from('match_call_logs')
        .update({ response: 'cancelled', responded_at: now })
        .eq('match_id', matchId)
        .is('responded_at', null),
    ])
    setCallingMatchIds(prev => { const s = new Set(prev); s.delete(matchId); return s })
  }

  function handleMatchSaved(updatedMatch) {
    onMatchUpdated(updatedMatch)
    setScoreMatch(null)
  }

  async function handleRecall(match, courtNum) {
    // Set status back to 'calling' so:
    // - umpires with app open → realtime fires the calling overlay immediately
    // - umpires who reopen the app → see calling state on their match list
    const now = new Date().toISOString()
    const { data: updated } = await supabase
      .from('matches')
      .update({ status: 'calling', call_started_at: now })
      .eq('id', match.id)
      .select()
      .single()
    if (updated) onMatchUpdated(updated)

    // Push notification for browsers running in the background
    sendPush(
      match.umpire_id,
      '📞 Vào sân ngay!',
      `BTC đang gọi bạn quay lại sân ${courtNum} — trận vẫn đang tiếp diễn.`,
      `/umpire/match/${match.id}`,
    )
    showToast('Đã gọi lại trọng tài', 'success')
  }

  async function handleCallAthletes(match, courtNum) {
    const p1 = playerMap[match.player1_id]
    const p2 = playerMap[match.player2_id]
    const entries = [p1, p2].filter(Boolean)
    const athleteIds = [...new Set(entries.map(p => p.athlete_id).filter(Boolean))]

    const [subsRes, profilesRes] = await Promise.all([
      athleteIds.length
        ? supabase.from('push_subscriptions').select('user_id').in('user_id', athleteIds)
        : Promise.resolve({ data: [] }),
      athleteIds.length
        ? supabase.from('profiles').select('id, phone').in('id', athleteIds)
        : Promise.resolve({ data: [] }),
    ])

    const subscribedIds = new Set((subsRes.data ?? []).map(s => s.user_id))
    const phoneMap = Object.fromEntries((profilesRes.data ?? []).map(p => [p.id, p.phone]))

    for (const id of athleteIds) {
      if (subscribedIds.has(id)) {
        sendPush(id, '📞 Vào sân ngay!', `Sân ${courtNum} đang gọi bạn vào thi đấu!`, '/')
      }
    }

    const results = entries.map(player => ({
      name:            player.name ?? '?',
      hasAccount:      !!player.athlete_id,
      hasSubscription: player.athlete_id ? subscribedIds.has(player.athlete_id) : false,
      phone:           player.athlete_id ? (phoneMap[player.athlete_id] ?? null) : null,
    }))

    if (results.every(r => r.hasSubscription)) {
      showToast(`Đã gửi thông báo đến ${results.length} VĐV`, 'success')
    } else {
      setCallAthleteModal({ results, courtNum })
    }
  }

  async function handleReset(matchId) {
    if (!window.confirm('Đặt lại trận về chờ bắt đầu? Toàn bộ điểm hiện tại sẽ bị xoá.')) return
    const { data: updated, error } = await supabase
      .from('matches')
      .update({
        status:              'pending',
        live_score_p1:       0,
        live_score_p2:       0,
        live_set_p1:         0,
        live_set_p2:         0,
        current_set:         1,
        player1_scores:      [],
        player2_scores:      [],
        call_started_at:     null,
        match_started_at:    null,
        umpire_heartbeat_at: null,
        winner_id:           null,
      })
      .eq('id', matchId)
      .select()
      .single()
    if (!error) onMatchUpdated(updated)
    else console.error('handleReset:', error)
  }

  // ── Auto-scheduler ─────────────────────────────────────────────────────────

  function handlePreviewSchedule() {
    if (pendingUnscheduled.length === 0) return
    const startWave = allWaves.length > 0 ? allWaves[allWaves.length - 1] + 1 : 1
    setSchedulePreview(generateSchedule(pendingUnscheduled, numCourts, startWave))
  }

  async function handleApplySchedule() {
    if (!schedulePreview) return
    setApplying(true)
    try {
      await Promise.all(
        schedulePreview.map(({ id, court_number, wave_number }) =>
          supabase.from('matches').update({ court_number, wave_number }).eq('id', id)
        )
      )
      setSchedulePreview(null)
      onRefresh?.()
    } catch (err) {
      console.error('handleApplySchedule:', err)
    } finally {
      setApplying(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const hasSchedule = allWaves.length > 0
  const waveIdx     = allWaves.indexOf(effectiveWave)

  // Compute estimated start time for a wave number (requires event.schedule_start_time)
  function waveDisplayTime(waveNum) {
    if (!event?.schedule_start_time) return null
    const startWave = allWaves[0] ?? 1
    const durMins   = event.wave_duration_minutes ?? 45
    const base      = new Date(event.schedule_start_time).getTime()
    const offsetMs  = (waveNum - startWave) * durMins * 60 * 1000
    return formatWaveTime(new Date(base + offsetMs).toISOString())
  }
  const isWaveComplete = useMemo(
    () => {
      const wms = scheduledMatches.filter(m => m.wave_number === effectiveWave)
      return wms.length > 0 && wms.every(m => m.status === 'completed')
    },
    [scheduledMatches, effectiveWave],
  )
  const nextWave = allWaves[waveIdx + 1] ?? null

  return (
    <div className="space-y-4 p-5">

      {/* ── Shuttle Request Modal (queue) ── */}
      {shuttleQueue.length > 0 && (() => {
        const current = shuttleQueue[0]
        const remaining = shuttleQueue.length
        const dismiss = () => setShuttleQueue(prev => prev.slice(1))
        const confirmShuttle = async () => {
          if (current.matchId) {
            supabase.from('matches').update({ shuttle_request_at: null }).eq('id', current.matchId)
          }
          dismiss()
        }
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-gray-900 text-base">
                      Sân {current.courtNumber} đã hết cầu.
                    </p>
                    {remaining > 1 && (
                      <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        {remaining} yêu cầu
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Trọng tài <span className="font-semibold text-gray-700">{current.umpireName}</span> điều hành.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={dismiss}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Bỏ qua
                </button>
                <button
                  onClick={confirmShuttle}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
                >
                  {remaining > 1 ? `Xác nhận (còn ${remaining - 1})` : 'Xác nhận'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}


      {/* ── Wave timeline ── */}
      {hasSchedule && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lượt đấu</p>
            {editingCourtNum && (
              <span className="text-xs text-blue-600 font-medium animate-pulse">✎ Đang chỉnh sửa Sân {editingCourtNum}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedWave(allWaves[waveIdx - 1] ?? null)}
              disabled={waveIdx <= 0}
              className="p-1 rounded-lg border border-gray-200 text-gray-400 hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 overflow-x-auto flex-1">
              {allWaves.map(w => {
                const wms       = scheduledMatches.filter(m => m.wave_number === w)
                const done      = wms.every(m => m.status === 'completed')
                const hasActive = wms.some(m => m.status === 'active' || m.status === 'calling')
                const isSel     = w === effectiveWave
                return (
                  <button
                    key={w}
                    onClick={() => setSelectedWave(w === activeWave ? null : w)}
                    className={cn(
                      'flex flex-col items-center px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shrink-0',
                      isSel && done       && 'border-green-400 bg-green-50 text-green-700',
                      isSel && hasActive  && 'border-orange-400 bg-orange-50 text-orange-700',
                      isSel && !done && !hasActive && 'border-blue-400 bg-blue-50 text-blue-700',
                      !isSel && done      && 'border-green-200 text-green-600 hover:bg-green-50',
                      !isSel && hasActive && 'border-orange-200 text-orange-600 hover:bg-orange-50',
                      !isSel && !done && !hasActive && 'border-gray-200 text-gray-500 hover:border-gray-300',
                    )}
                  >
                    <span>Lượt {w}</span>
                    {waveDisplayTime(w) && (
                      <span className="text-[10px] opacity-70 font-normal">{waveDisplayTime(w)}</span>
                    )}
                    <span className="mt-0.5">
                      {done ? '✓' : hasActive ? '●' : `${wms.filter(m => m.status === 'completed').length}/${wms.length}`}
                    </span>
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => setSelectedWave(allWaves[waveIdx + 1] ?? null)}
              disabled={waveIdx >= allWaves.length - 1}
              className="p-1 rounded-lg border border-gray-200 text-gray-400 hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Court columns ── */}
      {hasSchedule ? (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.min(numCourts, 4)}, minmax(0, 1fr))` }}
        >
          {courtSlots.map((match, idx) => {
            const courtNum     = idx + 1
            const isEditing    = editingCourtNum === courtNum
            const otherPending = courtSlots
              .map((m, i) => ({ courtNum: i + 1, match: m }))
              .filter(s => s.courtNum !== courtNum && s.match && s.match.status === 'pending')

            return (
              <CourtSlot
                key={courtNum}
                courtNum={courtNum}
                match={match}
                playerMap={playerMap}
                attendanceEnabled={event?.attendance_enabled ?? false}
                isEditing={isEditing}
                otherPendingSlots={otherPending}
                pendingUnscheduled={pendingUnscheduled}
                waveNum={effectiveWave}
                onEditToggle={() => setEditingCourtNum(isEditing ? null : courtNum)}
                onStart={() => match && handleStartMatch(match, courtNum)}
                onScore={() => match && setScoreMatch(match)}
                onUnschedule={() => match && handleUnschedule(match.id)}
                onSwapWith={(otherMatch) => match && handleSwapCourts(match, otherMatch)}
                onAssign={(unscheduledMatch) => handleAssignToSlot(unscheduledMatch.id, courtNum, effectiveWave)}
                onCancelCall={() => match && handleCancelCall(match.id)}
                onRecall={() => match && handleRecall(match, courtNum)}
                onReset={() => match && handleReset(match.id)}
                onCallAthletes={() => match && handleCallAthletes(match, courtNum)}
                now={now}
                umpireName={match ? (umpireMap[match.umpire_id]?.name ?? null) : null}
                onAssignUmpire={onAssignUmpire && match ? () => onAssignUmpire(match) : null}
                callingDisabled={false}
                matchStats={match ? (liveStats[match.id] ?? null) : null}
                currentUserId={profile?.id ?? null}
              />
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🏸</div>
          <p className="text-gray-600 font-medium mb-1">Chưa có lịch sân đấu</p>
          <p className="text-sm text-gray-400 mb-4">
            {pendingUnscheduled.length > 0
              ? `${pendingUnscheduled.length} trận chờ lập lịch`
              : 'Không có trận nào để lập lịch'}
          </p>
          {pendingUnscheduled.length > 0 && (
            <Button onClick={handlePreviewSchedule}>
              <Zap className="w-4 h-4" />
              Lập lịch tự động
            </Button>
          )}
        </div>
      )}

      {/* ── Wave complete banner ── */}
      {isWaveComplete && nextWave && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-medium text-green-800">✓ Lượt {effectiveWave} đã hoàn thành</p>
            <p className="text-xs text-green-600 mt-0.5">Sẵn sàng chuyển sang lượt tiếp theo</p>
          </div>
          <Button onClick={() => setSelectedWave(nextWave)} variant="secondary" className="shrink-0">
            Lượt {nextWave} →
          </Button>
        </div>
      )}

      {/* ── Unscheduled matches notice ── */}
      {hasSchedule && pendingUnscheduled.length > 0 && (
        <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-medium text-yellow-800">
              {pendingUnscheduled.length} trận chưa được lập lịch
            </p>
            <p className="text-xs text-yellow-600 mt-0.5">
              Tiếp tục từ lượt {(allWaves[allWaves.length - 1] ?? 0) + 1}
            </p>
          </div>
          <Button onClick={handlePreviewSchedule} variant="secondary" className="shrink-0">
            <Zap className="w-4 h-4" />
            Lập lịch tiếp
          </Button>
        </div>
      )}

      {/* ── Schedule Preview Modal ── */}
      {schedulePreview && (
        <SchedulePreviewModal
          preview={schedulePreview}
          matches={matches}
          playerMap={playerMap}
          numCourts={numCourts}
          onApply={handleApplySchedule}
          onCancel={() => setSchedulePreview(null)}
          applying={applying}
        />
      )}

      {/* ── Score Modal ── */}
      {scoreMatch && (
        <ScoreModal
          match={scoreMatch}
          player1Name={playerMap[scoreMatch.player1_id]?.name ?? '?'}
          player2Name={playerMap[scoreMatch.player2_id]?.name ?? '?'}
          scoringRules={scoringRules}
          numCourts={numCourts}
          onClose={() => setScoreMatch(null)}
          onSaved={handleMatchSaved}
        />
      )}

      {/* ── Call Athlete Modal ── */}
      {callAthleteModal && (
        <CallAthleteModal
          courtNum={callAthleteModal.courtNum}
          results={callAthleteModal.results}
          onClose={() => setCallAthleteModal(null)}
        />
      )}
    </div>
  )
}

// ─── CourtSlot ────────────────────────────────────────────────────────────────

function CourtSlot({
  courtNum, match, playerMap,
  attendanceEnabled = false,
  isEditing, otherPendingSlots, pendingUnscheduled,
  onEditToggle, onStart, onScore, onUnschedule, onSwapWith, onAssign, onCancelCall,
  onRecall = null, onReset = null, onCallAthletes = null,
  now = Date.now(),
  umpireName = null, onAssignUmpire = null, callingDisabled = false,
  matchStats = null, currentUserId = null,
}) {
  const p1        = match ? (playerMap[match.player1_id] ?? { name: '?' }) : null
  const p2        = match ? (playerMap[match.player2_id] ?? { name: '?' }) : null
  const isActive  = match?.status === 'active'
  const isDone    = match?.status === 'completed'
  const isPending = match?.status === 'pending'
  const isCalling = match?.status === 'calling'
  const canEdit   = !match || (isPending && !isCalling)
  const isStuck   = isActive && match?.started_at &&
    (Date.now() - new Date(match.started_at).getTime()) > 90 * 60 * 1000

  const heartbeatStaleMs = isActive && match?.umpire_heartbeat_at
    ? now - new Date(match.umpire_heartbeat_at).getTime()
    : null
  const heartbeatStaleSecs = heartbeatStaleMs !== null ? Math.floor(heartbeatStaleMs / 1000) : null
  // 60 s = 2 missed heartbeats at the 30 s interval → consider disconnected
  const heartbeatLost = isActive && match?.umpire_id && (
    heartbeatStaleMs === null || heartbeatStaleMs >= 60_000
  )

  const p1Att = attendanceEnabled ? (playerMap[match?.player1_id]?.attendance ?? 'present') : 'present'
  const p2Att = attendanceEnabled ? (playerMap[match?.player2_id]?.attendance ?? 'present') : 'present'
  const isAttendanceLocked = attendanceEnabled && isPending && (p1Att === 'pending' || p2Att === 'pending')

  return (
    <div className={cn(
      'bg-white border rounded-xl overflow-hidden transition-all',
      isEditing  && 'ring-2 ring-blue-300 border-blue-300',
      isActive   && !isEditing && 'border-orange-300 ring-2 ring-orange-100',
      isCalling  && !isEditing && 'border-amber-300 ring-2 ring-amber-100',
      isDone     && !isEditing && 'border-green-200',
      !match     && !isEditing && 'border-dashed border-gray-200',
    )}>
      {/* ── Header ── */}
      <div className={cn(
        'px-3 py-2 text-sm font-bold border-b flex items-center gap-1.5',
        isEditing              && 'bg-blue-500 text-white border-blue-400',
        !isEditing && isActive && 'bg-orange-500 text-white border-orange-400',
        !isEditing && isCalling && 'bg-amber-500 text-white border-amber-400',
        !isEditing && isDone   && 'bg-green-50 text-green-700 border-green-100',
        !isEditing && !match   && 'bg-gray-50 text-gray-400 border-gray-100',
        !isEditing && isPending && 'bg-blue-50 text-blue-700 border-blue-100',
      )}>
        {(isActive || isCalling) && !isEditing && (
          <span className="w-2 h-2 bg-white rounded-full animate-pulse shrink-0" />
        )}
        <span className="flex-1 text-center">
          Sân {courtNum}
          {isActive   && !isEditing && (
            <>
              <span className="font-normal text-xs ml-1 opacity-90">● Đang đấu</span>
              {isStuck && <span className="font-normal text-xs ml-1 text-red-200">⚠ &gt;90ph</span>}
            </>
          )}
          {isCalling  && !isEditing && <span className="font-normal text-xs ml-1 opacity-90">📞 Đang kết nối trọng tài</span>}
          {isDone     && !isEditing && <span className="font-normal text-xs ml-1 opacity-80">✓ Xong</span>}
          {isEditing               && <span className="font-normal text-xs ml-1 opacity-90">— Đang chỉnh</span>}
        </span>

        {canEdit && (
          <button
            onClick={onEditToggle}
            title={isEditing ? 'Đóng chỉnh sửa' : 'Chỉnh sửa sân này'}
            className={cn(
              'p-0.5 rounded transition-colors shrink-0',
              isEditing ? 'text-white/80 hover:text-white' : 'text-blue-400 hover:text-blue-600',
            )}
          >
            {isEditing ? <X className="w-4 h-4" /> : <Pencil className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* ── Body ── */}
      <div className="p-3">
        {isEditing ? (
          <EditPanel
            match={match}
            playerMap={playerMap}
            otherPendingSlots={otherPendingSlots}
            pendingUnscheduled={pendingUnscheduled}
            onUnschedule={onUnschedule}
            onSwapWith={onSwapWith}
            onAssign={onAssign}
          />
        ) : !match ? (
          <div className="text-center py-6 text-sm text-gray-300">Trống</div>
        ) : (
          <>
            {/* Stage badge for final rounds */}
            {(match.stage === 'final' || match.stage === 'third_place') && (
              <div className="text-center mb-2">
                <span className={cn(
                  'text-xs font-bold px-2 py-0.5 rounded-full',
                  match.stage === 'final'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-orange-100 text-orange-700',
                )}>
                  {match.stage === 'final' ? '🏆 Chung kết' : '🥉 Tranh hạng 3'}
                </span>
              </div>
            )}

            {/* Players */}
            <div className="space-y-2 mb-3 text-center">
              <PlayerRow name={p1?.name ?? '?'} club={p1?.club} highlight={isDone && match.winner_id === match.player1_id} />
              <div className="text-xs text-gray-300">vs</div>
              <PlayerRow name={p2?.name ?? '?'} club={p2?.club} highlight={isDone && match.winner_id === match.player2_id} />
            </div>

            {/* Call athletes — visible on all non-completed matches */}
            {!isDone && onCallAthletes && (
              <button
                onClick={onCallAthletes}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 mb-2 text-xs font-medium rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                <Phone className="w-3 h-3" />
                Gọi VĐV vào sân
              </button>
            )}

            {/* Status-specific content */}
            {isDone && (
              <div className="text-center text-sm font-semibold text-gray-600">
                {(match.player1_scores ?? []).map((s, i) => `${s}–${(match.player2_scores ?? [])[i] ?? 0}`).join('  ')}
              </div>
            )}

            {isActive && (
              <>
                {/* Completed set scores */}
                {(match.current_set ?? 1) > 1 && (match.player1_scores?.length ?? 0) > 0 && (
                  <div className="w-full gap-3 mb-2">
                    {(match.player1_scores ?? []).map((s1, i) => (
                      <div key={i} className="">
                        <p className="text-center text-xs text-orange-600 font-semibold mb-2">Hiệp {i + 1}</p>
                        {/* <p className="text-xs font-bold text-gray-600 font-mono">{s1}–{match.player2_scores?.[i] ?? 0}</p> */}
                        <div className="flex items-center justify-center gap-4 mb-2 py-1.5 rounded-lg bg-orange-50">
                          <span className="text-2xl font-black font-mono text-cyan-600">{s1}</span>
                          <span className="text-xs text-gray-400 font-semibold">vs</span>
                          <span className="text-2xl font-black font-mono text-amber-500">{match.player2_scores?.[i] ?? 0}</span>
                        </div>  
                      </div>
                    ))}
                  </div>
                )}

                {/* Live score */}
                 {match.current_set > 1 && (
                  <p className="text-center text-xs text-orange-600 font-semibold mb-2">Hiệp {match.current_set}</p>
                )}
                <div className="flex items-center justify-center gap-4 mb-2 py-1.5 rounded-lg bg-orange-50">
                  <span className="text-2xl font-black font-mono text-cyan-600">{match.live_score_p1 ?? 0}</span>
                  <span className="text-xs text-gray-400 font-semibold">vs</span>
                  <span className="text-2xl font-black font-mono text-amber-500">{match.live_score_p2 ?? 0}</span>
                </div>
               

                {/* Live stats từ match_stats — chỉ hiện khi có ít nhất 1 chỉ số > 0 */}
                {matchStats && (() => {
                  const p1Faults = matchStats.p1_service_faults ?? 0
                  const p2Faults = matchStats.p2_service_faults ?? 0
                  const p1Yellow = matchStats.p1_yellow_cards   ?? 0
                  const p2Yellow = matchStats.p2_yellow_cards   ?? 0
                  const p1Red    = matchStats.p1_red_cards      ?? 0
                  const p2Red    = matchStats.p2_red_cards      ?? 0
                  if (p1Faults + p2Faults + p1Yellow + p2Yellow + p1Red + p2Red === 0) return null
                  return (
                    <div className="mb-2 px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-100 space-y-0.5">
                      {(p1Faults > 0 || p2Faults > 0) && (
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Lỗi phát cầu</span>
                          <span className="font-mono font-semibold">
                            <span className="text-cyan-600">{p1Faults}</span>
                            <span className="text-gray-300 mx-1">–</span>
                            <span className="text-amber-500">{p2Faults}</span>
                          </span>
                        </div>
                      )}
                      {(p1Yellow > 0 || p2Yellow > 0) && (
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>🟡 Thẻ vàng</span>
                          <span className="font-mono font-semibold">
                            <span className="text-cyan-600">{p1Yellow}</span>
                            <span className="text-gray-300 mx-1">–</span>
                            <span className="text-amber-500">{p2Yellow}</span>
                          </span>
                        </div>
                      )}
                      {(p1Red > 0 || p2Red > 0) && (
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>🔴 Thẻ đỏ</span>
                          <span className="font-mono font-semibold">
                            <span className="text-cyan-600">{p1Red}</span>
                            <span className="text-gray-300 mx-1">–</span>
                            <span className="text-amber-500">{p2Red}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {isStuck && (
                  <div className="mb-2 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Trận chạy hơn 90 phút — cần kiểm tra
                  </div>
                )}

                {/* Live heartbeat indicator — shows when umpire app is connected */}
                {!heartbeatLost && match.umpire_id && heartbeatStaleSecs !== null && (
                  <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                      App trọng tài đang kết nối
                    </span>
                    <span>{heartbeatStaleSecs}s trước</span>
                  </div>
                )}

                {heartbeatLost && match.umpire_id && (
                  <div className="mb-2 rounded-lg border border-yellow-300 bg-yellow-50 px-2.5 py-2 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-yellow-700 font-semibold">
                      <WifiOff className="w-3.5 h-3.5 shrink-0" />
                      {heartbeatStaleSecs !== null
                        ? `Ứng dụng trọng tài mất kết nối ${heartbeatStaleSecs >= 60 ? `${Math.floor(heartbeatStaleSecs / 60)} phút` : `${heartbeatStaleSecs}s`}`
                        : 'Chưa nhận tín hiệu từ ứng dụng trọng tài'}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={onRecall}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-md bg-yellow-500 text-white hover:bg-yellow-600 transition-colors"
                      >
                        <PhoneCall className="w-3 h-3" />
                        Gọi lại
                      </button>
                      <button
                        onClick={onReset}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-md border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Đánh lại
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={onScore}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                >
                  Nhập điểm
                </button>
              </>
            )}

            {isCalling && (
              <div className="text-center">
                <p className="text-xs text-amber-600 font-semibold mb-2">Đang chờ trọng tài xác nhận...</p>
                <button
                  onClick={onCancelCall}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  Huỷ kết nối
                </button>
              </div>
            )}

            {isPending && (
              isAttendanceLocked ? (
                <div className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg bg-yellow-50 text-yellow-600 border border-yellow-200">
                  <Clock className="w-3.5 h-3.5" />
                  Chờ điểm danh VĐV
                </div>
              ) : (
                <button
                  onClick={onStart}
                  disabled={callingDisabled}
                  className={cn(
                    'w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-colors',
                    callingDisabled
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700',
                  )}
                >
                  <Play className="w-3.5 h-3.5" />
                  Bắt đầu
                </button>
              )
            )}

            {/* Umpire evaluation */}
            {isDone && umpireName && currentUserId && (
              <UmpireEvaluationWidget
                matchId={match.id}
                umpireId={match.umpire_id}
                currentUserId={currentUserId}
              />
            )}

            {/* Umpire row */}
            {onAssignUmpire && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <ShieldCheck className="w-3 h-3" />
                  {umpireName
                    ? <span className="text-gray-600 font-medium">{umpireName}</span>
                    : <span className="italic">Chưa có TT</span>
                  }
                </span>
                <button
                  onClick={onAssignUmpire}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors"
                >
                  {umpireName ? 'Đổi' : 'Phân công'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── UmpireEvaluationWidget ───────────────────────────────────────────────────

function UmpireEvaluationWidget({ matchId, umpireId, currentUserId }) {
  const [ratingDone,  setRatingDone]  = useState(null)   // null = loading, false = not done, object = done
  const [open,        setOpen]        = useState(false)
  const [hovered,     setHovered]     = useState(0)
  const [selected,    setSelected]    = useState(0)
  const [comment,     setComment]     = useState('')
  const [submitting,  setSubmitting]  = useState(false)

  useEffect(() => {
    supabase
      .from('umpire_evaluations')
      .select('rating, comment')
      .eq('match_id', matchId)
      .maybeSingle()
      .then(({ data }) => setRatingDone(data ?? false))
  }, [matchId])

  async function handleSubmit() {
    if (!selected) return
    setSubmitting(true)
    const { error } = await supabase.from('umpire_evaluations').insert({
      match_id:     matchId,
      umpire_id:    umpireId,
      evaluated_by: currentUserId,
      rating:       selected,
      comment:      comment.trim() || null,
    })
    setSubmitting(false)
    if (!error) {
      setRatingDone({ rating: selected, comment: comment.trim() || null })
      setOpen(false)
      showToast('✓ Đã đánh giá', 'success')
    }
  }

  if (ratingDone === null) return null   // still loading — render nothing

  return (
    <div className="mt-2 pt-2 border-t border-gray-100">
      {ratingDone ? (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="text-yellow-400 tracking-tight">
            {'★'.repeat(ratingDone.rating)}{'☆'.repeat(5 - ratingDone.rating)}
          </span>
          {ratingDone.comment && (
            <span className="text-gray-400 truncate italic">"{ratingDone.comment}"</span>
          )}
        </div>
      ) : !open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium px-1.5 py-0.5 rounded hover:bg-amber-50 transition-colors"
        >
          ⭐ Đánh giá TT
        </button>
      ) : (
        <div className="space-y-1.5">
          {/* Star selector */}
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(n => (
              <span
                key={n}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setSelected(n)}
                className="cursor-pointer text-lg leading-none select-none"
                style={{ color: n <= (hovered || selected) ? '#f59e0b' : '#d1d5db' }}
              >
                ★
              </span>
            ))}
          </div>
          {/* Comment */}
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value.slice(0, 100))}
            placeholder="Nhận xét (tuỳ chọn)"
            rows={2}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 resize-none focus:outline-none focus:border-amber-300"
          />
          {/* Actions */}
          <div className="flex gap-1.5">
            <button
              onClick={() => { setOpen(false); setSelected(0); setComment('') }}
              className="flex-1 py-1 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Huỷ
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selected || submitting}
              className="flex-1 py-1 text-xs rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? '...' : 'Gửi'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── EditPanel ────────────────────────────────────────────────────────────────

function EditPanel({ match, playerMap, otherPendingSlots, pendingUnscheduled, onUnschedule, onSwapWith, onAssign }) {
  const hasMatch = match != null

  return (
    <div className="space-y-3">
      {hasMatch ? (
        <>
          <div className="text-center text-xs text-gray-500 bg-gray-50 rounded-lg py-2 px-3">
            <span className="font-medium text-gray-700">{playerMap[match.player1_id]?.name ?? '?'}</span>
            <span className="text-gray-400 mx-1">vs</span>
            <span className="font-medium text-gray-700">{playerMap[match.player2_id]?.name ?? '?'}</span>
          </div>

          {otherPendingSlots.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
                <ArrowLeftRight className="w-3 h-3" /> Đổi sân với
              </p>
              <div className="flex flex-wrap gap-1.5">
                {otherPendingSlots.map(({ courtNum, match: other }) => (
                  <button
                    key={courtNum}
                    onClick={() => onSwapWith(other)}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    Sân {courtNum}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onUnschedule}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Bỏ khỏi lịch
          </button>
        </>
      ) : (
        pendingUnscheduled.length > 0 ? (
          <div>
            <p className="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
              <PlusCircle className="w-3 h-3" /> Gán trận vào sân này
            </p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {pendingUnscheduled.map(m => {
                const n1 = playerMap[m.player1_id]?.name ?? '?'
                const n2 = playerMap[m.player2_id]?.name ?? '?'
                return (
                  <button
                    key={m.id}
                    onClick={() => onAssign(m)}
                    className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <span className="font-medium text-gray-800">{n1}</span>
                    <span className="text-gray-400 mx-1">vs</span>
                    <span className="font-medium text-gray-800">{n2}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-4">Không có trận chờ để gán</p>
        )
      )}
    </div>
  )
}

function PlayerRow({ name, club, highlight }) {
  return (
    <div>
      <p className={cn('text-sm', highlight ? 'font-bold text-gray-900' : 'text-gray-700')}>{name}</p>
      {club && <p className="text-xs text-gray-400">{club}</p>}
    </div>
  )
}

// ─── CallAthleteModal ─────────────────────────────────────────────────────────

function CallAthleteModal({ courtNum, results, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-gray-900">Gọi VĐV — Sân {courtNum}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results */}
        <div className="px-5 py-4 space-y-3">
          {results.map((r, i) => (
            <div key={i} className="flex items-start gap-3">
              {/* Status icon */}
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm',
                r.hasSubscription ? 'bg-green-100' : r.hasAccount ? 'bg-amber-100' : 'bg-gray-100',
              )}>
                {r.hasSubscription ? '✅' : r.hasAccount ? '🔕' : '👤'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                {r.hasSubscription ? (
                  <p className="text-xs text-green-600 mt-0.5">Đã gửi thông báo</p>
                ) : r.hasAccount ? (
                  <p className="text-xs text-amber-600 mt-0.5">Chưa bật thông báo — gọi thủ công</p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">Chưa có tài khoản — gọi thủ công</p>
                )}
                {/* Phone link */}
                {!r.hasSubscription && r.phone && (
                  <a
                    href={`tel:${r.phone}`}
                    className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    <Phone className="w-3 h-3" />
                    {r.phone}
                  </a>
                )}
                {!r.hasSubscription && !r.phone && (
                  <p className="text-xs text-gray-300 mt-0.5 italic">Không có số điện thoại</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 pb-4">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SchedulePreviewModal ─────────────────────────────────────────────────────

function SchedulePreviewModal({ preview, matches, playerMap, numCourts, onApply, onCancel, applying }) {
  const matchMap = useMemo(
    () => Object.fromEntries(matches.map(m => [m.id, m])),
    [matches],
  )
  const waves = [...new Set(preview.map(p => p.wave_number))].sort((a, b) => a - b)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-bold text-gray-900">Xem trước lịch tự động</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {waves.length} lượt × {numCourts} sân · {preview.length} trận
              </p>
            </div>
          </div>
          <button onClick={onCancel} disabled={applying} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {waves.map(w => {
            const wAssignments = preview.filter(p => p.wave_number === w)
            return (
              <div key={w}>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Lượt {w}</p>
                <div className="space-y-1">
                  {wAssignments.map(({ id, court_number }) => {
                    const m  = matchMap[id]
                    if (!m) return null
                    const p1 = playerMap[m.player1_id]?.name ?? '?'
                    const p2 = playerMap[m.player2_id]?.name ?? '?'
                    return (
                      <div key={id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2 text-sm">
                        <span className="text-xs font-bold text-blue-600 w-14 shrink-0">Sân {court_number}</span>
                        <span className="text-gray-700 truncate">
                          {p1} <span className="text-gray-400 font-normal">vs</span> {p2}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <Button variant="secondary" onClick={onCancel} className="flex-1" disabled={applying}>Hủy</Button>
          <Button onClick={onApply} loading={applying} className="flex-1">Áp dụng lịch</Button>
        </div>
      </div>
    </div>
  )
}
