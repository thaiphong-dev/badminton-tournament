import { useState, useEffect, useRef } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { validateMatchScores, updateGroupStandingsInDB } from '@/lib/utils/standingsCalculator'
import { getStageScoringRule } from '@/lib/utils/eventHelpers'
import Button from '@/components/ui/Button'

/**
 * Modal for entering match scores.
 *
 * Props:
 *  match        – match row from DB
 *  player1Name  – resolved player name
 *  player2Name  – resolved player name
 *  scoringRules – optional event.scoring_rules JSONB; if absent falls back to hardcoded defaults
 *  numCourts    – number of courts available (for court selector)
 *  onClose      – called when modal dismissed
 *  onSaved      – called with updated match after successful save
 */
export default function ScoreModal({ match, player1Name, player2Name, scoringRules, numCourts, onClose, onSaved }) {
  // Resolve sets + pointsPerSet from event config (or legacy hardcoded fallback)
  const { sets, pointsPerSet } = scoringRules
    ? getStageScoringRule(scoringRules, match.stage)
    : { sets: ['semi', 'final', 'third_place'].includes(match.stage) ? 3 : 1, pointsPerSet: ['semi', 'final', 'third_place'].includes(match.stage) ? 15 : 21 }

  const isBestOf3 = sets === 3
  const isEditing  = match.status === 'completed'

  // Pre-fill existing scores when editing a completed match
  const toSlots = (arr) => {
    const a = Array.isArray(arr) ? arr : []
    return [String(a[0] ?? ''), String(a[1] ?? ''), String(a[2] ?? '')]
  }

  const [scores1, setScores1] = useState(() => toSlots(match.player1_scores))
  const [scores2, setScores2] = useState(() => toSlots(match.player2_scores))
  const [courtNumber, setCourtNumber] = useState(match.court_number ?? null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const input1Ref = useRef(null)

  // Focus first input on open
  useEffect(() => { input1Ref.current?.focus() }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const numSets = sets

  function handleScore(player, setIdx, value) {
    const raw = value.replace(/\D/g, '').slice(0, 2)
    if (player === 1) setScores1(prev => prev.map((v, i) => i === setIdx ? raw : v))
    else              setScores2(prev => prev.map((v, i) => i === setIdx ? raw : v))
    setError(null)
  }

  async function handleSave() {
    // Build numeric arrays for validation
    const s1 = (isBestOf3 ? scores1 : [scores1[0]]).map(Number)
    const s2 = (isBestOf3 ? scores2 : [scores2[0]]).map(Number)

    // For best-of-3, allow 2-set input if already decided
    const activeSets = isBestOf3
      ? (scores1[2] !== '' || scores2[2] !== '' ? 3 : 2)
      : 1
    const s1Active = s1.slice(0, activeSets)
    const s2Active = s2.slice(0, activeSets)

    const { valid, error: vErr, winner } = validateMatchScores(s1Active, s2Active, match.stage, { isBestOf3, pointsPerSet })
    if (!valid) { setError(vErr); return }

    setSaving(true)
    setError(null)
    try {
      const winnerId = winner === 1 ? match.player1_id : match.player2_id

      const { data: updated, error: mErr } = await supabase
        .from('matches')
        .update({
          player1_scores: s1Active,
          player2_scores: s2Active,
          winner_id: winnerId,
          status: 'completed',
          completed_at: new Date().toISOString(),
          ...(courtNumber != null ? { court_number: courtNumber } : {}),
        })
        .eq('id', match.id)
        .select()
        .single()

      if (mErr) throw mErr

      // Recalculate standings for this group (group matches only)
      if (match.group_id) {
        await updateGroupStandingsInDB(match.group_id)
      }

      onSaved(updated)
    } catch (err) {
      setError(`Lỗi lưu kết quả: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
              {stageLabel(match.stage)} · {isBestOf3 ? `Best of 3 × ${pointsPerSet}đ` : `1 set × ${pointsPerSet}đ`}
            </p>
            <h2 className="text-base font-bold text-gray-900">
              {isEditing ? 'Chỉnh sửa kết quả' : 'Nhập kết quả'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Court selector (when numCourts is provided) */}
        {numCourts != null && numCourts > 0 && (
          <div className="px-6 pt-4 pb-0">
            <p className="text-xs text-gray-500 mb-2">Sân thi đấu</p>
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: numCourts }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCourtNumber(courtNumber === n ? null : n)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                    courtNumber === n
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  Sân {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Score inputs */}
        <div className="px-6 py-5 space-y-4">
          {isBestOf3 ? (
            /* Best-of-3 layout */
            <div className="space-y-3">
              {[0, 1, 2].map(setIdx => (
                <SetRow
                  key={setIdx}
                  setIdx={setIdx}
                  label={`Set ${setIdx + 1}${setIdx === 2 ? ' (nếu cần)' : ''}`}
                  player1Name={player1Name}
                  player2Name={player2Name}
                  score1={scores1[setIdx]}
                  score2={scores2[setIdx]}
                  onChange={handleScore}
                  inputRef={setIdx === 0 ? input1Ref : undefined}
                  optional={setIdx === 2}
                />
              ))}
            </div>
          ) : (
            /* Single set layout */
            <div className="flex items-center gap-4">
              <PlayerScoreInput
                label={player1Name}
                value={scores1[0]}
                onChange={v => handleScore(1, 0, v)}
                inputRef={input1Ref}
                onEnter={handleSave}
              />
              <span className="text-gray-300 text-2xl font-light shrink-0">–</span>
              <PlayerScoreInput
                label={player2Name}
                value={scores2[0]}
                onChange={v => handleScore(2, 0, v)}
                onEnter={handleSave}
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Hủy
          </Button>
          <Button onClick={handleSave} loading={saving} className="flex-1">
            Lưu kết quả
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlayerScoreInput({ label, value, onChange, inputRef, onEnter }) {
  return (
    <div className="flex-1 text-center">
      <p className="text-xs text-gray-500 mb-2 truncate font-medium">{label}</p>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onEnter?.()}
        placeholder="0"
        className="w-full text-center text-3xl font-bold border-2 border-gray-200 rounded-xl py-3 focus:outline-none focus:border-blue-500 transition-colors text-gray-900"
      />
    </div>
  )
}

function SetRow({ setIdx, label, player1Name, player2Name, score1, score2, onChange, inputRef, optional }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1.5">{label}</p>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-xs text-gray-500 mb-1 truncate">{player1Name}</p>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={score1}
            onChange={e => onChange(1, setIdx, e.target.value)}
            placeholder="0"
            className="w-full text-center text-xl font-bold border-2 border-gray-200 rounded-lg py-2 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <span className="text-gray-300 text-lg shrink-0">–</span>
        <div className="flex-1">
          <p className="text-xs text-gray-500 mb-1 truncate">{player2Name}</p>
          <input
            type="text"
            inputMode="numeric"
            value={score2}
            onChange={e => onChange(2, setIdx, e.target.value)}
            placeholder="0"
            className="w-full text-center text-xl font-bold border-2 border-gray-200 rounded-lg py-2 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>
    </div>
  )
}

function stageLabel(stage) {
  const labels = {
    group:       'Vòng bảng',
    round_of_16: '1/8',
    quarter:     'Tứ kết',
    semi:        'Bán kết',
    final:       'Chung kết',
    third_place: 'Tranh hạng 3',
  }
  return labels[stage] ?? stage
}
