import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { Clock } from 'lucide-react'
import '@/components/umpire/UmpireScoring.scss'

/**
 * Between-set break screen.
 * Shows set result, interval countdown, and server/receiver selection for next set.
 */
export default function SetBreakScreen({ state, player1, player2, onContinue }) {
  // Pre-select the set winner as server (BWF rule: set winner serves next set)
  const [selectedServerTeam, setSelectedServerTeam] = useState(state.setJustWon ?? null)
  const [selectedServerPlayer, setSelectedServerPlayer] = useState(null)
  const [selectedReceiverPlayer, setSelectedReceiverPlayer] = useState(null)
  const [countdown, setCountdown]           = useState(120)

  const { completedSets, setJustWon, isDoubles } = state
  const setWinner  = setJustWon === 'p1' ? player1 : player2
  const p1Sets     = completedSets.filter(s => s.p1 > s.p2).length
  const p2Sets     = completedSets.filter(s => s.p2 > s.p1).length

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const mins = Math.floor(countdown / 60)
  const secs = String(countdown % 60).padStart(2, '0')

  const splitPair = (name) => {
    if (!name) return [null, null]
    const i = name.indexOf(' / ')
    return i >= 0 ? [name.slice(0, i), name.slice(i + 3)] : [name, null]
  }

  const teams = [
    { id: 'p1', name: player1.name, players: splitPair(player1.name) },
    { id: 'p2', name: player2.name, players: splitPair(player2.name) },
  ]
  const receivingTeam = selectedServerTeam === 'p1' ? teams[1] : (selectedServerTeam === 'p2' ? teams[0] : null)

  const isReady = selectedServerTeam && (!isDoubles || (selectedServerPlayer && selectedReceiverPlayer))

  // Keep a ref with latest values so the auto-start effect has no stale closures
  const autoDataRef = useRef(null)
  useLayoutEffect(() => {
    autoDataRef.current = { isReady, selectedServerTeam, selectedServerPlayer, selectedReceiverPlayer, isDoubles, teams, onContinue }
  })

  // Auto-start when timer reaches 0 and server is already selected
  useEffect(() => {
    if (countdown !== 0) return
    const d = autoDataRef.current
    if (!d?.isReady) return
    const team = d.teams.find(t => t.id === d.selectedServerTeam)
    const receiving = d.selectedServerTeam === 'p1' ? d.teams[1] : d.teams[0]
    d.onContinue(
      d.selectedServerTeam,
      d.isDoubles ? d.selectedServerPlayer : team.name,
      d.isDoubles ? d.selectedReceiverPlayer : receiving.name,
    )
  }, [countdown]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="umpire-screen set-break-screen">
      
      <div className="break-header">
        <p className="break-header-label">
          Kết thúc ván {completedSets.length}
        </p>
      </div>

      <div className="break-content">
        
        {/* Winner Announcement */}
        <div className="winner-section">
          <div className="winner-badge">
            <span className="winner-initial">{setWinner?.name?.[0]?.toUpperCase()}</span>
          </div>
          <p className="winner-name">{setWinner?.name} THẮNG</p>
          <p className="current-match-score">TỈ SỐ HIỆN TẠI: {p1Sets} - {p2Sets}</p>
        </div>

        {/* Breakdown Card */}
        <div className="breakdown-card">
           {completedSets.map((s, i) => (
             <div key={i} className="set-pill">
               {s.p1} - {s.p2}
             </div>
           ))}
        </div>

        {/* Interval Timer */}
        <div className="interval-section">
          <p className="interval-label">Nghỉ giải lao 2 phút</p>
          <div className="timer-display">
            <Clock size={32} color={countdown <= 10 ? '#ef4444' : 'var(--cyan)'} />
            <span className={`timer-val ${countdown <= 10 ? 'urgent' : ''}`}>
              {mins}:{secs}
            </span>
          </div>
        </div>

        {/* Next Server Selection */}
        <div className="screen-content-max">
          <p className="step-indicator">BƯỚC 1: ĐỘI NÀO GIAO CẦU TIẾP THEO?</p>
          <div className="selection-grid">
            {teams.map(t => (
              <button 
                key={t.id}
                onClick={() => { setSelectedServerTeam(t.id); setSelectedServerPlayer(null); setSelectedReceiverPlayer(null) }}
                className={`selection-btn ${selectedServerTeam === t.id ? 'active' : ''}`}
              >
                {t.name}
              </button>
            ))}
          </div>

          {isDoubles && selectedServerTeam && (
            <div className="mb-8">
              <p className="step-indicator">BƯỚC 2: AI LÀ NGƯỜI GIAO CẦU?</p>
              <div className="selection-grid">
                {teams.find(t => t.id === selectedServerTeam).players.filter(Boolean).map(p => (
                  <button 
                    key={p}
                    onClick={() => setSelectedServerPlayer(p)}
                    className={`selection-btn ${selectedServerPlayer === p ? 'active' : ''}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isDoubles && selectedServerTeam && selectedServerPlayer && (
            <div className="mb-10">
              <p className="step-indicator">BƯỚC 3: AI LÀ NGƯỜI NHẬN CẦU?</p>
              <div className="selection-grid">
                {receivingTeam.players.filter(Boolean).map(p => (
                  <button 
                    key={p}
                    onClick={() => setSelectedReceiverPlayer(p)}
                    className={`selection-btn ${selectedReceiverPlayer === p ? 'active' : ''}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Start Button */}
        <div className="action-footer">
          <button 
            disabled={!isReady}
            onClick={() => onContinue(selectedServerTeam, isDoubles ? selectedServerPlayer : teams.find(t => t.id === selectedServerTeam).name, isDoubles ? selectedReceiverPlayer : receivingTeam.name)}
            className={`primary-btn ${isReady ? 'ready' : ''}`}
          >
            BẮT ĐẦU VÁN {completedSets.length + 1}
          </button>
        </div>

      </div>
    </div>
  )
}
