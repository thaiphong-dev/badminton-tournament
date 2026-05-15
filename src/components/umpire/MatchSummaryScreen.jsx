import { Trophy, Loader2 } from 'lucide-react'
import '@/components/umpire/UmpireScoring.scss'

/**
 * End-of-match summary. Shows winner, set breakdown, and save button.
 */
export default function MatchSummaryScreen({ state, player1, player2, saving, onConfirm }) {
  const { completedSets } = state
  const p1Sets  = completedSets.filter(s => s.p1 > s.p2).length
  const p2Sets  = completedSets.filter(s => s.p2 > s.p1).length
  const winner  = p1Sets > p2Sets ? player1 : player2
  const winSets = Math.max(p1Sets, p2Sets)
  const losSets = Math.min(p1Sets, p2Sets)
  
  return (
    <div className="umpire-screen summary-screen">
      <div className="screen-content-max flex flex-col items-center">

        {/* Winner Announcement */}
        <div className="winner-display">
          <div className="trophy-badge">
            <Trophy className="w-12 h-12" />
          </div>
          <p className="summary-status">Trận đấu kết thúc</p>
          <h1 className="winner-name-large">{winner?.name}</h1>
          <p className="match-total-score">
            Thắng <span>{winSets}</span> - {losSets}
          </p>
        </div>

        {/* Set breakdown table */}
        <div className="breakdown-table">
          <div className="table-header">
            <span className="header-name-p1 truncate">{player1?.name}</span>
            <span className="header-label">Set</span>
            <span className="header-name-p2 truncate">{player2?.name}</span>
          </div>

          {completedSets.map((s, i) => {
            const p1Won = s.p1 > s.p2
            return (
              <div key={i} className="table-row">
                <span className={`row-score-p1 ${p1Won ? 'winner-set' : 'loser-set'}`}>
                  {s.p1}
                </span>
                <span className="row-label">SET {i + 1}</span>
                <span className={`row-score-p2 ${!p1Won ? 'winner-set' : 'loser-set'}`}>
                  {s.p2}
                </span>
              </div>
            )
          })}
        </div>

        {/* Shuttle Stats */}
        <div style={{ marginTop: -20, marginBottom: 30, textAlign: 'center', opacity: 0.6 }}>
          <p style={{ fontSize: 13, fontWeight: 700 }}>
            Tổng số cầu đã sử dụng: <span style={{ color: 'var(--cyan)' }}>{state.shuttleCount || 0}</span> quả
          </p>
        </div>

        {/* Final Action */}
        <div className="action-footer">
          <button
            onClick={onConfirm}
            disabled={saving}
            className={`primary-btn ${!saving ? 'ready' : ''}`}
          >
            {saving ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'LƯU KẾT QUẢ'}
          </button>
        </div>
      </div>
    </div>
  )
}
