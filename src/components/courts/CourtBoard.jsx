import { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { Play, Zap, X, Pencil, ArrowLeftRight, Trash2, PlusCircle, ChevronLeft, ChevronRight, ShieldCheck, PhoneOff, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useBTCRealtime } from '@/lib/hooks/useBTCRealtime'
import { cn } from '@/lib/utils/cn'
import { generateSchedule } from '@/lib/utils/courtScheduler'
import Button from '@/components/ui/Button'
import ScoreModal from '@/components/shared/ScoreModal'

export default function CourtBoard({ event, matches, playerMap, scoringRules, onMatchUpdated, onRefresh, umpireMap = {}, onAssignUmpire = null, tournamentId }) {
  const { profile } = useAuth()
  const numCourts = event?.num_courts ?? 2

  const [scoreMatch,       setScoreMatch]       = useState(null)
  const [schedulePreview,  setSchedulePreview]  = useState(null)
  const [applying,         setApplying]         = useState(false)
  const [editingCourtNum,  setEditingCourtNum]  = useState(null)
  const [callingMatchIds,  setCallingMatchIds]  = useState(new Set()) // Set<matchId> — 1 BTC có thể gọi nhiều sân cùng lúc
  const [toast,            setToast]            = useState(null) // { message, type, id }
  const [liveStats,        setLiveStats]        = useState({})   // { [matchId]: match_stats row }

  // Box callingMatchIds into ref so useBTCRealtime callback never goes stale
  const callingRef = useRef(callingMatchIds)
  useLayoutEffect(() => { callingRef.current = callingMatchIds })

  // Auto-dismiss toast after 4 s — depend on toast object so deps are complete
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  function showToast(message, type = 'success') {
    setToast({ message, type, id: Date.now() })
  }

  // ── BTC Realtime ───────────────────────────────────────────────────────────

  const handleStatsUpdate = useCallback((updatedStats) => {
    if (!updatedStats?.match_id) return
    setLiveStats(prev => ({ ...prev, [updatedStats.match_id]: updatedStats }))
  }, [])

  const handleMatchUpdate = useCallback((updatedMatch) => {
    onMatchUpdated(updatedMatch)
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
  }, [onMatchUpdated])

  useBTCRealtime(tournamentId, handleMatchUpdate, handleStatsUpdate)

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
    }
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

  return (
    <div className="space-y-4 p-5">

      {/* ── Toast ── */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold flex items-center gap-2 transition-all',
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-amber-500 text-white',
          )}
        >
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
                umpireName={match ? (umpireMap[match.umpire_id]?.name ?? null) : null}
                onAssignUmpire={onAssignUmpire && match ? () => onAssignUmpire(match) : null}
                callingDisabled={false}
                matchStats={match ? (liveStats[match.id] ?? null) : null}
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
    </div>
  )
}

// ─── CourtSlot ────────────────────────────────────────────────────────────────

function CourtSlot({
  courtNum, match, playerMap,
  attendanceEnabled = false,
  isEditing, otherPendingSlots, pendingUnscheduled,
  onEditToggle, onStart, onScore, onUnschedule, onSwapWith, onAssign, onCancelCall,
  umpireName = null, onAssignUmpire = null, callingDisabled = false,
  matchStats = null,
}) {
  const p1        = match ? (playerMap[match.player1_id] ?? { name: '?' }) : null
  const p2        = match ? (playerMap[match.player2_id] ?? { name: '?' }) : null
  const isActive  = match?.status === 'active'
  const isDone    = match?.status === 'completed'
  const isPending = match?.status === 'pending'
  const isCalling = match?.status === 'calling'
  const canEdit   = isPending && !isCalling

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
          {isActive   && !isEditing && <span className="font-normal text-xs ml-1 opacity-90">● Đang đấu</span>}
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
