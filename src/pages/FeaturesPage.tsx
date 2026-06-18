import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Trophy, Users, CalendarCheck, Shuffle, GitBranch, BarChart2,
  MonitorPlay, Bell, FileDown, Layers, UserCheck, Swords,
  Wifi, Star, CheckCircle2, Lock, Play, RotateCcw, AlertCircle, ArrowRight,
  Clock, Undo2, Redo2, Menu, Check, HelpCircle, ShieldAlert, Sparkles, QrCode
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useI18n } from '@/i18n'
import heroImg from '@/assets/hero.png'

// ─── Plan badge ────────────────────────────────────────────
const PLAN_STYLE = {
  free:  { label: 'Free',  cls: 'bg-gray-100 text-gray-600' },
  basic: { label: 'Basic', cls: 'bg-blue-100 text-blue-700' },
  pro:   { label: 'Pro',   cls: 'bg-purple-100 text-purple-700' },
}

function PlanBadge({ plan }) {
  const s = PLAN_STYLE[plan]
  return (
    <span className={cn('inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full', s.cls)}>
      {plan === 'pro' && <Star className="w-3 h-3 mr-1 fill-current" />}
      {s.label}
    </span>
  )
}

// ─── Simulators ────────────────────────────────────────────

// 1. Bracket Simulator (With Seed clash avoid configuration)
function BracketSimulator({ lang }) {
  const [step, setStep] = useState(0) // 0: init, 1: semis, 2: finals/winner
  const [animating, setAnimating] = useState(false)
  const [avoidSeedClash, setAvoidSeedClash] = useState(true)

  const handleSimulate = () => {
    if (animating) return
    setAnimating(true)
    setStep(0)
    setTimeout(() => {
      setStep(1)
      setTimeout(() => {
        setStep(2)
        setAnimating(false)
      }, 1500)
    }, 1200)
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-200 font-sans shadow-xl relative overflow-hidden h-[400px] flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-red-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {lang === 'en' ? 'Live Bracket Simulator' : 'Giả Lập Sơ Đồ Nhánh'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={avoidSeedClash}
              onChange={(e) => {
                setAvoidSeedClash(e.target.checked)
                setStep(0)
              }}
              className="rounded bg-slate-950 border-slate-800 text-red-600 focus:ring-0 w-3 h-3"
            />
            {lang === 'en' ? 'Avoid Seed Clash' : 'Chống đụng hạt giống'}
          </label>
          <button
            onClick={handleSimulate}
            disabled={animating}
            className="flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-800 text-white disabled:text-slate-500 font-bold text-xs rounded-md shadow-sm transition-colors cursor-pointer"
          >
            {animating ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {lang === 'en' ? 'Simulating...' : 'Đang đấu...'}
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                {step === 2
                  ? (lang === 'en' ? 'Re-simulate' : 'Đấu Lại')
                  : (lang === 'en' ? 'Simulate Matches' : 'Bắt Đầu Đấu')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Bracket Canvas */}
      <div className="flex-1 flex items-center justify-between relative mt-4">
        {/* SVG connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M 115 54 L 140 54 L 140 92 L 165 92"
            fill="none"
            stroke={step >= 1 ? '#ef4444' : '#334155'}
            strokeWidth="2"
            className="transition-colors duration-500"
          />
          <path
            d="M 115 186 L 140 186 L 140 148 L 165 148"
            fill="none"
            stroke={step >= 1 ? '#ef4444' : '#334155'}
            strokeWidth="2"
            className="transition-colors duration-500"
          />
          <path
            d="M 260 120 L 295 120"
            fill="none"
            stroke={step >= 2 ? '#eab308' : '#334155'}
            strokeWidth="2"
            className="transition-colors duration-500"
          />
        </svg>

        {/* Semifinals */}
        <div className="flex flex-col justify-around h-full z-10 w-[115px]">
          {/* Semifinal Match 1 */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-2 flex flex-col gap-1 shadow-sm">
            <div className={`flex items-center justify-between text-xs px-1 rounded transition-colors ${step >= 1 ? 'bg-red-950/40 text-red-400 font-semibold' : 'text-slate-300'}`}>
              <span className="truncate max-w-[65px]">Văn A (S1)</span>
              <span>{step >= 1 ? '21' : '0'}</span>
            </div>
            <div className={`flex items-center justify-between text-xs px-1 rounded transition-colors ${step >= 1 ? 'opacity-40 text-slate-500' : 'text-slate-300'}`}>
              <span className="truncate max-w-[65px]">{avoidSeedClash ? 'Lê Văn B' : 'Văn D (S2)'}</span>
              <span>{step >= 1 ? '15' : '0'}</span>
            </div>
          </div>

          {/* Semifinal Match 2 */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-2 flex flex-col gap-1 shadow-sm">
            <div className={`flex items-center justify-between text-xs px-1 rounded transition-colors ${step >= 1 ? 'opacity-40 text-slate-500' : 'text-slate-300'}`}>
              <span className="truncate max-w-[65px]">{avoidSeedClash ? 'Trần C' : 'Lê Văn B'}</span>
              <span>{step >= 1 ? '18' : '0'}</span>
            </div>
            <div className={`flex items-center justify-between text-xs px-1 rounded transition-colors ${step >= 1 ? 'bg-red-950/40 text-red-400 font-semibold' : 'text-slate-300'}`}>
              <span className="truncate max-w-[65px]">{avoidSeedClash ? 'Văn D (S2)' : 'Trần C'}</span>
              <span>{step >= 1 ? '21' : '0'}</span>
            </div>
          </div>
        </div>

        {/* Finals */}
        <div className="flex flex-col justify-center h-full z-10 w-[95px]">
          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-2 flex flex-col gap-1 shadow-md">
            <div className={`flex items-center justify-between text-xs px-1 rounded transition-all ${
              step === 0 ? 'opacity-30 text-slate-600' :
              step >= 2 ? 'bg-red-950/40 text-red-400 font-bold scale-105' : 'text-slate-300'
            }`}>
              <span className="truncate max-w-[55px]">{step >= 1 ? 'Văn A' : 'Chờ...'}</span>
              <span>{step >= 2 ? '21' : '0'}</span>
            </div>
            <div className={`flex items-center justify-between text-xs px-1 rounded transition-all ${
              step === 0 ? 'opacity-30 text-slate-600' :
              step >= 2 ? 'opacity-40 text-slate-500' : 'text-slate-300'
            }`}>
              <span className="truncate max-w-[55px]">{step >= 1 ? (avoidSeedClash ? 'Văn D' : 'Văn D') : 'Chờ...'}</span>
              <span>{step >= 2 ? '19' : '0'}</span>
            </div>
          </div>
        </div>

        {/* Champion Spot */}
        <div className="flex flex-col justify-center h-full z-10 w-[80px] items-center text-center">
          <div className={`transition-all duration-700 transform flex flex-col items-center ${
            step === 2 ? 'scale-100 opacity-100 translate-y-0' : 'scale-75 opacity-0 -translate-y-4'
          }`}>
            <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/20 mb-1 border border-amber-300 animate-bounce">
              <Trophy className="w-5 h-5 text-slate-950 fill-current" />
            </div>
            <span className="text-[8px] uppercase font-bold text-amber-500 tracking-wider">
              {lang === 'en' ? 'Champion' : 'Vô Địch'}
            </span>
            <span className="text-xs font-extrabold text-white whitespace-nowrap drop-shadow-md">Văn A</span>
          </div>
          {step < 2 && (
            <div className="text-slate-600 text-[10px] border border-dashed border-slate-800 p-2 rounded-lg bg-slate-950/30">
              {lang === 'en' ? 'Waiting' : 'Chờ đấu'}
            </div>
          )}
        </div>
      </div>

      <div className="text-[10px] text-slate-500 text-left border-t border-slate-850 pt-2 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span>
          {avoidSeedClash
            ? (lang === 'en' ? 'Seed 1 & 2 are separated. Club-mates do not meet early.' : 'Hạt giống số 1 và số 2 tự động được đẩy ra 2 nhánh đấu riêng biệt.')
            : (lang === 'en' ? 'Seeds could meet early if clash avoid is disabled.' : 'VĐV có thể đụng độ sớm nếu không bật tính năng chống trùng nhánh.')}
        </span>
      </div>
    </div>
  )
}

// 2. High-fidelity Umpire Scoring Screen Simulator (matches ScoringScreen.tsx and UmpireScoring.scss)
function UmpireSimulator({ lang }) {
  const [p1Score, setP1Score] = useState(19)
  const [p2Score, setP2Score] = useState(18)
  const [p1Sets, setP1Sets] = useState(1)
  const [p2Sets, setP2Sets] = useState(0)
  const [serverId, setServerId] = useState('p1') // 'p1' or 'p2'
  const [timer, setTimer] = useState(863) // 14m23s
  const [isSyncing, setIsSyncing] = useState(false)
  const [flash, setFlash] = useState(null) // 'p1' or 'p2'

  // Timer tick
  useEffect(() => {
    const t = setInterval(() => {
      setTimer(prev => prev + 1)
    }, 1000)
    return () => clearInterval(t)
  }, [])

  const formatTimer = (totalSecs) => {
    const m = Math.floor(totalSecs / 60)
    const s = totalSecs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const handlePoint = (team) => {
    setIsSyncing(true)
    setFlash(team)

    if (team === 'p1') {
      setP1Score(prev => {
        const next = prev + 1
        // BWF Rules check
        if (next >= 21 && next - p2Score >= 2) {
          setTimeout(() => {
            setP1Sets(s => s + 1)
            setP1Score(0)
            setP2Score(0)
          }, 800)
        }
        return next
      })
      setServerId('p1')
    } else {
      setP2Score(prev => {
        const next = prev + 1
        if (next >= 21 && next - p1Score >= 2) {
          setTimeout(() => {
            setP2Sets(s => s + 1)
            setP1Score(0)
            setP2Score(0)
          }, 800)
        }
        return next
      })
      setServerId('p2')
    }

    setTimeout(() => {
      setIsSyncing(false)
      setFlash(null)
    }, 400)
  }

  const handleUndo = () => {
    if (p1Score > 0 || p2Score > 0) {
      if (serverId === 'p1' && p1Score > 0) setP1Score(s => s - 1)
      else if (serverId === 'p2' && p2Score > 0) setP2Score(s => s - 1)
    }
  }

  // Calculate coordinates of players in single matches based on serving rules (even = right, odd = left)
  const p1EvenServer = p1Score % 2 === 0
  const p2EvenServer = p2Score % 2 === 0

  return (
    <div className="flex flex-col gap-4">
      {/* Tablet Wrapper Frame */}
      <div className="relative border-4 border-slate-700 bg-[#434b58] rounded-3xl p-3 shadow-2xl flex flex-col h-[350px] overflow-hidden select-none select-none">
        
        {/* Bezel Camera and Speaker Notch */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-20 h-2 bg-slate-800 rounded-full z-30 flex items-center justify-center gap-1">
          <span className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
          <span className="w-6 h-0.5 bg-slate-900 rounded-full" />
        </div>

        {/* ─── Header Replica (UmpireScoring.scss style) ─── */}
        <div className="relative flex items-end justify-between px-2 pb-2 pt-1 gap-2 z-10">
          
          {/* Timer Badge */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
            <div className="bg-white/10 border border-white/10 rounded px-2 py-0.5 flex items-center gap-1 backdrop-blur-sm">
              <Clock className="w-3 h-3 text-white/50" />
              <span className="text-[10px] font-bold text-white/70 font-mono">{formatTimer(timer)}</span>
            </div>
          </div>

          {/* Left Actions */}
          <div className="flex gap-1.5">
            <button onClick={handleUndo} className="w-8 h-8 rounded-lg bg-[#252527] border-0 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer">
              <Undo2 className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 rounded-lg bg-[#252527] border-0 flex items-center justify-center text-white/60 cursor-not-allowed">
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Scoreboard Card (Middle) */}
          <div className="flex-1 max-w-[220px]">
            <div className="h-14 bg-[#1c1c1e] border border-white/5 rounded-xl shadow-lg flex overflow-hidden">
              <div className="w-1 bg-gradient-to-b from-[#6b46c1] to-[#3182ce]" />
              <div className="flex-1 flex flex-col justify-center px-2 py-1 leading-tight text-left">
                {/* Row P1 */}
                <div className="flex items-center justify-between border-b border-white/5 pb-0.5">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[8px] text-white/20">-</span>
                    <span className="text-[10px] font-bold text-slate-200 truncate max-w-[80px]">H. Đức</span>
                    {serverId === 'p1' && <span className="w-1.5 h-1.5 bg-[#22d3ee] rounded-full animate-pulse shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2">
                    {p1Sets > 0 && <span className="text-[10px] text-slate-500 font-mono">{p1Sets}</span>}
                    <span className={cn('text-[13px] font-black font-mono', serverId === 'p1' ? 'text-[#22d3ee]' : 'text-white')}>{p1Score}</span>
                  </div>
                </div>
                {/* Row P2 */}
                <div className="flex items-center justify-between pt-0.5">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[8px] text-white/20">-</span>
                    <span className="text-[10px] font-bold text-slate-200 truncate max-w-[80px]">M. Hải</span>
                    {serverId === 'p2' && <span className="w-1.5 h-1.5 bg-[#22d3ee] rounded-full animate-pulse shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2">
                    {p2Sets > 0 && <span className="text-[10px] text-slate-500 font-mono">{p2Sets}</span>}
                    <span className={cn('text-[13px] font-black font-mono', serverId === 'p2' ? 'text-[#22d3ee]' : 'text-white')}>{p2Score}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex gap-1.5">
            <button className="w-8 h-8 rounded-lg bg-[#252527] border-0 flex items-center justify-center text-[#22d3ee] font-bold text-[9px] cursor-pointer">
              SHTL
            </button>
            <button className="w-8 h-8 rounded-lg bg-[#252527] border-0 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer">
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── Umpire Tablet Body Layout ─── */}
        <div className="flex-1 flex flex-col mt-1 relative z-10 gap-2">
          
          {/* Top Tap Scoring Box for P2 */}
          <button
            onClick={() => handlePoint('p2')}
            className={cn(
              'h-10 bg-[#252527] hover:bg-[#2e2e30] border border-white/5 rounded-xl flex items-center justify-center font-black text-xs text-white/50 hover:text-white transition-colors cursor-pointer select-none active:scale-95 duration-75',
              flash === 'p2' && 'bg-red-600 border-red-500 text-white font-black scale-95 shadow-lg shadow-red-500/20'
            )}
          >
            {lang === 'en' ? 'P2 SCORE (+1)' : 'GHI ĐIỂM P2 (+1)'}
          </button>

          {/* Real Green Court Area (Re-designed replica) */}
          <div className="flex-1 bg-[#218d59] border border-white/40 rounded-xl relative p-1 overflow-hidden shadow-inner flex items-center justify-center">
            
            {/* Court boundary lines */}
            <div className="absolute inset-2 border border-white/70" />
            <div className="absolute inset-y-2 left-1/2 -translate-x-1/2 border-l border-white/50" /> {/* Center line */}
            <div className="absolute inset-x-2 top-1/4 border-b border-white/30" /> {/* Short service lines */}
            <div className="absolute inset-x-2 bottom-1/4 border-b border-white/30" />

            {/* Net line in the middle */}
            <div className="absolute inset-x-1.5 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-white/80" />

            {/* Net controls in the center */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex gap-2">
              <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700 p-0.5 rounded flex items-center gap-1 text-[8px] font-bold text-white/80">
                <span>NET</span>
              </div>
            </div>

            {/* Player 1 positioned dynamically in the bottom court boxes */}
            <div className={cn(
              'absolute text-[9px] font-black text-slate-950 px-2 py-0.5 bg-white/95 rounded shadow-md border-b-2 transition-all duration-300',
              serverId === 'p1' ? 'border-[#22d3ee] scale-105' : 'border-transparent opacity-90',
              p1EvenServer ? 'bottom-3 right-5' : 'bottom-3 left-5'
            )}>
              <span>H. Đức</span>
              {serverId === 'p1' && <span className="inline-block w-1.5 h-1.5 bg-red-600 rounded-full ml-1" />}
            </div>

            {/* Player 2 positioned dynamically in the top court boxes */}
            <div className={cn(
              'absolute text-[9px] font-black text-slate-950 px-2 py-0.5 bg-white/95 rounded shadow-md border-b-2 transition-all duration-300',
              serverId === 'p2' ? 'border-[#22d3ee] scale-105' : 'border-transparent opacity-90',
              p2EvenServer ? 'top-3 left-5' : 'top-3 right-5'
            )}>
              <span>M. Hải</span>
              {serverId === 'p2' && <span className="inline-block w-1.5 h-1.5 bg-red-600 rounded-full ml-1" />}
            </div>
          </div>

          {/* Bottom Tap Scoring Box for P1 */}
          <button
            onClick={() => handlePoint('p1')}
            className={cn(
              'h-10 bg-[#252527] hover:bg-[#2e2e30] border border-white/5 rounded-xl flex items-center justify-center font-black text-xs text-white/50 hover:text-white transition-colors cursor-pointer select-none active:scale-95 duration-75',
              flash === 'p1' && 'bg-red-600 border-red-500 text-white font-black scale-95 shadow-lg shadow-red-500/20'
            )}
          >
            {lang === 'en' ? 'P1 SCORE (+1)' : 'GHI ĐIỂM P1 (+1)'}
          </button>
        </div>
      </div>

      {/* Sync indicator of spectator live TV */}
      <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5 flex items-center justify-between text-slate-300">
        <div className="text-left">
          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block">Live Public TV Scoreboard</span>
          <div className="text-xs font-extrabold text-white mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 bg-red-600 rounded-full animate-ping shrink-0" />
            <span>Đức vs Hải: {p1Score} - {p2Score}</span>
            <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">Set {p1Sets + p2Sets + 1}</span>
          </div>
        </div>

        <div className={cn(
          'flex items-center gap-1 px-2 py-1 bg-emerald-950 border border-emerald-900 rounded-lg text-[10px] font-bold text-emerald-400 transition-opacity',
          isSyncing ? 'opacity-100 animate-pulse' : 'opacity-80'
        )}>
          <Wifi className="w-3.5 h-3.5 shrink-0" />
          <span>{lang === 'en' ? 'Synced < 10ms' : 'Đồng bộ < 10ms'}</span>
        </div>
      </div>
    </div>
  )
}

// 3. Court Management Simulator (Assign match, calling umpire alert, warm-up countdown)
function CourtSimulator({ lang }) {
  const [court4Active, setCourt4Active] = useState(false)
  const [waitingList, setWaitingList] = useState([
    { id: 1, name: 'Nguyễn Văn E vs Lê Văn F' }
  ])
  const [c1Timer, setC1Timer] = useState(2450)
  const [c2Timer, setC2Timer] = useState(5680) // Played 94:40
  const [c3Warmup, setC3Warmup] = useState(179) // Warm-up 2m59s
  const [umpireCallActive, setUmpireCallActive] = useState(true)
  const [alertAck, setAlertAck] = useState(false)
  const [logMsg, setLogMsg] = useState('')

  useEffect(() => {
    const i = setInterval(() => {
      setC1Timer(t => t + 1)
      setC2Timer(t => t + 1)
      if (c3Warmup > 0) setC3Warmup(t => t - 1)
    }, 1000)
    return () => clearInterval(i)
  }, [c3Warmup])

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const handleAssign = () => {
    if (waitingList.length === 0) return
    setCourt4Active(true)
    setWaitingList([])
    setLogMsg(lang === 'en' ? 'Assigned Match E vs F to Court 4' : 'Đã điều phối trận E vs F vào Sân 4')
  }

  const handleUmpireCall = () => {
    setUmpireCallActive(false)
    setLogMsg(lang === 'en' ? 'BTC dispatched new shuttles to Court 1.' : 'BTC đã duyệt giao 6 quả cầu mới cho Sân 1.')
  }

  const handleReset = () => {
    setCourt4Active(false)
    setWaitingList([{ id: 1, name: 'Nguyễn Văn E vs Lê Văn F' }])
    setC1Timer(2450)
    setC2Timer(5680)
    setC3Warmup(179)
    setUmpireCallActive(true)
    setAlertAck(false)
    setLogMsg('')
  }

  const showSafetyWarning = c2Timer >= 5700 && !alertAck // Played > 95 minutes!

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-200 font-sans shadow-xl relative overflow-hidden h-[400px] flex flex-col justify-between">
      
      {/* Smart Safety Alert */}
      {showSafetyWarning && (
        <div className="absolute top-16 inset-x-4 z-20 bg-amber-950/95 border border-amber-500 rounded-xl p-3 text-amber-200 shadow-2xl flex gap-2.5 items-start">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-bold text-amber-300">
              {lang === 'en' ? 'Smart Safety Alert' : 'Cảnh Báo Quá Tải VĐV'}
            </p>
            <p className="text-[10px] text-amber-200/80 leading-relaxed mt-0.5">
              {lang === 'en'
                ? 'Court 2 players have exceeded 95 mins of continuous play. Suggest rest interval.'
                : 'VĐV tại Sân 2 đã thi đấu liên tục quá 95 phút. Cần sắp xếp thời gian nghỉ.'}
            </p>
            <div className="flex justify-end mt-2">
              <button
                onClick={() => setAlertAck(true)}
                className="px-2.5 py-0.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[9px] rounded-md transition-colors cursor-pointer"
              >
                {lang === 'en' ? 'Acknowledge' : 'Đã Xác Nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <MonitorPlay className="w-4 h-4 text-red-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {lang === 'en' ? 'Smart Court Coordinator Board' : 'Điều Phối Sân Thi Đấu'}
          </span>
        </div>
        <button onClick={handleReset} className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Grid of 4 Courts */}
      <div className="grid grid-cols-2 gap-3 my-2 flex-1 items-stretch">
        
        {/* Court 1 - In progress & Calling BTC */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between relative">
          <div className="flex justify-between items-center text-[9px] font-bold text-slate-500">
            <span>SÂN 1</span>
            {umpireCallActive ? (
              <button
                onClick={handleUmpireCall}
                className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 px-1.5 py-0.5 rounded text-[8px] font-extrabold animate-pulse cursor-pointer whitespace-nowrap"
              >
                CẦN CẦU LÔNG ⚠️
              </button>
            ) : (
              <span className="text-emerald-400 text-[8px] font-bold">ĐÃ HỖ TRỢ ✓</span>
            )}
          </div>
          <div className="my-1 text-center">
            <div className="text-[10px] font-bold text-white truncate">Minh X vs Hải Y</div>
            <span className="text-xs font-extrabold text-red-500 mt-0.5">18 - 14</span>
          </div>
          <span className="text-[9px] bg-slate-900 text-slate-400 py-0.5 rounded font-mono text-center">
            {formatTimer(c1Timer)}
          </span>
        </div>

        {/* Court 2 - Alert Warn */}
        <div className={cn(
          'border rounded-xl p-2.5 flex flex-col justify-between relative transition-all',
          showSafetyWarning ? 'bg-amber-950/20 border-amber-500/50 shadow-md shadow-amber-500/5' : 'bg-slate-950/80 border-slate-800'
        )}>
          <div className="flex justify-between items-center text-[9px] font-bold text-slate-500">
            <span>SÂN 2</span>
            {showSafetyWarning && <span className="bg-amber-500 text-slate-950 font-bold px-1 rounded text-[7px] animate-pulse">OVERHEAT</span>}
          </div>
          <div className="my-1 text-center">
            <div className="text-[10px] font-bold text-white truncate">Đức P vs Hải Q</div>
            <span className="text-xs font-extrabold text-red-500 mt-0.5">20 - 21</span>
          </div>
          <span className={cn(
            'text-[9px] py-0.5 rounded font-mono font-bold text-center',
            showSafetyWarning ? 'bg-amber-500 text-slate-950 animate-pulse' : 'bg-slate-900 text-slate-400'
          )}>
            {formatTimer(c2Timer)}
          </span>
        </div>

        {/* Court 3 - Warm-up countdown */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex justify-between items-center text-[9px] font-bold text-slate-500">
            <span>SÂN 3</span>
            <span className="text-blue-400 font-bold text-[8px] uppercase tracking-wider">{lang === 'en' ? 'WARM-UP' : 'KHỞI ĐỘNG'}</span>
          </div>
          <div className="my-1 text-center">
            <div className="text-[10px] font-bold text-white truncate">An T vs Bình U</div>
            <span className="text-[9px] text-slate-500 block">{lang === 'en' ? 'Matches starting soon' : 'Sắp diễn ra'}</span>
          </div>
          <span className="text-[9px] bg-slate-900 text-blue-400 py-0.5 rounded font-mono text-center font-bold">
            {c3Warmup > 0 ? formatTimer(c3Warmup) : 'PLAYING'}
          </span>
        </div>

        {/* Court 4 - Empty / Assigned */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between text-center">
          <div className="text-[9px] font-bold text-slate-500 text-left">SÂN 4</div>
          {court4Active ? (
            <div className="my-1 animate-fade-in">
              <div className="text-[10px] font-bold text-white truncate">Văn E vs Văn F</div>
              <span className="text-[9px] text-emerald-400 font-bold block">{lang === 'en' ? 'In progress' : 'Vừa vào sân'}</span>
            </div>
          ) : (
            <div className="text-[10px] text-slate-600 italic my-auto">
              {lang === 'en' ? 'Empty' : 'Sân Trống'}
            </div>
          )}
          <span className="text-[9px] bg-slate-900 text-slate-400 py-0.5 rounded font-mono">
            {court4Active ? '00:02' : '00:00'}
          </span>
        </div>
      </div>

      {/* Log Console Banner */}
      {logMsg && (
        <div className="bg-blue-950/40 border border-blue-900/50 rounded-lg py-1 px-3 mb-1 text-[10px] text-blue-400 text-left font-mono">
          &gt; {logMsg}
        </div>
      )}

      {/* Queue control bar */}
      <div className="bg-slate-950 border border-slate-850 rounded-xl p-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0 text-left">
          <span className="text-[8px] font-bold text-slate-500 uppercase block tracking-wider">
            {lang === 'en' ? 'Next in Queue' : 'Trận Tiếp Theo Trong Hàng Đợi'}
          </span>
          <span className="text-xs font-bold text-white truncate block mt-0.5">
            {waitingList.length > 0 ? waitingList[0].name : (lang === 'en' ? 'Queue empty' : 'Hàng đợi trống')}
          </span>
        </div>

        {waitingList.length > 0 ? (
          <button
            onClick={handleAssign}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
          >
            {lang === 'en' ? 'Assign Court 4' : 'Xếp Sân 4'}
          </button>
        ) : (
          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-emerald-950/50">
            {lang === 'en' ? 'All Scheduled' : 'Đã Xếp Hết Sân'}
          </span>
        )}
      </div>
    </div>
  )
}

// 4. Interactive Group Standings Table Calculator
function GroupStandingsSimulator({ lang }) {
  const [standings, setStandings] = useState([
    { rank: 1, name: 'Nguyễn H. Đức', club: 'Hà Nội', played: 1, won: 1, lost: 0, setDiff: 2, pointDiff: 8, points: 2 },
    { rank: 2, name: 'Lê Văn Bình', club: 'Đà Nẵng', played: 1, won: 1, lost: 0, setDiff: 2, pointDiff: 5, points: 2 },
    { rank: 3, name: 'Phạm M. Hải', club: 'TP.HCM', played: 1, won: 0, lost: 1, setDiff: -2, pointDiff: -8, points: 0 },
    { rank: 4, name: 'Trần Văn An', club: 'Cần Thơ', played: 1, won: 0, lost: 1, setDiff: -2, pointDiff: -5, points: 0 },
  ])
  const [activeScore, setActiveScore] = useState('none') // 'none' | 'duc-wins-2-0' | 'hai-wins-2-1' | 'binh-wins-2-0'

  const handleApplyScore = (scoreOption) => {
    setActiveScore(scoreOption)
    
    // Copy default base stats
    let defaultStandings = [
      { rank: 1, name: 'Nguyễn H. Đức', club: 'Hà Nội', played: 1, won: 1, lost: 0, setDiff: 2, pointDiff: 8, points: 2 },
      { rank: 2, name: 'Lê Văn Bình', club: 'Đà Nẵng', played: 1, won: 1, lost: 0, setDiff: 2, pointDiff: 5, points: 2 },
      { rank: 3, name: 'Phạm M. Hải', club: 'TP.HCM', played: 1, won: 0, lost: 1, setDiff: -2, pointDiff: -8, points: 0 },
      { rank: 4, name: 'Trần Văn An', club: 'Cần Thơ', played: 1, won: 0, lost: 1, setDiff: -2, pointDiff: -5, points: 0 },
    ]

    if (scoreOption === 'duc-wins-2-0') {
      // Đức wins vs Hải 2-0 (21-15, 21-14)
      // Đức total sets: +4, total points: +22. Hải total sets: -4, total points: -22
      defaultStandings[0].played = 2; defaultStandings[0].won = 2; defaultStandings[0].setDiff = 4; defaultStandings[0].pointDiff = 21; defaultStandings[0].points = 4;
      defaultStandings[2].played = 2; defaultStandings[2].won = 0; defaultStandings[2].lost = 2; defaultStandings[2].setDiff = -4; defaultStandings[2].pointDiff = -21; defaultStandings[2].points = 0;
    } else if (scoreOption === 'hai-wins-2-1') {
      // Hải wins vs Đức 2-1 (21-19, 18-21, 21-17)
      // Đức gets +1 loss. points=2. sets: +1. points: 8 + (19+21+17 - 21-18-21) = 8 + (57 - 60) = +5
      // Hải gets +1 win. points=2. sets: -1. points: -8 + (-3) = -11
      defaultStandings[0].played = 2; defaultStandings[0].won = 1; defaultStandings[0].lost = 1; defaultStandings[0].setDiff = 1; defaultStandings[0].pointDiff = 5; defaultStandings[0].points = 2;
      defaultStandings[2].played = 2; defaultStandings[2].won = 1; defaultStandings[2].lost = 1; defaultStandings[2].setDiff = -1; defaultStandings[2].pointDiff = -5; defaultStandings[2].points = 2;
    } else if (scoreOption === 'binh-wins-2-0') {
      // Bình wins vs An 2-0 (21-12, 21-10). Total sets +4, total points +24
      defaultStandings[1].played = 2; defaultStandings[1].won = 2; defaultStandings[1].lost = 0; defaultStandings[1].setDiff = 4; defaultStandings[1].pointDiff = 24; defaultStandings[1].points = 4;
      defaultStandings[3].played = 2; defaultStandings[3].won = 0; defaultStandings[3].lost = 2; defaultStandings[3].setDiff = -4; defaultStandings[3].pointDiff = -24; defaultStandings[3].points = 0;
    }

    // Sort according to: Points -> SetDiff -> PointDiff
    defaultStandings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff
      return b.pointDiff - a.pointDiff
    })

    // Assign rank
    defaultStandings.forEach((item, index) => {
      item.rank = index + 1
    })

    setStandings(defaultStandings)
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-200 font-sans shadow-xl relative overflow-hidden h-[400px] flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-red-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {lang === 'en' ? 'Interactive Group Standings' : 'BXH Vòng Bảng Tự Động'}
          </span>
        </div>
        <button onClick={() => handleApplyScore('none')} className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Standings Table Grid */}
      <div className="bg-slate-950 border border-slate-850 rounded-xl overflow-hidden shadow-inner my-1.5 flex-1">
        <table className="w-full text-[10px] text-slate-300">
          <thead className="bg-slate-900/50 border-b border-slate-800 text-[8px] font-bold text-slate-500 uppercase">
            <tr>
              <th className="px-2.5 py-2 text-center w-8">Hạng</th>
              <th className="px-2.5 py-2 text-left">VĐV</th>
              <th className="px-2.5 py-2 text-center w-8">Trận</th>
              <th className="px-2.5 py-2 text-center w-12">Set +/-</th>
              <th className="px-2.5 py-2 text-center w-12">Điểm +/-</th>
              <th className="px-2.5 py-2 text-center w-10 text-red-400 font-bold">Điểm</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900">
            {standings.map((row) => (
              <tr key={row.name} className="hover:bg-slate-900/40 transition-colors h-7">
                <td className="text-center font-bold">
                  <span className={cn(
                    'w-4 h-4 rounded-full inline-flex items-center justify-center text-[9px] font-black',
                    row.rank === 1 ? 'bg-amber-500 text-slate-950 shadow shadow-amber-500/20' :
                    row.rank === 2 ? 'bg-slate-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                  )}>
                    {row.rank}
                  </span>
                </td>
                <td className="px-2.5 py-1 text-left font-bold text-white">
                  <div>{row.name}</div>
                  <span className="text-[8px] text-slate-500 font-medium">{row.club}</span>
                </td>
                <td className="text-center font-semibold text-slate-400">{row.played}</td>
                <td className="text-center font-mono font-bold text-slate-300">
                  {row.setDiff > 0 ? `+${row.setDiff}` : row.setDiff}
                </td>
                <td className="text-center font-mono font-bold text-slate-300">
                  {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                </td>
                <td className="text-center font-black font-mono text-red-400 text-xs">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Simulator Control Panel */}
      <div className="bg-slate-950 border border-slate-850 p-2.5 rounded-xl mt-1 space-y-2 text-left">
        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">
          {lang === 'en' ? 'Match Results Simulator' : 'Nhập Kết Quả Đối Đầu'}
        </span>
        
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => handleApplyScore('duc-wins-2-0')}
            className={cn(
              'px-2.5 py-1.5 rounded-lg border text-[9px] font-bold transition-all cursor-pointer',
              activeScore === 'duc-wins-2-0'
                ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-500/10'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
            )}
          >
            Đức 2 - 0 Hải (21-15, 21-14)
          </button>
          
          <button
            onClick={() => handleApplyScore('hai-wins-2-1')}
            className={cn(
              'px-2.5 py-1.5 rounded-lg border text-[9px] font-bold transition-all cursor-pointer',
              activeScore === 'hai-wins-2-1'
                ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-500/10'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
            )}
          >
            Đức 1 - 2 Hải (19-21, 21-18, 17-21)
          </button>

          <button
            onClick={() => handleApplyScore('binh-wins-2-0')}
            className={cn(
              'px-2.5 py-1.5 rounded-lg border text-[9px] font-bold transition-all cursor-pointer',
              activeScore === 'binh-wins-2-0'
                ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-500/10'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
            )}
          >
            Bình 2 - 0 An (21-12, 21-10)
          </button>
        </div>
      </div>
    </div>
  )
}

// 5. Interactive Smart Check-in & Walkover Simulator
function AttendanceSimulator({ lang }) {
  const [eCheckIn, setECheckIn] = useState('pending') // 'pending' | 'checked-in' | 'absent'
  const [qrScanning, setQrScanning] = useState(false)
  const [log, setLog] = useState('')

  const handleCheckIn = () => {
    setECheckIn('checked-in')
    setLog(lang === 'en' ? 'Checked in Nguyễn Văn E. Ready for scheduled matches.' : 'Đã điểm danh Nguyễn Văn E. Đủ điều kiện ra sân.')
  }

  const handleAbsent = () => {
    setECheckIn('absent')
    setLog(lang === 'en' ? 'Absent. Walkover triggered: resolve all matches as 0-2 losses.' : 'Vắng mặt. Kích hoạt Walkover: Xử thua 0-2 toàn bộ trận liên quan.')
  }

  const handleQRScan = () => {
    setQrScanning(true)
    setTimeout(() => {
      setQrScanning(false)
      setECheckIn('checked-in')
      setLog(lang === 'en' ? 'QR Code Scanned successfully: checked in Nguyễn Văn E.' : 'Quét mã QR thành công: Đã điểm danh Nguyễn Văn E.')
    }, 1200)
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-200 font-sans shadow-xl relative overflow-hidden h-[400px] flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-red-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {lang === 'en' ? 'Smart Attendance & Walkover' : 'Điểm Danh & Tự Động Walkover'}
          </span>
        </div>
        <button
          onClick={() => {
            setECheckIn('pending')
            setLog('')
          }}
          className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Simulator Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 items-stretch my-2">
        
        {/* Left Side: VĐV Checklist */}
        <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex flex-col justify-between text-left">
          <div>
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
              {lang === 'en' ? 'Athlete Checklist' : 'Danh Sách Điểm Danh'}
            </span>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-slate-900/60 p-2 rounded border border-slate-800">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-white">Nguyễn Văn E</div>
                  <span className="text-[8px] text-slate-500">CLB Hải Phòng</span>
                </div>
                <div>
                  {eCheckIn === 'pending' && <span className="bg-yellow-500/15 text-yellow-500 text-[8px] font-bold px-1.5 py-0.5 rounded border border-yellow-500/20">Chờ</span>}
                  {eCheckIn === 'checked-in' && <span className="bg-emerald-500/15 text-emerald-400 text-[8px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/20">Có mặt</span>}
                  {eCheckIn === 'absent' && <span className="bg-red-500/15 text-red-400 text-[8px] font-bold px-1.5 py-0.5 rounded border border-red-500/20">Vắng</span>}
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-900/30 p-2 rounded border border-slate-850/50 opacity-60">
                <div>
                  <div className="text-[10px] font-bold text-slate-400">Lê Văn F</div>
                  <span className="text-[8px] text-slate-600">CLB Bình Dương</span>
                </div>
                <span className="bg-emerald-500/15 text-emerald-400 text-[8px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/20">Có mặt</span>
              </div>
            </div>
          </div>

          <div className="flex gap-1.5 mt-4">
            <button
              onClick={handleCheckIn}
              className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] rounded transition-colors cursor-pointer"
            >
              Check-In
            </button>
            <button
              onClick={handleAbsent}
              className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-[9px] rounded transition-colors cursor-pointer"
            >
              Walkover
            </button>
          </div>
        </div>

        {/* Right Side: QR Scanner Simulator or Walkover Result View */}
        <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex flex-col justify-between">
          {eCheckIn === 'absent' ? (
            /* Absent - Walkover Result display */
            <div className="flex-1 flex flex-col justify-between text-left animate-fade-in text-red-400">
              <div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-red-500 uppercase mb-2">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>Xử Phạt Walkover</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal mb-2">
                  {lang === 'en' 
                    ? 'Nguyễn Văn E was absent. All scheduled matches resolved automatically:'
                    : 'Do VĐV Nguyễn Văn E vắng mặt, hệ thống tự động xử lý kết quả các trận liên quan:'}
                </p>
                
                <div className="bg-slate-900 p-2 rounded border border-red-950/30 font-mono text-[9px] text-slate-300 space-y-1">
                  <div className="flex justify-between">
                    <span className="line-through text-slate-500">N. Văn E</span>
                    <span className="text-red-500 font-bold">0 - 2 (L)</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800/40 pt-1">
                    <span className="font-bold text-emerald-400">Cao Hùng (W)</span>
                    <span className="text-emerald-400 font-bold">2 - 0 (W)</span>
                  </div>
                </div>
              </div>
              <span className="text-[8px] text-slate-500 mt-2 block">
                {lang === 'en' ? '*No score entry required. Court cleared.' : '*Giải phóng sân đấu ngay lập tức, không cần trọng tài nhập điểm.'}
              </span>
            </div>
          ) : (
            /* QR Scanning view */
            <div className="flex-1 flex flex-col justify-center items-center text-center relative">
              {qrScanning ? (
                <div className="flex flex-col items-center gap-2 animate-pulse">
                  <div className="w-16 h-16 border-2 border-red-500 rounded-lg flex items-center justify-center relative overflow-hidden bg-slate-900/50">
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-red-500 animate-bounce" />
                    <QrCode className="w-10 h-10 text-red-500" />
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{lang === 'en' ? 'Scanning QR...' : 'Đang quét QR...'}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <QrCode className="w-12 h-12 text-slate-600" />
                  <div className="text-[10px] text-slate-400 leading-normal max-w-[130px]">
                    {lang === 'en' 
                      ? 'Simulate check-in via athlete\'s personal QR Code' 
                      : 'Quét mã QR cá nhân của VĐV để điểm danh nhanh'}
                  </div>
                  <button
                    onClick={handleQRScan}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white font-bold text-[9px] rounded-lg transition-colors cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    {lang === 'en' ? 'Scan Mock QR' : 'Quét Thử QR'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Console log display */}
      <div className="bg-slate-950 border border-slate-850 px-3 py-1.5 rounded-lg text-[9px] font-mono text-left text-slate-400">
        &gt; {log || (lang === 'en' ? 'Attendance ready. Tap check-in actions.' : 'Điểm danh hoạt động. Vui lòng bấm hành động thử.')}
      </div>
    </div>
  )
}

// 6. SVG Analytics Dashboard Simulator
function AnalyticsSimulator({ lang }) {
  const [tab, setTab] = useState('months') // months | types

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-200 font-sans shadow-xl relative overflow-hidden h-[400px] flex flex-col justify-between">
      {/* Animation styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes drawLine {
          from { stroke-dashoffset: 400; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes growBar {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
        .animate-draw-line {
          stroke-dasharray: 400;
          stroke-dashoffset: 400;
          animation: drawLine 1.4s ease-out forwards;
        }
        .animate-grow-bar {
          transform-origin: bottom;
          animation: growBar 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-red-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {lang === 'en' ? 'Analytics Dashboard' : 'Thống Kê Giải Đấu'}
          </span>
        </div>
        <div className="flex bg-slate-950 rounded-lg p-0.5 text-[9px] border border-slate-800">
          <button
            onClick={() => setTab('months')}
            className={cn('px-2.5 py-1 rounded font-bold cursor-pointer transition-colors', tab === 'months' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white')}
          >
            {lang === 'en' ? 'Monthly' : 'Tháng'}
          </button>
          <button
            onClick={() => setTab('types')}
            className={cn('px-2.5 py-1 rounded font-bold cursor-pointer transition-colors', tab === 'types' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white')}
          >
            {lang === 'en' ? 'Discipline' : 'Nội Dung'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 my-2">
        <div className="bg-slate-950/70 border border-slate-850 p-2 rounded-xl text-center">
          <div className="text-[9px] text-slate-500 font-bold uppercase">{lang === 'en' ? 'Total VĐV' : 'Tổng VĐV'}</div>
          <div className="text-sm font-black text-white mt-0.5">1,240</div>
          <span className="text-[8px] text-emerald-400 font-bold mt-0.5 block">+12%</span>
        </div>
        <div className="bg-slate-950/70 border border-slate-850 p-2 rounded-xl text-center">
          <div className="text-[9px] text-slate-500 font-bold uppercase">{lang === 'en' ? 'Matches' : 'Trận Đấu'}</div>
          <div className="text-sm font-black text-white mt-0.5">4,820</div>
          <span className="text-[8px] text-slate-500 mt-0.5 block">Live</span>
        </div>
        <div className="bg-slate-950/70 border border-slate-850 p-2 rounded-xl text-center">
          <div className="text-[9px] text-slate-500 font-bold uppercase">{lang === 'en' ? 'Completed' : 'Hoàn Thành'}</div>
          <div className="text-sm font-black text-white mt-0.5">98.4%</div>
          <span className="text-[8px] text-emerald-400 font-bold mt-0.5 block">High</span>
        </div>
      </div>

      {/* Visual Canvas */}
      <div className="flex-1 bg-slate-950/50 border border-slate-850 rounded-xl p-3 flex items-center justify-center mt-1">
        {tab === 'months' ? (
          <svg className="w-full h-full" viewBox="0 0 240 120">
            {/* Grid */}
            <line x1="20" y1="10" x2="230" y2="10" stroke="#1e293b" strokeWidth="1" strokeDasharray="3" />
            <line x1="20" y1="50" x2="230" y2="50" stroke="#1e293b" strokeWidth="1" strokeDasharray="3" />
            <line x1="20" y1="90" x2="230" y2="90" stroke="#1e293b" strokeWidth="1" strokeDasharray="3" />
            <line x1="20" y1="110" x2="230" y2="110" stroke="#334155" strokeWidth="1" />

            <text x="15" y="113" fill="#475569" fontSize="7" textAnchor="end">0</text>
            <text x="15" y="93" fill="#475569" fontSize="7" textAnchor="end">100</text>
            <text x="15" y="53" fill="#475569" fontSize="7" textAnchor="end">200</text>
            <text x="15" y="13" fill="#475569" fontSize="7" textAnchor="end">300</text>

            <text x="35" y="118" fill="#475569" fontSize="7" textAnchor="middle">Jan</text>
            <text x="73" y="118" fill="#475569" fontSize="7" textAnchor="middle">Feb</text>
            <text x="111" y="118" fill="#475569" fontSize="7" textAnchor="middle">Mar</text>
            <text x="149" y="118" fill="#475569" fontSize="7" textAnchor="middle">Apr</text>
            <text x="187" y="118" fill="#475569" fontSize="7" textAnchor="middle">May</text>
            <text x="225" y="118" fill="#475569" fontSize="7" textAnchor="middle">Jun</text>

            <path
              d="M 35 90 L 73 80 L 111 40 L 149 55 L 187 25 L 225 15 L 225 110 L 35 110 Z"
              fill="url(#gradient-area)"
              className="opacity-20"
            />
            <defs>
              <linearGradient id="gradient-area" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
              </linearGradient>
            </defs>

            <path
              d="M 35 90 L 73 80 L 111 40 L 149 55 L 187 25 L 225 15"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="animate-draw-line"
            />

            <circle cx="35" cy="90" r="3" fill="#ef4444" />
            <circle cx="73" cy="80" r="3" fill="#ef4444" />
            <circle cx="111" cy="40" r="3" fill="#ef4444" />
            <circle cx="149" cy="55" r="3" fill="#ef4444" />
            <circle cx="187" cy="25" r="3" fill="#ef4444" />
            <circle cx="225" cy="15" r="3" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
          </svg>
        ) : (
          <svg className="w-full h-full" viewBox="0 0 240 120">
            <line x1="20" y1="110" x2="230" y2="110" stroke="#334155" strokeWidth="1" />

            <rect x="35" y="30" width="16" height="80" fill="#ef4444" rx="2.5" className="animate-grow-bar" />
            <rect x="75" y="55" width="16" height="55" fill="#f87171" rx="2.5" className="animate-grow-bar" style={{animationDelay: '100ms'}} />
            <rect x="115" y="15" width="16" height="95" fill="#ef4444" rx="2.5" className="animate-grow-bar" style={{animationDelay: '200ms'}} />
            <rect x="155" y="70" width="16" height="40" fill="#f87171" rx="2.5" className="animate-grow-bar" style={{animationDelay: '300ms'}} />
            <rect x="195" y="45" width="16" height="65" fill="#b91c1c" rx="2.5" className="animate-grow-bar" style={{animationDelay: '400ms'}} />

            <text x="43" y="118" fill="#475569" fontSize="6.5" textAnchor="middle">{lang === 'en' ? 'MS' : 'Đơn Nam'}</text>
            <text x="83" y="118" fill="#475569" fontSize="6.5" textAnchor="middle">{lang === 'en' ? 'WS' : 'Đơn Nữ'}</text>
            <text x="123" y="118" fill="#475569" fontSize="6.5" textAnchor="middle">{lang === 'en' ? 'MD' : 'Đôi Nam'}</text>
            <text x="163" y="118" fill="#475569" fontSize="6.5" textAnchor="middle">{lang === 'en' ? 'WD' : 'Đôi Nữ'}</text>
            <text x="203" y="118" fill="#475569" fontSize="6.5" textAnchor="middle">{lang === 'en' ? 'XD' : 'Đôi Nam Nữ'}</text>

            <text x="43" y="24" fill="#ffffff" fontSize="6.5" fontWeight="bold" textAnchor="middle">128</text>
            <text x="83" y="49" fill="#ffffff" fontSize="6.5" fontWeight="bold" textAnchor="middle">64</text>
            <text x="123" y="9" fill="#ffffff" fontSize="6.5" fontWeight="bold" textAnchor="middle">160</text>
            <text x="163" y="64" fill="#ffffff" fontSize="6.5" fontWeight="bold" textAnchor="middle">48</text>
            <text x="203" y="39" fill="#ffffff" fontSize="6.5" fontWeight="bold" textAnchor="middle">96</text>
          </svg>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────
export default function FeaturesPage() {
  const { t, lang } = useI18n()
  const [activeTab, setActiveTab] = useState('brackets') // brackets | umpire | courts | standings | attendance | analytics

  // Tabs structure
  const TABS = [
    {
      id: 'brackets',
      label: lang === 'en' ? 'Draw & Brackets' : 'Bốc thăm & Nhánh đấu',
      icon: GitBranch,
      emoji: '🏆',
      headline: lang === 'en' ? 'Smart Draw & Avoid Seed Clashes' : 'Bốc thăm thông minh & Phân loại hạt giống',
      desc: lang === 'en'
        ? 'Generate perfect brackets with a single click. Configure group stages that automatically feed into knockout brackets.'
        : 'Hệ thống tự tạo nhánh đấu loại trực tiếp tự động từ danh sách đăng ký. Tự động kiểm soát hạt giống và ngăn CLB đụng độ sớm.',
      points: lang === 'en' ? [
        'Avoid Seed Clashes: Automatically separates seed 1 & 2 to the opposite ends of the bracket tree.',
        'Club Conflict Prevention: Ensures players from the same club do not meet in the early group stages.',
        'Public Access: Athletes and spectators can view the interactive bracket tree without needing an account.'
      ] : [
        'Chống trùng hạt giống: Tự động xếp hạt giống số 1 và số 2 ở 2 nửa nhánh đấu xa nhau.',
        'Tránh CLB đụng độ sớm: Đảm bảo các tay vợt cùng câu lạc bộ không bốc vào chung bảng đấu.',
        'Xem trực quan không cần tài khoản: Khán giả và VĐV truy cập xem nhánh đấu online cập nhật tức thì.'
      ],
      component: BracketSimulator
    },
    {
      id: 'umpire',
      label: lang === 'en' ? 'Umpire Scoreboard' : 'Ghi điểm Trọng tài',
      icon: Swords,
      emoji: '🏟️',
      headline: lang === 'en' ? 'Professional BWF Dark-themed Umpire Interface' : 'Giao diện trọng tài BWF chuyên dụng',
      desc: lang === 'en'
        ? 'A high-fidelity tablet interface that replicates the BWF scoreboard app. Updates live TV streams in under 10ms.'
        : 'Giao diện tối tối giản cho trọng tài điều khiển trận đấu trên sân. Tự động định vị VĐV trên sân, đồng bộ tỷ số siêu tốc.',
      points: lang === 'en' ? [
        'Green Court Canvas: Shows players exact positioning based on current score (even/odd serving courts).',
        'Tablet-Optimized UI: Large tap regions, serve indicator, completed set logs, and quick undo/redo.',
        'Sub-10ms Sync: Scores update instantly on court TVs and spectator live streams.'
      ] : [
        'Sơ đồ sân đấu xanh lá: Tự động xếp VĐV vào ô giao/nhận cầu chính xác theo điểm số chẵn/lẻ.',
        'Tối ưu máy tính bảng: Nút chạm điểm siêu lớn, chỉ báo giao cầu, lưu lịch sử sets và hoàn điểm nhanh.',
        'Đồng bộ siêu tốc < 10ms: Tỷ số cập nhật tức thì đến màn hình TV và livescore trực tuyến.'
      ],
      component: UmpireSimulator
    },
    {
      id: 'courts',
      label: lang === 'en' ? 'Court Coordinator' : 'Điều phối Sân đấu',
      icon: MonitorPlay,
      emoji: '🏸',
      headline: lang === 'en' ? 'Live Court Coordinating & Safety Warning Board' : 'Bảng điều phối và xếp sân đấu trực tiếp',
      desc: lang === 'en'
        ? 'Allocate matches to empty courts instantly. Monitor match durations and alert umpires for safety.'
        : 'Phân phối các trận đấu chờ vào sân trống, theo dõi tiến độ thi đấu và hỗ trợ trọng tài gọi cứu trợ hoặc quá giờ.',
      points: lang === 'en' ? [
        'Instant Assignment: Allocate waiting matches to empty courts with a single tap.',
        'Safety Alerts: Automatic warnings when athletes have been playing continuously for over 90 minutes.',
        'Umpire Assistance Calls: Real-time notifications sent to BTC when a court needs equipment or shuttles.'
      ] : [
        'Xếp sân nhanh chóng: Đưa các trận đấu đang chờ vào sân trống lập tức chỉ với 1 chạm.',
        'Cảnh báo quá nhiệt: Tự động cảnh báo sức khỏe khi có VĐV thi đấu liên tục quá 90 phút.',
        'Hỗ trợ Trọng tài: Trọng tài tại sân có thể gọi BTC bổ sung cầu, nước uống trực tiếp qua ứng dụng.'
      ],
      component: CourtSimulator
    },
    {
      id: 'standings',
      label: lang === 'en' ? 'Standings Table' : 'Bảng điểm Vòng bảng',
      icon: Layers,
      emoji: '📋',
      headline: lang === 'en' ? 'Dynamic Standings Table & Tie-breakers' : 'Tự động tính toán & Sắp xếp bảng đấu',
      desc: lang === 'en'
        ? 'Standings automatically calculate game/set ratios and point differences. Resorts instantly as scores are typed.'
        : 'Bảng xếp hạng tự động tính toán hiệu số set thắng/thua, điểm số và tự động sắp xếp lại thứ hạng theo chuẩn BWF.',
      points: lang === 'en' ? [
        'Automatic Calculations: Handles matches played, wins, losses, set diffs, and rally point diffs.',
        'Instant Re-sorting: Try out different scores below and watch the table row order transition immediately.',
        'Smart Tie-breakers: Implements BWF-standard rules for resolving ties between 2 or 3 athletes.'
      ] : [
        'Tính toán hiệu số tự động: Tự động cộng trừ số trận đấu, trận thắng/thua, set đấu và điểm số.',
        'Sắp xếp lại tức thì: Thử nhập điểm các trận đấu phía dưới để xem bảng xếp hạng tự động trượt sắp xếp lại.',
        'Luật Tie-break thông minh: Tuân thủ quy chuẩn BWF để phân định thứ hạng khi các VĐV bằng điểm.'
      ],
      component: GroupStandingsSimulator
    },
    {
      id: 'attendance',
      label: lang === 'en' ? 'Check-in & Walkover' : 'Điểm danh VĐV',
      icon: CalendarCheck,
      emoji: '👤',
      headline: lang === 'en' ? 'QR Code Attendance & Automated Walkovers' : 'Điểm danh QR & Tự động xử thua Walkover',
      desc: lang === 'en'
        ? 'Register player presence on arrival. Marking a player absent automatically resolves and forfeits their matches.'
        : 'Điểm danh VĐV nhanh chóng qua mã QR cá nhân. Tự động xử thua (walkover) các trận đấu liên quan nếu VĐV vắng mặt.',
      points: lang === 'en' ? [
        'QR Code Scanner: Fast check-in by scanning the barcode generated for each player profile.',
        'Automatic Walkovers: Resolves absent matches as 0-2 (0-21, 0-21) losses without manual score entries.',
        'Court Clearing: Absent walkovers release courts instantly so other matches can proceed.'
      ] : [
        'Quét mã QR điểm danh: Điểm danh siêu tốc bằng cách quét mã vạch cá nhân của vận động viên.',
        'Tự động xử thua Walkover: Tự động ghi nhận tỉ số 0-2 (0-21, 0-21) cho các trận của VĐV vắng mặt.',
        'Giải phóng sân đấu: Nhờ walkover tự động, sân thi đấu được giải phóng lập tức để xếp các trận tiếp theo.'
      ],
      component: AttendanceSimulator
    },
    {
      id: 'analytics',
      label: lang === 'en' ? 'Reports & Stats' : 'Báo cáo & Thống kê',
      icon: BarChart2,
      emoji: '📊',
      headline: lang === 'en' ? 'Excel Export & Interactive Dashboard' : 'Báo cáo Excel toàn diện & Thống kê chi tiết',
      desc: lang === 'en'
        ? 'Analyze tournament performance, track athlete growth, and download complete reports ready for sponsors.'
        : 'Công cụ tổng hợp dữ liệu, xuất báo cáo kết quả toàn giải đấu định dạng Excel cao cấp và trực quan hóa dữ liệu.',
      points: lang === 'en' ? [
        'Detailed Excel Export: One-click report containing all brackets, match scores, and rankings.',
        'Real-time Standings: Standings automatically recalculate game/set diffs on every score change.',
        'Creator Dashboard: Monthly analytics of registered athletes, matches played, and growth.'
      ] : [
        'Xuất Excel 1 click: Tải về toàn bộ danh sách VĐV, kết quả từng vòng và thứ hạng để gửi nhà tài trợ.',
        'Cập nhật BXH tự động: Bảng xếp hạng vòng bảng tự tính toán chỉ số phụ ngay khi trọng tài bấm điểm.',
        'Thống kê trực quan: Biểu đồ trực quan hóa dữ liệu người tham dự, cơ cấu nội dung và sự phát triển giải đấu.'
      ],
      component: AnalyticsSimulator
    }
  ]

  const activeTabDetails = TABS.find(t => t.id === activeTab)
  const SimulatedMockup = activeTabDetails ? activeTabDetails.component : BracketSimulator

  return (
    <div className="min-h-screen bg-gray-50">
      {/* CSS Animations style override */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}} />

      {/* ── Hero Section ── */}
      <div className="relative overflow-hidden bg-slate-950 text-white pt-16 pb-20 px-4">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-[300px] h-[300px] bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Copywriting */}
            <div className="lg:col-span-7 space-y-6 text-left animate-slide-up">
              <span className="inline-flex items-center gap-1.5 bg-red-600/15 border border-red-500/20 text-red-500 text-xs px-4 py-1.5 rounded-full font-bold uppercase tracking-wider">
                🏸 BT Manager — Professional Product Tour
              </span>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.1] text-white">
                {lang === 'en'
                  ? 'Professional Software For Badminton Tournaments'
                  : 'Giải Pháp Tổ Chức Giải Đấu Cầu Lông Chuyên Nghiệp'}
              </h1>
              <p className="text-slate-400 text-base sm:text-lg max-w-xl leading-relaxed">
                {lang === 'en'
                  ? 'All-in-one platform to run successful badminton tournaments. From smart brackets to real-time scoring and court scheduling — designed for organizers, umpires, and athletes.'
                  : 'Nền tảng tích hợp đầy đủ công cụ để vận hành giải đấu cầu lông của bạn. Từ bốc thăm chia bảng, sơ đồ knockout tự động, ghi điểm trọng tài real-time đến điều phối sân bãi.'}
              </p>

              {/* Call to action */}
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  to="/register"
                  className="px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-red-600/20 hover:scale-105 active:scale-95 transition-all duration-200"
                >
                  {lang === 'en' ? 'Get Started Free' : 'Tạo Tài Khoản Miễn Phí'}
                </Link>
                <Link
                  to="/plans"
                  className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-semibold text-sm rounded-xl hover:scale-105 active:scale-95 transition-all duration-200"
                >
                  {lang === 'en' ? 'View Plans & Pricing' : 'Xem Bảng Giá Gói'}
                </Link>
              </div>
            </div>

            {/* Right Column: Hero Graphic */}
            <div className="lg:col-span-5 relative w-full flex justify-center animate-slide-up" style={{animationDelay: '150ms'}}>
              <div className="relative p-2 bg-gradient-to-tr from-slate-900 to-slate-800 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden max-w-sm sm:max-w-md">
                <img
                  src={heroImg}
                  alt="Badminton Tournament Manager Hero Showcase"
                  className="rounded-2xl w-full object-cover aspect-[4/3] bg-slate-950 opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-4 left-4 right-4 bg-slate-950/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-500">
                    <Trophy className="w-4 h-4 fill-current" />
                    <span>BT Manager Live Demo</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {lang === 'en'
                      ? 'Interactive sports coordinator UI. Try out simulators in the features sections below.'
                      : 'Hệ thống vận hành giải đấu thông minh. Khám phá các công cụ tương tác ở phần tính năng phía dưới.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Interactive Simulators Showcase ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
            {lang === 'en' ? 'Discover Our Tournament Control Room' : 'Khám Phá Phòng Điều Hành Giải Đấu'}
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            {lang === 'en'
              ? 'Click the tabs below to interact with real-time simulators of our core features.'
              : 'Chọn các thẻ dưới đây để tương tác trực tiếp với các bộ giả lập tính năng của chúng tôi.'}
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 bg-gray-100 p-1.5 rounded-2xl max-w-5xl mx-auto border border-gray-200 shadow-sm">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer',
                  isActive
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Tab Content Panel */}
        {activeTabDetails && (
          <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-sm transition-all duration-300 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left side details */}
            <div className="lg:col-span-6 space-y-5 text-left animate-slide-up">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{activeTabDetails.emoji}</span>
                <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  {activeTabDetails.headline}
                </h3>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                {activeTabDetails.desc}
              </p>

              <ul className="space-y-3 pt-2">
                {activeTabDetails.points.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-gray-700 font-medium">
                    <span className="w-5 h-5 bg-red-50 text-red-600 rounded-full flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">
                      ✓
                    </span>
                    <span className="leading-normal">{pt}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right side live interactive mockup */}
            <div className="lg:col-span-6 w-full animate-slide-up" style={{animationDelay: '100ms'}}>
              <SimulatedMockup lang={lang} />
            </div>
          </div>
        )}
      </div>

      {/* ── Feature Comparison Table ── */}
      <div className="bg-white border-y border-gray-200 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black text-gray-900">
              {lang === 'en' ? 'Plan Limit Comparison' : 'So Sánh Hạn Mức Giữa Các Gói'}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {lang === 'en' ? 'Choose the package that fits your event scale.' : 'Lựa chọn gói dịch vụ phù hợp với quy mô giải đấu của bạn.'}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-md">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3.5 text-left font-bold text-gray-700">{lang === 'en' ? 'Limit / Feature' : 'Hạn mức / Tính năng'}</th>
                  <th className="px-4 py-3.5 text-center font-bold text-gray-500">Free</th>
                  <th className="px-4 py-3.5 text-center font-bold text-blue-600 bg-blue-50/30">Basic</th>
                  <th className="px-4 py-3.5 text-center font-bold text-purple-600">Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  [lang === 'en' ? 'Max Tournaments' : 'Số giải đấu',              '1',   '5',    '∞'],
                  [lang === 'en' ? 'Athletes / Discipline' : 'VĐV / nội dung',           '32',  '128',  '∞'],
                  [lang === 'en' ? 'Disciplines / Tournament' : 'Nội dung / giải',          '2',   '5',    '∞'],
                  [lang === 'en' ? 'Group Stage + Knockout Format' : 'Vòng bảng + Knockout',     '✓',   '✓',    '✓'],
                  [lang === 'en' ? 'Smart Draw Seed Conflict Avoidance' : 'Bốc thăm thông minh',      '✓',   '✓',    '✓'],
                  [lang === 'en' ? 'Real-time Score Syncing' : 'Ghi điểm realtime',        '✓',   '✓',    '✓'],
                  [lang === 'en' ? 'Smart Check-in + Auto Forfeit' : 'Điểm danh + auto-forfeit', '—',   '✓',    '✓'],
                  [lang === 'en' ? 'Referee Assignment' : 'Phân công trọng tài',      '—',   '✓',    '✓'],
                  [lang === 'en' ? 'Professional Analytics Dashboard' : 'Analytics dashboard',      '—',   '—',    '✓'],
                  [lang === 'en' ? 'Excel Report Exporting' : 'Xuất báo cáo Excel',       '—',   '—',    '✓'],
                ].map(([label, free, basic, pro], idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-semibold text-gray-700">{label}</td>
                    <td className="px-4 py-3 text-center text-gray-400 font-medium">{free}</td>
                    <td className="px-4 py-3 text-center text-blue-600 font-bold bg-blue-50/10">{basic}</td>
                    <td className="px-4 py-3 text-center text-purple-600 font-bold">{pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-center mt-6">
            <Link
              to="/plans"
              className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-bold underline underline-offset-2"
            >
              {lang === 'en' ? 'Go to Pricing details' : 'Xem chi tiết bảng giá các gói dịch vụ'}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Bottom Call To Action ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-3xl px-6 py-12 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />

          <h2 className="text-2xl sm:text-3xl font-black mb-3 text-white">
            {lang === 'en' ? 'Start Running Tournaments for Free Today' : 'Tổ Chức Giải Đấu Đầu Tiên Miễn Phí'}
          </h2>
          <p className="text-red-100 mb-8 max-w-md mx-auto text-sm">
            {lang === 'en'
              ? 'Join over 1,000+ badminton creators. Run brackets, score live, and engage fans.'
              : 'Gia nhập mạng lưới hàng nghìn nhà tổ chức giải cầu lông chuyên nghiệp trên toàn quốc.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/register"
              className="bg-white text-red-600 font-bold px-6 py-3 rounded-full hover:bg-slate-50 hover:scale-105 active:scale-95 transition-all text-xs"
            >
              {lang === 'en' ? 'Create Free Account' : 'Đăng Ký Tài Khoản Miễn Phí'}
            </Link>
            <Link
              to="/plans"
              className="bg-red-700/50 text-white border border-red-500/25 font-bold px-6 py-3 rounded-full hover:bg-red-700/80 hover:scale-105 active:scale-95 transition-all text-xs"
            >
              {lang === 'en' ? 'Explore Pro Features' : 'Xem Bảng Giá Gói Dịch Vụ'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
