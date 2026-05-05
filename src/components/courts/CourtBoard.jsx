import { useState, useMemo, useEffect } from 'react'
import { Play, Zap, X, Pencil, ArrowLeftRight, Trash2, PlusCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils/cn'
import { generateSchedule } from '@/lib/utils/courtScheduler'
import Button from '@/components/ui/Button'
import ScoreModal from '@/components/shared/ScoreModal'

export default function CourtBoard({ event, matches, playerMap, scoringRules, onMatchUpdated, onRefresh }) {
  const numCourts = event?.num_courts ?? 2

  const [scoreMatch, setScoreMatch]           = useState(null)
  const [schedulePreview, setSchedulePreview] = useState(null)
  const [applying, setApplying]               = useState(false)
  const [editingCourtNum, setEditingCourtNum] = useState(null) // which court is in edit mode

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

  // Reset edit mode when switching waves
  useEffect(() => { setEditingCourtNum(null) }, [effectiveWave])

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

  // ── Match score/start handlers ─────────────────────────────────────────────

  async function handleStartMatch(match, courtNum) {
    const { data: updated, error } = await supabase
      .from('matches')
      .update({ status: 'active', court_number: courtNum, started_at: new Date().toISOString() })
      .eq('id', match.id)
      .select()
      .single()
    if (!error) onMatchUpdated(updated)
    else console.error('handleStartMatch:', error)
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
            {/* Prev wave */}
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
                const hasActive = wms.some(m => m.status === 'active')
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

            {/* Next wave */}
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
            const courtNum       = idx + 1
            const isEditing      = editingCourtNum === courtNum
            // Other pending slots (for swap options)
            const otherPending   = courtSlots
              .map((m, i) => ({ courtNum: i + 1, match: m }))
              .filter(s => s.courtNum !== courtNum && s.match && s.match.status === 'pending')

            return (
              <CourtSlot
                key={courtNum}
                courtNum={courtNum}
                match={match}
                playerMap={playerMap}
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
  isEditing, otherPendingSlots, pendingUnscheduled, waveNum,
  onEditToggle, onStart, onScore, onUnschedule, onSwapWith, onAssign,
}) {
  const p1       = match ? (playerMap[match.player1_id] ?? { name: '?' }) : null
  const p2       = match ? (playerMap[match.player2_id] ?? { name: '?' }) : null
  const isActive = match?.status === 'active'
  const isDone   = match?.status === 'completed'
  const isPending = match?.status === 'pending'
  const canEdit  = !isActive && !isDone // pending or empty

  return (
    <div className={cn(
      'bg-white border rounded-xl overflow-hidden transition-all',
      isEditing  && 'ring-2 ring-blue-300 border-blue-300',
      isActive   && !isEditing && 'border-orange-300 ring-2 ring-orange-100',
      isDone     && !isEditing && 'border-green-200',
      !match     && !isEditing && 'border-dashed border-gray-200',
    )}>
      {/* ── Header ── */}
      <div className={cn(
        'px-3 py-2 text-sm font-bold border-b flex items-center gap-1.5',
        isEditing  && 'bg-blue-500 text-white border-blue-400',
        !isEditing && isActive   && 'bg-orange-500 text-white border-orange-400',
        !isEditing && isDone     && 'bg-green-50 text-green-700 border-green-100',
        !isEditing && !match     && 'bg-gray-50 text-gray-400 border-gray-100',
        !isEditing && isPending  && 'bg-blue-50 text-blue-700 border-blue-100',
      )}>
        {isActive && !isEditing && <span className="w-2 h-2 bg-white rounded-full animate-pulse" />}
        <span className="flex-1 text-center">
          Sân {courtNum}
          {isActive && !isEditing && <span className="font-normal text-xs ml-1 opacity-90">● Đang đấu</span>}
          {isDone   && !isEditing && <span className="font-normal text-xs ml-1 opacity-80">✓ Xong</span>}
          {isEditing && <span className="font-normal text-xs ml-1 opacity-90">— Đang chỉnh</span>}
        </span>

        {/* Edit toggle button (only for editable courts) */}
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
          /* ── EDIT MODE ── */
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
          /* ── NORMAL MODE ── */
          <>
            <div className="space-y-2 mb-3 text-center">
              <PlayerRow name={p1?.name ?? '?'} club={p1?.club} highlight={isDone && match.winner_id === match.player1_id} />
              <div className="text-xs text-gray-300">vs</div>
              <PlayerRow name={p2?.name ?? '?'} club={p2?.club} highlight={isDone && match.winner_id === match.player2_id} />
            </div>

            {isDone ? (
              <div className="text-center text-sm font-semibold text-gray-600">
                {(match.player1_scores ?? []).map((s, i) => `${s}–${(match.player2_scores ?? [])[i] ?? 0}`).join('  ')}
              </div>
            ) : isActive ? (
              <button
                onClick={onScore}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
              >
                Nhập điểm
              </button>
            ) : (
              <button
                onClick={onStart}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                Bắt đầu
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── EditPanel — shown inside CourtSlot when isEditing ────────────────────────

function EditPanel({ match, playerMap, otherPendingSlots, pendingUnscheduled, onUnschedule, onSwapWith, onAssign }) {
  const hasMatch = match != null

  return (
    <div className="space-y-3">
      {hasMatch ? (
        <>
          {/* Current match reminder */}
          <div className="text-center text-xs text-gray-500 bg-gray-50 rounded-lg py-2 px-3">
            <span className="font-medium text-gray-700">
              {playerMap[match.player1_id]?.name ?? '?'}
            </span>
            <span className="text-gray-400 mx-1">vs</span>
            <span className="font-medium text-gray-700">
              {playerMap[match.player2_id]?.name ?? '?'}
            </span>
          </div>

          {/* Swap options */}
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

          {/* Unschedule */}
          <button
            onClick={onUnschedule}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Bỏ khỏi lịch
          </button>
        </>
      ) : (
        /* Empty slot: assign an unscheduled match */
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
          <Button variant="secondary" onClick={onCancel} className="flex-1" disabled={applying}>
            Hủy
          </Button>
          <Button onClick={onApply} loading={applying} className="flex-1">
            Áp dụng lịch
          </Button>
        </div>
      </div>
    </div>
  )
}
