import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  createInitialState, addPoint, undoLastPoint, redoLastPoint,
  startNextSet, addShuttle, buildFinalScores,
} from '@/lib/utils/umpireLogic'
import { getStageScoringRule } from '@/lib/utils/eventHelpers'
import ScoringScreen from '@/components/umpire/ScoringScreen'

const KEY_TO_COL = {
  serviceFaults: 'service_faults',
  yellowCards:   'yellow_cards',
  redCards:      'red_cards',
}
import SetBreakScreen from '@/components/umpire/SetBreakScreen'
import MatchSummaryScreen from '@/components/umpire/MatchSummaryScreen'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { cn } from '@/lib/utils/cn'
import '@/components/umpire/UmpireScoring.scss'

export default function UmpireMatchPage() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const storageKey = `umpire_session_${matchId}`

  const [match, setMatch]     = useState(null)
  const [player1, setPlayer1] = useState(null)
  const [player2, setPlayer2] = useState(null)
  const [gameState, setGameState] = useState(null)
  const [pendingRestore, setPendingRestore]     = useState(null) // { savedGs, freshGs }
  const [pendingDBRestore, setPendingDBRestore] = useState(null) // { dbGs, freshGs }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)

  // GL3-D1: auto-save gameState to localStorage on every change
  useEffect(() => {
    if (!gameState || !matchId) return
    try { localStorage.setItem(storageKey, JSON.stringify(gameState)) } catch {}
  }, [gameState, matchId, storageKey])

  useEffect(() => {
    async function fetchMatch() {
      const { data: m, error: mErr } = await supabase
        .from('matches')
        .select('*, events(scoring_rules)')
        .eq('id', matchId)
        .single()

      if (mErr || !m) { setError('Không tìm thấy trận đấu'); setLoading(false); return }

      const playerIds = [m.player1_id, m.player2_id].filter(Boolean)
      const { data: players } = await supabase.from('players').select('id, name').in('id', playerIds)

      const pMap = Object.fromEntries((players || []).map(p => [p.id, p]))
      const p1 = pMap[m.player1_id] ?? { id: m.player1_id, name: 'Player 1' }
      const p2 = pMap[m.player2_id] ?? { id: m.player2_id, name: 'Player 2' }

      const scoringRules = m.events?.scoring_rules ?? null
      const { sets: totalSets, pointsPerSet } = getStageScoringRule(scoringRules, m.stage)

      const freshGs = createInitialState(p1.id, p2.id, totalSets, pointsPerSet, p1.name, p2.name)

      setMatch(m)
      setPlayer1(p1)
      setPlayer2(p2)

      // GL3-D2: restore saved session if found
      try {
        const raw = localStorage.getItem(`umpire_session_${matchId}`)
        if (raw) {
          const savedGs = JSON.parse(raw)
          if (savedGs && savedGs.phase && savedGs.phase !== 'confirm') {
            setPendingRestore({ savedGs, freshGs })
            setLoading(false)
            return
          }
        }
      } catch {}

      // DB restore: no localStorage but match is active and DB has scores
      if (m.status === 'active') {
        const hasDbScores = (m.live_score_p1 > 0 || m.live_score_p2 > 0 || (m.player1_scores?.length ?? 0) > 0)
        if (hasDbScores) {
          const completedSets = (m.player1_scores || []).map((s, i) => ({
            p1: s,
            p2: (m.player2_scores || [])[i] ?? 0,
          }))
          const dbGs = {
            ...freshGs,
            completedSets,
            currentSetP1: m.live_score_p1 ?? 0,
            currentSetP2: m.live_score_p2 ?? 0,
            currentSet:   m.current_set ?? (completedSets.length + 1),
            startedAt:    new Date().toISOString(),
            phase:        'confirm',
            isRestore:    true,
          }
          setPendingDBRestore({ dbGs, freshGs })
          setLoading(false)
          return
        }
      }

      setGameState(freshGs)
      setLoading(false)
    }
    fetchMatch()
  }, [matchId])

  const persistLiveScore = useCallback(async (gs) => {
    if (!match) return
    await supabase.from('matches').update({
      live_score_p1:       gs.currentSetP1,
      live_score_p2:       gs.currentSetP2,
      live_set_p1:         gs.completedSets.filter(s => s.p1 > s.p2).length,
      live_set_p2:         gs.completedSets.filter(s => s.p2 > s.p1).length,
      current_set:         gs.currentSet,
      shuttle_count:       gs.shuttleCount,
      player1_scores:      gs.completedSets.map(s => s.p1),
      player2_scores:      gs.completedSets.map(s => s.p2),
      umpire_heartbeat_at: new Date().toISOString(),
    }).eq('id', matchId)
  }, [match, matchId])

  const logEvent = useCallback(async (type, extra = {}) => {
    if (!match) return
    await supabase.from('match_events').insert({
      match_id:   matchId,
      event_type: type,
      score_p1:   extra.score_p1,
      score_p2:   extra.score_p2,
      set_number: extra.set_number,
      scorer_id:  extra.scorer_id ?? null,
      server_id:  extra.server_id ?? null,
    })
  }, [match, matchId])

  // GL3-D4: auto-sync to DB every 30s while match is in progress
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') return
    const timer = setInterval(() => { persistLiveScore(gameState) }, 30000)
    return () => clearInterval(timer)
  }, [gameState, persistLiveScore])

  // Dedicated heartbeat — independent of game phase, fires immediately then every 30s.
  // BTC uses this to detect a dropped connection (threshold: 90s).
  useEffect(() => {
    if (!matchId) return
    const ping = async () => {
      await supabase.from('matches')
        .update({ umpire_heartbeat_at: new Date().toISOString() })
        .eq('id', matchId)
    }
    ping()
    const id = setInterval(ping, 30_000)
    return () => clearInterval(id)
  }, [matchId])

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {})
    return () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}) }
  }, [])

  async function handleConfirmStart(firstServerId, firstServerPlayer = null, firstReceiverPlayer = null) {
    await supabase.from('matches').update({
      status:           'active',
      match_started_at: new Date().toISOString(),
      umpire_id:        profile?.id ?? null,
    }).eq('id', matchId)
    await logEvent('match_start', { set_number: gameState.currentSet ?? 1 })

    if (gameState.isRestore) {
      // Resuming mid-match: keep existing scores, just set the current server
      setGameState({
        ...gameState,
        phase:          'playing',
        serverId:       firstServerId,
        serverPlayer:   firstServerPlayer,
        receiverPlayer: firstReceiverPlayer,
        isRestore:      false,
        history:        [],
        future:         [],
      })
    } else {
      const setupGs = startNextSet(gameState, firstServerId, firstServerPlayer, firstReceiverPlayer)
      setGameState({ ...setupGs, startedAt: new Date().toISOString() })
    }
  }

  async function handlePoint(scorerId) {
    const next = addPoint(gameState, scorerId)
    setGameState(next)
    await persistLiveScore(next)
    await logEvent('point', {
      scorer_id:  scorerId === 'p1' ? player1.id : player2.id,
      score_p1:   next.currentSetP1,
      score_p2:   next.currentSetP2,
      set_number: next.currentSet,
    })
  }

  async function handleUndo() {
    const prev = undoLastPoint(gameState)
    setGameState(prev)
    await persistLiveScore(prev)
    await logEvent('undo', { score_p1: prev.currentSetP1, score_p2: prev.currentSetP2, set_number: prev.currentSet })
  }

  async function handleRedo() {
    const next = redoLastPoint(gameState)
    setGameState(next)
    await persistLiveScore(next)
    await logEvent('redo', { score_p1: next.currentSetP1, score_p2: next.currentSetP2, set_number: next.currentSet })
  }

  async function handleShuttle(amount) {
    const next = addShuttle(gameState, amount)
    setGameState(next)
    await supabase.from('matches').update({ shuttle_count: next.shuttleCount }).eq('id', matchId)
    await logEvent('shuttle_change', {
      set_number: gameState.currentSet,
      amount: amount,
      round: next.shuttleLogs?.length
    })
    await supabase.from('match_stats').upsert(
      { match_id: matchId, tournament_id: match.tournament_id, shuttle_logs: next.shuttleLogs ?? [] },
      { onConflict: 'match_id' }
    )
  }

  async function handleStatChange(team, key, newValue) {
    const col = `${team}_${KEY_TO_COL[key]}`
    await supabase.from('match_stats').upsert(
      { match_id: matchId, tournament_id: match.tournament_id, [col]: newValue },
      { onConflict: 'match_id' }
    )
  }

  async function handleAppealLogged(entry) {
    const { data } = await supabase
      .from('match_stats')
      .select('appeal_history')
      .eq('match_id', matchId)
      .maybeSingle()
    const existing = data?.appeal_history ?? []
    await supabase.from('match_stats').upsert(
      { match_id: matchId, tournament_id: match.tournament_id, appeal_history: [...existing, entry] },
      { onConflict: 'match_id' }
    )
  }

  async function handleInjuryTimeout(entry) {
    const { data } = await supabase
      .from('match_stats')
      .select('injury_timeouts')
      .eq('match_id', matchId)
      .maybeSingle()
    const existing = data?.injury_timeouts ?? []
    await supabase.from('match_stats').upsert(
      { match_id: matchId, tournament_id: match.tournament_id, injury_timeouts: [...existing, entry] },
      { onConflict: 'match_id' }
    )
  }

  async function handleContinueSet(firstServerId, firstServerPlayer = null, firstReceiverPlayer = null) {
    const next = startNextSet(gameState, firstServerId, firstServerPlayer, firstReceiverPlayer)
    setGameState(next)
    await persistLiveScore(next)
    await logEvent('interval_end', { set_number: next.currentSet })
  }

  async function handleShuttleRequest() {
    await supabase
      .from('matches')
      .update({ shuttle_request_at: new Date().toISOString() })
      .eq('id', matchId)
  }

  async function handleForceEnd() {
    setGameState(prev => ({ ...prev, phase: 'finished' }))
  }

  async function handleSaveResult() {
    setSaving(true)
    const { p1Scores, p2Scores } = buildFinalScores(gameState.completedSets)
    const p1Sets = gameState.completedSets.filter(s => s.p1 > s.p2).length
    const p2Sets = gameState.completedSets.filter(s => s.p2 > s.p1).length
    const winnerId = p1Sets > p2Sets ? player1.id : player2.id
    const now = new Date().toISOString()
    const durationSeconds = gameState.startedAt
      ? Math.floor((Date.now() - new Date(gameState.startedAt).getTime()) / 1000)
      : null

    await supabase.from('matches').update({
      status:          'completed',
      winner_id:       winnerId,
      player1_scores:  p1Scores,
      player2_scores:  p2Scores,
      live_score_p1:   0,
      live_score_p2:   0,
      call_ended_at:   now,
    }).eq('id', matchId)

    if (durationSeconds !== null) {
      await supabase.from('match_stats').upsert(
        { match_id: matchId, match_duration_seconds: durationSeconds },
        { onConflict: 'match_id' }
      )
    }

    // GL3-D5: clear saved session on match complete
    try { localStorage.removeItem(storageKey) } catch {}

    setSaving(false)
    navigate(-1)
  }

  if (loading) return (
    <div className="fixed inset-0 bg-surface flex items-center justify-center">
      <LoadingSpinner />
    </div>
  )
  if (error) return (
    <div className="fixed inset-0 bg-surface flex items-center justify-center">
      <p className="text-red-500 text-sm">{error}</p>
    </div>
  )

  // GL3-D3: restore/discard banner when saved session found
  if (pendingRestore && player1 && player2) {
    const { savedGs, freshGs } = pendingRestore
    return (
      <RestoreScreen
        title="Phiên trận chưa hoàn thành"
        subtitle={`${player1.name} vs ${player2.name}`}
        detail={`Set ${savedGs.currentSet} — ${savedGs.currentSetP1} : ${savedGs.currentSetP2}`}
        primaryLabel="Tiếp tục từ điểm đã lưu"
        onPrimary={async () => {
          await supabase.from('matches').update({ status: 'active' }).eq('id', matchId)
          setGameState(savedGs)
          setPendingRestore(null)
        }}
        onReset={async () => {
          try { localStorage.removeItem(storageKey) } catch {}
          await supabase.from('matches').update({
            live_score_p1: 0, live_score_p2: 0, live_set_p1: 0, live_set_p2: 0,
            current_set: 1, player1_scores: [], player2_scores: [], status: 'active',
          }).eq('id', matchId)
          setGameState(freshGs)
          setPendingRestore(null)
        }}
      />
    )
  }

  // DB restore banner — no localStorage, but active match with scores in DB
  if (pendingDBRestore && player1 && player2) {
    const { dbGs, freshGs } = pendingDBRestore
    const sets = dbGs.completedSets ?? []
    return (
      <RestoreScreen
        title="Trận đang giữa chừng"
        subtitle={`${player1.name} vs ${player2.name}`}
        detail={[
          sets.length > 0 ? sets.map((s, i) => `H${i + 1}: ${s.p1}–${s.p2}`).join('  ') : null,
          `Hiệp ${dbGs.currentSet} — ${dbGs.currentSetP1} : ${dbGs.currentSetP2}`,
        ].filter(Boolean).join('\n')}
        primaryLabel="Tiếp tục từ điểm hiện tại"
        onPrimary={() => { setGameState(dbGs); setPendingDBRestore(null) }}
        onReset={async () => {
          await supabase.from('matches').update({
            live_score_p1: 0, live_score_p2: 0, live_set_p1: 0, live_set_p2: 0,
            current_set: 1, player1_scores: [], player2_scores: [], status: 'active',
          }).eq('id', matchId)
          setPendingDBRestore(null)
          setGameState(freshGs)
        }}
      />
    )
  }

  if (!gameState) return null

  if (gameState.phase === 'confirm') {
    return <ConfirmStartScreen player1={player1} player2={player2} isDoubles={gameState.isDoubles} onConfirm={handleConfirmStart} onCancel={() => navigate(-1)} />
  }

  if (gameState.phase === 'set_break') {
    return <SetBreakScreen state={gameState} player1={player1} player2={player2} onContinue={handleContinueSet} />
  }

  if (gameState.phase === 'finished') {
    return <MatchSummaryScreen state={gameState} player1={player1} player2={player2} saving={saving} onConfirm={handleSaveResult} />
  }

  return (
    <>
      <ScoringScreen
        state={gameState}
        player1={player1}
        player2={player2}
        onPoint={handlePoint}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onShuttle={handleShuttle}
        onShuttleRequest={handleShuttleRequest}
        onEndMatch={handleForceEnd}
        onStatChange={handleStatChange}
        onAppealLogged={handleAppealLogged}
        onInjuryTimeout={handleInjuryTimeout}
      />
      <ScoreboardLinkButton matchId={matchId} />
    </>
  )
}

function ScoreboardLinkButton({ matchId }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    const url = `${window.location.origin}/scoreboard/${matchId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard not available */ }
  }
  return (
    <button
      onClick={handleCopy}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 bg-white/90 hover:bg-white text-gray-700 text-xs font-medium px-3 py-2 rounded-full border border-gray-200 shadow transition-colors backdrop-blur"
      title="Copy link màn hình chiếu"
    >
      {copied ? '✓ Đã copy' : '📺 Link màn hình'}
    </button>
  )
}

function RestoreScreen({ title, subtitle, detail, primaryLabel, onPrimary, onReset }) {
  return (
    <div className="fixed inset-0 bg-surface flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-xs text-center space-y-4">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900 mb-1">{title}</h2>
          <p className="text-sm text-gray-500 whitespace-pre-line">{subtitle}</p>
          {detail && <p className="text-sm text-blue-600 font-semibold mt-1 whitespace-pre-line">{detail}</p>}
        </div>
        <div className="flex flex-col gap-3 pt-2">
          <button
            onClick={onPrimary}
            className="w-full py-4 rounded-2xl bg-amber-400 text-gray-900 font-extrabold text-base shadow-lg shadow-amber-100 active:scale-[0.98] transition-all"
          >
            {primaryLabel}
          </button>
          <button
            onClick={onReset}
            className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-500 font-bold text-sm hover:bg-red-50 transition-colors"
          >
            Bỏ qua — bắt đầu lại từ 0
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmStartScreen({ player1, player2, isDoubles, onConfirm, onCancel }) {
  const [selectedTeam,     setSelectedTeam]     = useState(null)
  const [selectedServer,   setSelectedServer]   = useState(null)
  const [selectedReceiver, setSelectedReceiver] = useState(null)

  const splitPair = (name) => {
    if (!name) return [null, null]
    const i = name.indexOf(' / ')
    return i >= 0 ? [name.slice(0, i), name.slice(i + 3)] : [name, null]
  }
  const teams = [
    { id: 'p1', name: player1.name, players: splitPair(player1.name) },
    { id: 'p2', name: player2.name, players: splitPair(player2.name) },
  ]
  const receivingTeam = selectedTeam === 'p1' ? teams[1] : (selectedTeam === 'p2' ? teams[0] : null)
  const isReady = selectedTeam && (!isDoubles || (selectedServer && selectedReceiver))

  return (
    <div className="fixed inset-0 bg-surface flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="pt-10 pb-4 text-center px-6">
        <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-2">Trận đấu sắp bắt đầu</p>
        <h1 className="text-3xl font-black text-gray-900 italic">CHUẨN BỊ</h1>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 gap-5 max-w-sm mx-auto w-full">

        <SelectionBlock
          label="Bước 1: Đội nào giao cầu trước?"
          options={teams}
          selected={selectedTeam}
          onSelect={(id) => { setSelectedTeam(id); setSelectedServer(null); setSelectedReceiver(null) }}
        />

        {isDoubles && selectedTeam && (
          <SelectionBlock
            label="Bước 2: Ai là người giao cầu?"
            options={teams.find(t => t.id === selectedTeam).players.filter(Boolean).map(p => ({ id: p, name: p }))}
            selected={selectedServer}
            onSelect={setSelectedServer}
          />
        )}

        {isDoubles && selectedTeam && selectedServer && (
          <SelectionBlock
            label="Bước 3: Ai là người nhận cầu?"
            options={receivingTeam.players.filter(Boolean).map(p => ({ id: p, name: p }))}
            selected={selectedReceiver}
            onSelect={setSelectedReceiver}
          />
        )}
      </div>

      <div className="px-6 pt-6 pb-8 max-w-sm mx-auto w-full flex flex-col gap-3">
        <button
          disabled={!isReady}
          onClick={() => onConfirm(
            selectedTeam,
            isDoubles ? selectedServer   : teams.find(t => t.id === selectedTeam).name,
            isDoubles ? selectedReceiver : receivingTeam.name,
          )}
          className={cn(
            'w-full py-5 rounded-2xl font-extrabold text-lg transition-all',
            isReady
              ? 'bg-amber-400 text-gray-900 shadow-lg shadow-amber-100 active:scale-[0.98]'
              : 'bg-gray-100 text-gray-300 cursor-not-allowed',
          )}
        >
          Sẵn sàng
        </button>
        <button
          onClick={onCancel}
          className="w-full py-2.5 text-sm font-bold text-gray-400 uppercase tracking-widest italic"
        >
          Huỷ bỏ
        </button>
      </div>
    </div>
  )
}

function SelectionBlock({ label, options, selected, onSelect }) {
  return (
    <div className="w-full">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest text-center mb-2">
        {label}
      </p>
      <div className="flex gap-3">
        {options.map(o => (
          <button
            key={o.id}
            onClick={() => onSelect(o.id)}
            className={cn(
              'flex-1 py-4 rounded-xl border-2 font-bold text-sm transition-all',
              selected === o.id
                ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100'
                : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300',
            )}
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  )
}
