import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Undo2, Redo2, ArrowLeftRight, Clock, 
  MessageSquare, UserCircle, RotateCcw, Pause, 
  LogOut, BarChart3, ShieldAlert, UserX, Menu, X
} from 'lucide-react'
import { getScoreLabel } from '@/lib/utils/umpireLogic'
import './UmpireScoring.scss'

/* ─── orientation hook ────────────────────────────────────────────── */
function useIsLandscape() {
  const [ls, setLs] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false,
  )
  useEffect(() => {
    const h = () => setLs(window.innerWidth > window.innerHeight)
    window.addEventListener('resize', h)
    window.addEventListener('orientationchange', h)
    return () => { window.removeEventListener('resize', h); window.removeEventListener('orientationchange', h) }
  }, [])
  return ls
}

/* ─── helpers ─────────────────────────────────────────────────────── */
const SCORE_WORDS = [
  'Love','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
  'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen',
  'Nineteen','Twenty','Twenty-one','Twenty-two','Twenty-three','Twenty-four','Twenty-five',
  'Twenty-six','Twenty-seven','Twenty-eight','Twenty-nine','Thirty',
]
function buildCall(state) {
  const { currentSetP1, currentSetP2, serverId } = state
  const s = serverId === 'p1' ? currentSetP1 : currentSetP2
  const r = serverId === 'p1' ? currentSetP2 : currentSetP1
  const sw = SCORE_WORDS[s] ?? s
  const rw = SCORE_WORDS[r] ?? r
  if (s === 0 && r === 0) return 'Love all. Play.'
  if (r === 0) return `${sw}. Love.`
  if (s === r) return `${sw} all.`
  return `${sw}. ${rw}.`
}

function SlimActionBtn({ team, flash, onTap }) {
  return (
    <button onPointerDown={() => onTap(team)} className={`slim-action-btn ${flash === team ? `flash-${team}` : ''}`}>
      <span className={`slim-action-btn-text ${team}`}>+1</span>
      {flash === team && <div className={`slim-action-btn-overlay ${team}`} />}
    </button>
  )
}

/* ══════════════════════════════════════════════════════════════════ */
export default function ScoringScreen({ state, player1, player2, onPoint, onUndo, onRedo, onShuttle, onShuttleRequest, onEndMatch, onStatChange, onAppealLogged, onInjuryTimeout }) {
  const [confirmEnd,   setConfirmEnd]   = useState(false)
  const [flash,        setFlash]        = useState(null)
  const [floatingPoint, setFloatingPoint] = useState(null)
  const pointIdRef = useRef(0)
  const [elapsed,      setElapsed]      = useState(0)
  const [sidesSwapped, setSidesSwapped] = useState(false)
  const [showMenu,     setShowMenu]     = useState(false)
  const [showInterval, setShowInterval] = useState(false)
  const intervalSeenRef = useRef(null)
  const [showShuttleModal, setShowShuttleModal] = useState(false)
  const [shuttleRoundAmount, setShuttleRoundAmount] = useState(1)
  const [showStats,   setShowStats]   = useState(false)
  const [showAppeal,  setShowAppeal]  = useState(false)
  const [showInjury,  setShowInjury]  = useState(false)
  const [showRetired, setShowRetired] = useState(false)
  const [showPause,   setShowPause]   = useState(false)
  // { [setNum]: { p1: remaining, p2: remaining } } — defaults to 2 per set per BWF
  const [appealsBySet,  setAppealsBySet]  = useState({})
  const [appealHistory, setAppealHistory] = useState([])
  const [playerStats,   setPlayerStats]   = useState({
    p1: { serviceFaults: 0, yellowCards: 0, redCards: 0 },
    p2: { serviceFaults: 0, yellowCards: 0, redCards: 0 },
  })
  const isLandscape = useIsLandscape()

  const {
    currentSetP1, currentSetP2, completedSets,
    serverId, serverPlayer, pointsPerSet, startedAt, 
    history, future, isDoubles, totalSets
  } = state

  const label  = getScoreLabel(currentSetP1, currentSetP2, pointsPerSet, completedSets, totalSets)
  const setNum = completedSets.length + 1

  useEffect(() => {
    if (!startedAt) return
    const origin = new Date(startedAt).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - origin) / 1000))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [startedAt])

  const timerText = `${String(Math.floor(elapsed / 60)).padStart(2,'0')}:${String(elapsed % 60).padStart(2,'0')}`

  useEffect(() => {
    const maxScore = Math.max(currentSetP1, currentSetP2)
    if (maxScore === 11 && intervalSeenRef.current !== setNum) {
      intervalSeenRef.current = setNum
      setShowInterval(true)
    }
  }, [currentSetP1, currentSetP2, setNum])

  const topTeam = sidesSwapped ? 'p2' : 'p1'
  const botTeam = sidesSwapped ? 'p1' : 'p2'
  const announcement = label || buildCall(state)

  const handleTap = useCallback((team) => {
    setFlash(team)
    const id = ++pointIdRef.current
    setFloatingPoint({ team, id })
    setTimeout(() => setFlash(null), 150)
    setTimeout(() => setFloatingPoint(curr => curr?.id === id ? null : curr), 1000)
    onPoint(team)
  }, [onPoint])

  const Header = (
    <div className="umpire-header">
      <div className="timer-badge-container">
        <div className="timer-badge">
          <Clock size={12} color="rgba(255,255,255,0.5)" />
          <span className="timer-text">{timerText}</span>
        </div>
      </div>

      <div className="action-group">
        <ActionBtnSquare 
          icon={<ShuttleIcon />} 
          onClick={() => setShowShuttleModal(true)} 
          className={state.shuttleCount > 0 ? 'active-tint' : ''}
        />
        <ActionBtnSquare icon={<MessageSquare size={22} className="text-cyan-400" />} onClick={() => onShuttleRequest?.()} />
        <ActionBtnSquare icon={<AppealIcon size={22} className="text-cyan-400" />} />
      </div>

      <div className="scoreboard-container">
          <div className="scoreboard-card">
            <div className="score-main">
              <div className="score-row p1">
                <span className="score-item-prefix">-</span>
                <span className="score-item-name">{player1.name}</span>
                {serverId === 'p1' && <div className="server-dot" />}

                {completedSets.map((s, i) => (
                  <span key={i} className="score-item-prev">{s.p1}</span>
                ))}

                {completedSets.length > 0 && <span className="score-item-sep">|</span>}
                <span className={`score-item-val ${serverId === 'p1' ? 'serving' : ''}`}>{currentSetP1}</span>
              </div>
              <div className="score-row p2">
                <span className="score-item-prefix">-</span>
                <span className="score-item-name">{player2.name}</span>
                {serverId === 'p2' && <div className="server-dot" />}

                {completedSets.map((s, i) => (
                  <span key={i} className="score-item-prev">{s.p2}</span>
                ))}
                {completedSets.length > 0 && <span className="score-item-sep">|</span>}
                <span className={`score-item-val ${serverId === 'p2' ? 'serving' : ''}`}>{currentSetP2}</span>
              </div>
            </div>
          </div>

          <div className="announcement-bubble-container">
            <div className="announcement-bubble">
                {announcement.toUpperCase()}
            </div>
          </div>
      </div>

      <div className="action-group">
        <ActionBtnSquare icon={<Undo2 size={22} />} onClick={onUndo} disabled={!history.length} />
        <ActionBtnSquare icon={<Redo2 size={22} />} onClick={onRedo} disabled={!future.length} />
        <ActionBtnSquare icon={<Menu size={22} />} onClick={() => setShowMenu(true)} />
      </div>
    </div>
  )

  const CourtArea = (
    <div className="court-container">
      <CourtLines isLandscape={isLandscape} />
      <CourtPlayer name={state.p1PlayerR} team="p1" pos="R" isServer={serverId === 'p1' && serverPlayer === state.p1PlayerR} isTop={!sidesSwapped} isLandscape={isLandscape} />
      <CourtPlayer name={state.p1PlayerL} team="p1" pos="L" isServer={serverId === 'p1' && serverPlayer === state.p1PlayerL} isTop={!sidesSwapped} isLandscape={isLandscape} />
      <CourtPlayer name={state.p2PlayerR} team="p2" pos="R" isServer={serverId === 'p2' && serverPlayer === state.p2PlayerR} isTop={sidesSwapped} isLandscape={isLandscape} />
      <CourtPlayer name={state.p2PlayerL} team="p2" pos="L" isServer={serverId === 'p2' && serverPlayer === state.p2PlayerL} isTop={sidesSwapped} isLandscape={isLandscape} />

      {floatingPoint && (
        <div key={floatingPoint.id} className="animate-point-up" style={{ top: floatingPoint.team === topTeam ? '20%' : '80%' }}>
          +1
        </div>
      )}

      <div className="net-controls" style={{ flexDirection: isLandscape ? 'row' : 'column' }}>
        <button className="net-btn" onClick={() => setSidesSwapped(v => !v)}><ArrowLeftRight size={20} /></button>
        <button className="net-btn" onClick={() => {}} style={{ color: 'var(--cyan)' }}><RotateCcw size={20} /></button>
      </div>
    </div>
  )

  return (
    <div className="umpire-container">
      {Header}

      <div style={{ height: 20 }} />

      <div className="umpire-body">
        <SlimActionBtn team={topTeam} flash={flash} onTap={handleTap} />
        <div style={{ flex: 1 }}>{CourtArea}</div>
        <SlimActionBtn team={botTeam} flash={flash} onTap={handleTap} />
      </div>

      {showMenu && (
        <MenuModal
          onClose={() => setShowMenu(false)}
          onShuttle={() => setShowShuttleModal(true)}
          onStats={() => setShowStats(true)}
          onAppeal={() => setShowAppeal(true)}
          onInjury={() => setShowInjury(true)}
          onRetired={() => setShowRetired(true)}
          onPause={() => setShowPause(true)}
          onEnd={() => setConfirmEnd(true)}
        />
      )}
      {showInterval && <IntervalSheet seconds={60} label="Nghỉ giải lao 1 phút" onContinue={() => setShowInterval(false)} />}
      {confirmEnd && <EndMatchModal onCancel={() => setConfirmEnd(false)} onConfirm={() => { setConfirmEnd(false); onEndMatch() }} s1={currentSetP1} s2={currentSetP2} />}
      {showStats  && (
        <StatsModal
          playerStats={playerStats}
          setPlayerStats={setPlayerStats}
          player1={player1}
          player2={player2}
          onStatChange={onStatChange}
          onClose={() => setShowStats(false)}
        />
      )}
      {showAppeal && (
        <AppealModal
          player1={player1}
          player2={player2}
          setNum={setNum}
          elapsed={elapsed}
          appealsBySet={appealsBySet}
          setAppealsBySet={setAppealsBySet}
          appealHistory={appealHistory}
          setAppealHistory={setAppealHistory}
          onAppealLogged={onAppealLogged}
          onClose={() => setShowAppeal(false)}
        />
      )}
      {showInjury  && (
        <IntervalSheet
          seconds={180}
          label="Chấn thương - 3 phút"
          onContinue={() => setShowInjury(false)}
          onCompleted={(durationSeconds) => onInjuryTimeout?.({
            duration_seconds: durationSeconds,
            set_num: state.currentSet,
            at: new Date().toISOString(),
          })}
        />
      )}
      {showRetired && <RetiredModal player1={player1} player2={player2} onClose={() => setShowRetired(false)} onConfirm={() => { setShowRetired(false); onEndMatch() }} />}
      {showPause   && <PauseSheet onContinue={() => setShowPause(false)} />}
      
      {showShuttleModal && (
        <ShuttleCounterModal 
          round={(state.shuttleLogs?.length || 0) + 1}
          count={shuttleRoundAmount}
          setCount={setShuttleRoundAmount}
          onClose={() => setShowShuttleModal(false)}
          onConfirm={() => {
            onShuttle(shuttleRoundAmount)
            setShowShuttleModal(false)
            setShuttleRoundAmount(1)
          }}
        />
      )}
    </div>
  )
}

/* ─── Components ──────────────────────────────────────────────────── */

function ActionBtnSquare({ icon, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className="action-btn-square">
      {icon}
    </button>
  )
}

function CourtPlayer({ name, team, pos, isServer, isTop, isLandscape }) {
  if (!name) return null
  let x = 0, y = 0
  if (!isLandscape) {
    y = isTop ? 28 : 72
    if (isTop) x = pos === 'R' ? 30 : 70
    else x = pos === 'R' ? 70 : 30
  } else {
    x = isTop ? 30 : 70
    if (isTop) y = pos === 'R' ? 70 : 30
    else y = pos === 'R' ? 30 : 70
  }
  return (
    <div className="player-container" style={{ top: `${y}%`, left: `${x}%` }}>
      <div className={`player-avatar-circle ${isServer ? `is-server-${team}` : ''}`}>
        <UserCircle size={22} color={isServer ? '#000' : 'rgba(255,255,255,0.3)'} />
        {isServer && (
          <div className="player-server-badge" style={{ background: `var(--${team === 'p1' ? 'cyan' : 'amber'})` }}>
            SERVER
          </div>
        )}
      </div>
      <div className={`player-name-label ${isServer ? `serving-${team}` : ''}`}>{name}</div>
    </div>
  )
}

function CourtLines({ isLandscape }) {
  if (!isLandscape) return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: '10px 12px', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: 2 }} />
      <div className="court-line court-line-bold" style={{ top: '50%', left: 12, right: 12, height: 1.5 }} />
      <div className="court-line" style={{ top: 10, bottom: 10, left: '50%', width: 1 }} />
      <div className="court-line" style={{ top: '35%', left: 12, right: 12, height: 1 }} />
      <div className="court-line" style={{ top: '65%', left: 12, right: 12, height: 1 }} />
    </div>
  )
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
       <div style={{ position: 'absolute', inset: '12px 10px', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: 2 }} />
       <div className="court-line court-line-bold" style={{ left: '50%', top: 12, bottom: 12, width: 1.5 }} />
       <div className="court-line" style={{ left: 10, right: 10, top: '50%', height: 1 }} />
       <div className="court-line" style={{ left: '35%', top: 12, bottom: 12, width: 1 }} />
       <div className="court-line" style={{ left: '65%', top: 12, bottom: 12, width: 1 }} />
    </div>
  )
}

function MenuModal({ onClose, onEnd, onShuttle, onStats, onAppeal, onInjury, onRetired, onPause }) {
  const items = [
    { icon: <ShuttleIcon />,         label: "Thêm quả cầu lông...",              onClick: onShuttle },
    { icon: <BarChart3 size={24} />, label: "Số liệu thống kê tuyển thủ...",     onClick: onStats },
    { icon: <AppealIcon size={24} />,label: "Tuyển thủ khiếu nại...",            onClick: onAppeal },
    { icon: <ShieldAlert size={24} />,label: "Bộ đếm thời gian chấn thương...", onClick: onInjury },
    { icon: <UserX size={24} />,     label: "Tuyển thủ đã bỏ cuộc...",          onClick: onRetired },
    { icon: <Pause size={24} />,     label: "Tạm dừng trận đấu...",             onClick: onPause },
    { icon: <LogOut size={24} />,    label: "Rời trận đấu...",                  onClick: onEnd },
  ]
  return (
    <div className="modal-overlay modal-bottom" onClick={onClose}>
      <div className="modal-content-bottom" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        {items.map((item, i) => (
          <button key={i} onClick={() => { item.onClick(); onClose() }} className="menu-item">
            <span className="menu-item-icon">{item.icon}</span>
            <span className="menu-item-label">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function IntervalSheet({ seconds, label, onContinue, onCompleted }) {
  const [rem, setRem] = useState(seconds)
  useEffect(() => {
    if (rem <= 0) return
    const t = setInterval(() => setRem(r => r - 1), 1000)
    return () => clearInterval(t)
  }, [rem])
  const R = 40, C = 2 * Math.PI * R
  const offset = C * (1 - rem / seconds)
  return (
    <div className="modal-overlay modal-bottom">
      <div style={{ width: '100%', background: '#111', borderRadius: '28px 28px 0 0', padding: '24px 24px 50px' }}>
        <p style={{ fontSize: 24, fontWeight: 900, marginBottom: 4 }}>KHOẢNG THỜI GIAN</p>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 30, fontSize: 15, fontWeight: 700 }}>{label}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 40 }}>
           <div style={{ position: 'relative', width: 110, height: 110 }}>
             <svg width="110" height="110" style={{ transform: 'rotate(-90deg)' }}>
               <circle cx="55" cy="55" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
               <circle cx="55" cy="55" r={R} fill="none" stroke="var(--cyan)" strokeWidth="8" strokeDasharray={C} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
             </svg>
             <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900, fontFamily: 'monospace' }}>
               {String(Math.floor(rem/60)).padStart(2,'0')}:{String(rem%60).padStart(2,'0')}
             </div>
           </div>
        </div>
        <button onClick={() => { onCompleted?.(seconds - rem); onContinue() }} style={{ width: '100%', padding: 20, borderRadius: 18, background: 'var(--cyan)', color: '#000', fontWeight: 900, fontSize: 20, border: 'none', boxShadow: `0 10px 30px rgba(34,211,238,0.3)` }}>Xác nhận</button>
      </div>
    </div>
  )
}

function ShuttleCounterModal({ round, count, setCount, onClose, onConfirm }) {
  return (
    <div className="modal-overlay screen-center" onClick={onClose}>
      <div className="shuttle-change-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <ShuttleIcon className="shuttle-icon-small" />
          <span className="modal-title">Thêm quả cầu lông</span>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <p className="entry-label">Lượt {round}</p>
          <div className="counter-card" style={{ padding: '24px 32px' }}>
            <p className="counter-title" style={{ marginBottom: 12, textAlign: 'left', width: '100%' }}>Bộ đếm quả cầu</p>
            <div className="counter-controls">
              <button 
                className="control-btn" 
                onClick={() => setCount(Math.max(0, count - 1))}
                style={{ background: '#252527', width: 64, height: 48, fontSize: 32 }}
              >-</button>
              <span className="counter-val" style={{ fontSize: 48 }}>{count}</span>
              <button 
                className="control-btn" 
                onClick={() => setCount(count + 1)}
                style={{ background: '#434b58', width: 64, height: 48, fontSize: 32 }}
              >+</button>
            </div>
          </div>
          <div className="modal-footer" style={{ width: '100%', marginTop: 24, display: 'flex', justifyContent: 'center' }}>
             <button onClick={onConfirm} className="shuttle-confirm-btn">XÁC NHẬN</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EndMatchModal({ onCancel, onConfirm, s1, s2 }) {
  return (
    <div className="modal-overlay" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '85%', maxWidth: 320, background: '#111', borderRadius: 24, padding: 30, textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
        <ShieldAlert size={56} color="var(--amber)" style={{ margin: '0 auto 20px' }} />
        <p style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>KẾT THÚC TRẬN?</p>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 30, fontWeight: 600 }}>Tỉ số hiện tại: {s1} - {s2}</p>
        <div style={{ display: 'flex', gap: 14 }}>
           <button onClick={onCancel} style={{ flex: 1, padding: 16, borderRadius: 14, background: 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', fontWeight: 800 }}>HUỶ</button>
           <button onClick={onConfirm} style={{ flex: 1, padding: 16, borderRadius: 14, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 800 }}>ĐỒNG Ý</button>
        </div>
      </div>
    </div>
  )
}

const STAT_ROWS = [
  { key: 'serviceFaults', label: 'Lỗi phát cầu',   icon: '🏸' },
  { key: 'yellowCards',   label: 'Thẻ vàng',        icon: '🟨' },
  { key: 'redCards',      label: 'Thẻ đỏ',          icon: '🟥' },
]

function StatsModal({ playerStats, setPlayerStats, player1, player2, onStatChange, onClose }) {
  function adjust(team, key, delta) {
    const newVal = Math.max(0, playerStats[team][key] + delta)
    setPlayerStats(prev => ({ ...prev, [team]: { ...prev[team], [key]: newVal } }))
    onStatChange?.(team, key, newVal)
  }

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }
  const card    = { width: '92%', maxWidth: 380, background: '#111', borderRadius: 24, padding: 24, border: '1px solid rgba(255,255,255,0.08)' }

  const CountCell = ({ team, statKey }) => {
    const val = playerStats[team][statKey]
    const color = team === 'p1' ? 'var(--cyan)' : 'var(--amber)'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: team === 'p1' ? 'flex-start' : 'flex-end' }}>
        {team === 'p2' && (
          <button onClick={() => adjust(team, statKey, 1)}
            style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        )}
        <span style={{ color, fontSize: 22, fontWeight: 900, fontFamily: 'monospace', minWidth: 28, textAlign: 'center' }}>{val}</span>
        {team === 'p1' && (
          <button onClick={() => adjust(team, statKey, 1)}
            style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        )}
        <button onClick={() => adjust(team, statKey, -1)} disabled={val === 0}
          style={{ width: 32, height: 32, borderRadius: 8, background: val > 0 ? 'rgba(255,255,255,0.05)' : 'transparent', border: 'none', color: val > 0 ? '#aaa' : '#444', fontSize: 20, cursor: val > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
      </div>
    )
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>THỐNG KÊ TRẬN ĐẤU</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
          <span style={{ color: 'var(--cyan)', fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player1.name}</span>
          <span />
          <span style={{ color: 'var(--amber)', fontWeight: 700, fontSize: 12, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player2.name}</span>
        </div>

        {STAT_ROWS.map(({ key, label, icon }) => (
          <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', alignItems: 'center', padding: '10px 4px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <CountCell team="p1" statKey={key} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18 }}>{icon}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, marginTop: 2 }}>{label.toUpperCase()}</div>
            </div>
            <CountCell team="p2" statKey={key} />
          </div>
        ))}

        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 16, textAlign: 'center' }}>
          Nhấn + để ghi nhận sự kiện • Nhấn − để sửa
        </p>
      </div>
    </div>
  )
}

function AppealModal({ player1, player2, setNum, elapsed, appealsBySet, setAppealsBySet, appealHistory, setAppealHistory, onAppealLogged, onClose }) {
  const [step,            setStep]            = useState('list') // 'list' | 'select' | 'result'
  const [challengingTeam, setChallengingTeam] = useState(null)
  const [result,          setResult]          = useState(null)

  // Per-set remaining: default 2 for any set not yet seen
  const currentSetAppeals = appealsBySet[setNum] ?? { p1: 2, p2: 2 }

  const teamDefs = [
    { id: 'p1', player: player1, color: 'var(--cyan)' },
    { id: 'p2', player: player2, color: 'var(--amber)' },
  ]
  const challengingDef = teamDefs.find(t => t.id === challengingTeam)

  function handleChallenge(teamId) {
    setChallengingTeam(teamId)
    setResult(null)
    setStep('result')
  }

  function handleResult(res) {
    setResult(res)
    const timestamp = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
    const entry = { timestamp, setNum, team: challengingTeam, teamName: challengingDef?.player.name, result: res }
    setAppealHistory(prev => [entry, ...prev])
    // Deduct only on overruled (successful challenge retains per BWF)
    if (res === 'overruled') {
      setAppealsBySet(prev => {
        const cur = prev[setNum] ?? { p1: 2, p2: 2 }
        return { ...prev, [setNum]: { ...cur, [challengingTeam]: Math.max(0, cur[challengingTeam] - 1) } }
      })
    }
    onAppealLogged?.(entry)
  }

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }
  const card    = { width: '92%', maxWidth: 360, background: '#111', borderRadius: 24, padding: 24, border: '1px solid rgba(255,255,255,0.08)', maxHeight: '80vh', overflowY: 'auto' }
  const teamBtn = (enabled, color) => ({
    width: '100%', marginBottom: 12, padding: '14px 18px', borderRadius: 14,
    background: 'rgba(255,255,255,0.04)', border: `1px solid ${enabled ? color : 'rgba(255,255,255,0.08)'}`,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    opacity: enabled ? 1 : 0.38, cursor: enabled ? 'pointer' : 'default',
  })

  return (
    <div style={overlay} onClick={step !== 'result' || result ? onClose : undefined}>
      <div style={card} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <p style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>KHIẾU NẠI</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {step !== 'list' && (
              <button onClick={() => { setStep('list'); setChallengingTeam(null); setResult(null) }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer' }}>← Lịch sử</button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
          </div>
        </div>

        {/* ── LIST / HISTORY step ── */}
        {step === 'list' && (
          <>
            {/* Remaining per team for current set */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
              {teamDefs.map(({ id, player, color }) => (
                <div key={id} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 12px', textAlign: 'center', border: `1px solid ${color}22` }}>
                  <p style={{ color, fontSize: 11, fontWeight: 700, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</p>
                  <p style={{ fontSize: 24, fontWeight: 900, fontFamily: 'monospace', color: currentSetAppeals[id] > 0 ? '#fff' : '#ef4444', margin: 0 }}>{currentSetAppeals[id]}</p>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 2 }}>lần còn lại (ván {setNum})</p>
                </div>
              ))}
            </div>

            {/* New challenge button */}
            <button onClick={() => setStep('select')}
              style={{ width: '100%', padding: 16, borderRadius: 14, background: 'var(--cyan)', color: '#000', fontWeight: 900, fontSize: 15, border: 'none', cursor: 'pointer', marginBottom: 20 }}>
              + KHIẾU NẠI MỚI
            </button>

            {/* History */}
            {appealHistory.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>Chưa có khiếu nại nào</p>
            ) : (
              <>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>LỊCH SỬ</p>
                {appealHistory.map((h, i) => {
                  const color = h.team === 'p1' ? 'var(--cyan)' : 'var(--amber)'
                  const upheld = h.result === 'upheld'
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: 'monospace', flexShrink: 0 }}>{h.timestamp}</span>
                      <span style={{ color, fontSize: 12, fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.teamName}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>V{h.setNum}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: upheld ? '#4ade80' : '#f87171', flexShrink: 0 }}>
                        {upheld ? 'CHẤP NHẬN' : 'BÁC BỎ'}
                      </span>
                    </div>
                  )
                })}
              </>
            )}
          </>
        )}

        {/* ── SELECT TEAM step ── */}
        {step === 'select' && (
          <>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 16 }}>Đội nào đang khiếu nại?</p>
            {teamDefs.map(({ id, player, color }) => (
              <button key={id} onClick={() => currentSetAppeals[id] > 0 && handleChallenge(id)}
                style={teamBtn(currentSetAppeals[id] > 0, color)}>
                <span style={{ color, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{player.name}</span>
                <span style={{ color: currentSetAppeals[id] > 0 ? 'rgba(255,255,255,0.4)' : '#ef4444', fontSize: 12, flexShrink: 0, marginLeft: 8 }}>
                  {currentSetAppeals[id]} lần còn lại
                </span>
              </button>
            ))}
          </>
        )}

        {/* ── RESULT step ── */}
        {step === 'result' && !result && (
          <>
            <p style={{ color: challengingDef?.color, fontWeight: 700, marginBottom: 4 }}>{challengingDef?.player.name}</p>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 22 }}>Kết quả khiếu nại?</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => handleResult('upheld')}
                style={{ flex: 1, padding: 18, borderRadius: 14, background: '#15803d', color: '#fff', fontWeight: 800, border: 'none', fontSize: 15, cursor: 'pointer' }}>
                CHẤP NHẬN
              </button>
              <button onClick={() => handleResult('overruled')}
                style={{ flex: 1, padding: 18, borderRadius: 14, background: '#b91c1c', color: '#fff', fontWeight: 800, border: 'none', fontSize: 15, cursor: 'pointer' }}>
                BÁC BỎ
              </button>
            </div>
          </>
        )}

        {step === 'result' && result && (() => {
          const upheld = result === 'upheld'
          const remaining = (appealsBySet[setNum] ?? { p1: 2, p2: 2 })[challengingTeam]
          return (
            <div style={{ textAlign: 'center', paddingTop: 8 }}>
              <div style={{ fontSize: 52, marginBottom: 12, color: upheld ? '#4ade80' : '#f87171' }}>{upheld ? '✓' : '✗'}</div>
              <p style={{ fontSize: 20, fontWeight: 900, color: upheld ? '#4ade80' : '#f87171', marginBottom: 8 }}>
                {upheld ? 'CHẤP NHẬN' : 'BÁC BỎ'}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 28 }}>
                {upheld
                  ? 'Khiếu nại hợp lệ — giữ lại lần khiếu nại này'
                  : `${challengingDef?.player.name} còn ${remaining} lần khiếu nại (ván ${setNum})`}
              </p>
              <button onClick={() => { setStep('list'); setChallengingTeam(null); setResult(null) }}
                style={{ width: '100%', padding: 18, borderRadius: 14, background: 'var(--cyan)', color: '#000', fontWeight: 900, border: 'none', fontSize: 16, cursor: 'pointer' }}>
                VỀ LỊCH SỬ
              </button>
            </div>
          )
        })()}

      </div>
    </div>
  )
}

function RetiredModal({ player1, player2, onClose, onConfirm }) {
  const [retiredTeam, setRetiredTeam] = useState(null)
  const [confirmed,   setConfirmed]   = useState(false)

  const teamDefs = [
    { id: 'p1', player: player1, color: 'var(--cyan)' },
    { id: 'p2', player: player2, color: 'var(--amber)' },
  ]
  const retiredDef = teamDefs.find(t => t.id === retiredTeam)
  const winnerDef  = teamDefs.find(t => t.id !== retiredTeam)

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }
  const card    = { width: '90%', maxWidth: 340, background: '#111', borderRadius: 24, padding: 24, border: '1px solid rgba(255,255,255,0.08)' }

  if (confirmed) {
    return (
      <div style={overlay}>
        <div style={{ ...card, textAlign: 'center' }}>
          <UserX size={52} color="var(--amber)" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>XÁC NHẬN BỎ CUỘC</p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, marginBottom: 6 }}>
            <span style={{ color: retiredDef?.color, fontWeight: 700 }}>{retiredDef?.player.name}</span> rút lui khỏi trận đấu
          </p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, marginBottom: 28 }}>
            <span style={{ color: winnerDef?.color, fontWeight: 700 }}>{winnerDef?.player.name}</span> thắng W/O
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setConfirmed(false)}
              style={{ flex: 1, padding: 16, borderRadius: 14, background: 'rgba(255,255,255,0.06)', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer' }}>
              QUAY LẠI
            </button>
            <button onClick={onConfirm}
              style={{ flex: 1, padding: 16, borderRadius: 14, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer' }}>
              KẾT THÚC
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>TUYỂN THỦ BỎ CUỘC</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 20 }}>Đội nào rút lui?</p>
        {teamDefs.map(({ id, player, color }) => (
          <button key={id} onClick={() => setRetiredTeam(id)}
            style={{ width: '100%', marginBottom: 12, padding: '16px 20px', borderRadius: 14, background: retiredTeam === id ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${retiredTeam === id ? '#ef4444' : 'rgba(255,255,255,0.08)'}`, textAlign: 'left', cursor: 'pointer' }}>
            <span style={{ color, fontWeight: 700 }}>{player.name}</span>
          </button>
        ))}
        <button disabled={!retiredTeam} onClick={() => setConfirmed(true)}
          style={{ width: '100%', marginTop: 8, padding: 18, borderRadius: 14, background: retiredTeam ? '#ef4444' : 'rgba(255,255,255,0.05)', color: retiredTeam ? '#fff' : 'rgba(255,255,255,0.3)', border: 'none', fontWeight: 800, fontSize: 16, cursor: retiredTeam ? 'pointer' : 'default' }}>
          XÁC NHẬN
        </button>
      </div>
    </div>
  )
}

function PauseSheet({ onContinue }) {
  const [elapsed, setElapsed] = useState(0)
  const [paused,  setPaused]  = useState(false)

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [paused])

  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const secs = String(elapsed % 60).padStart(2, '0')

  return (
    <div className="modal-overlay modal-bottom">
      <div style={{ width: '100%', background: '#111', borderRadius: '28px 28px 0 0', padding: '24px 24px 50px' }}>
        <p style={{ fontSize: 24, fontWeight: 900, marginBottom: 4 }}>TẠM DỪNG</p>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 30, fontSize: 15, fontWeight: 700 }}>Trận đấu đang tạm dừng</p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ position: 'relative', width: 110, height: 110 }}>
            <svg width="110" height="110" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="55" cy="55" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
              <circle cx="55" cy="55" r="40" fill="none" stroke={paused ? 'var(--amber)' : 'var(--cyan)'} strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 40}`} strokeDashoffset="0" strokeLinecap="round"
                style={{ transition: 'stroke 0.3s' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, fontFamily: 'monospace' }}>
              {mins}:{secs}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <button onClick={() => setPaused(p => !p)}
            style={{ padding: '10px 28px', borderRadius: 30, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            {paused ? '▶  Tiếp tục đếm' : '⏸  Dừng đếm'}
          </button>
        </div>

        <button onClick={onContinue}
          style={{ width: '100%', padding: 20, borderRadius: 18, background: 'var(--cyan)', color: '#000', fontWeight: 900, fontSize: 20, border: 'none', cursor: 'pointer', boxShadow: '0 10px 30px rgba(34,211,238,0.3)' }}>
          Tiếp tục trận đấu
        </button>
      </div>
    </div>
  )
}

function ShuttleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v10M8 5l4 7 4-7M4 11l8 3 8-3M12 14v8M8 22h8" />
    </svg>
  )
}
function AppealIcon({ size = 22, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </svg>
  )
}
