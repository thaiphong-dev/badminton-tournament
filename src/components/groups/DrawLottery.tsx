import { useState, useRef, useEffect, useMemo } from 'react'
import { CheckCircle, AlertCircle, ChevronRight } from 'lucide-react'
import { saveGroupsAndMatches } from '@/lib/utils/matchScheduler'
import Button from '@/components/ui/Button'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function groupTargetSize(groupIdx, totalPlayers, numGroups) {
  const large = totalPlayers % numGroups
  const small = Math.floor(totalPlayers / numGroups)
  return groupIdx < large ? small + 1 : small
}

const groupLabel = (idx) => String.fromCharCode(65 + idx)

const GROUP_BG = [
  'bg-blue-500',   'bg-purple-500', 'bg-green-500',  'bg-orange-500',
  'bg-pink-500',   'bg-teal-500',   'bg-red-500',    'bg-yellow-500',
  'bg-indigo-500', 'bg-cyan-500',   'bg-rose-500',   'bg-emerald-500',
]
const GROUP_LIGHT = [
  'bg-blue-50 border-blue-300',    'bg-purple-50 border-purple-300',
  'bg-green-50 border-green-300',  'bg-orange-50 border-orange-300',
  'bg-pink-50 border-pink-300',    'bg-teal-50 border-teal-300',
  'bg-red-50 border-red-300',      'bg-yellow-50 border-yellow-300',
  'bg-indigo-50 border-indigo-300','bg-cyan-50 border-cyan-300',
  'bg-rose-50 border-rose-300',    'bg-emerald-50 border-emerald-300',
]

// ─── Slot animation hook ──────────────────────────────────────────────────────
function useSlotAnimation(pool) {
  const [display, setDisplay]   = useState(null)
  const [spinning, setSpinning] = useState(false)
  const timerRef = useRef(null)
  useEffect(() => () => clearTimeout(timerRef.current), [])

  function spin(winner, onDone) {
    if (!pool.length) return
    setSpinning(true)
    const STEPS = 28
    let step = 0
    function tick() {
      if (step >= STEPS) { setDisplay(winner); setSpinning(false); onDone?.(); return }
      const showWinner = step >= STEPS - 4 && Math.random() > 0.5
      setDisplay(showWinner ? winner : pool[Math.floor(Math.random() * pool.length)])
      step++
      timerRef.current = setTimeout(tick, 50 + Math.pow(step / STEPS, 2) * 230)
    }
    tick()
  }
  return { display, spinning, spin }
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DrawLottery({ tournament, event, players, onConfirmed }) {
  const numGroups = (event ?? tournament).num_groups ?? tournament.num_groups
  const eventId   = event?.id ?? null

  const avoidSameClubProp = event?.avoid_same_club ?? tournament?.avoid_same_club ?? true
  const [localAvoidSameClub, setLocalAvoidSameClub] = useState(avoidSameClubProp)

  useEffect(() => {
    setLocalAvoidSameClub(avoidSameClubProp)
  }, [avoidSameClubProp])

  const [undrawn, setUndrawn]         = useState(() => players.map((p, i) => ({ ...p, drawNum: i + 1 })))
  const [draftGroups, setDraftGroups] = useState(() => Array.from({ length: numGroups }, () => []))
  // Map playerId → groupIdx for drawn players
  const [drawnMap, setDrawnMap]       = useState({})
  const [lastDraw, setLastDraw]       = useState(null)
  const [phase, setPhase]             = useState('idle')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState(null)

  const { display: reelDisplay, spinning, spin } = useSlotAnimation(undrawn)

  const currentGroupIdx = useMemo(() =>
    draftGroups.findIndex((g, i) => g.length < groupTargetSize(i, players.length, numGroups)),
    [draftGroups, players.length, numGroups],
  )
  const allDrawn = currentGroupIdx === -1 && undrawn.length === 0
  const drawn    = players.length - undrawn.length

  function handleDraw() {
    if (!undrawn.length || phase !== 'idle' || currentGroupIdx < 0) return
    const groupIdx = currentGroupIdx
    
    let candidates = [...undrawn]
    if (localAvoidSameClub) {
      const currentGroup = draftGroups[groupIdx] || []
      const currentClubs = currentGroup.map(p => p.club).filter(c => c && c !== 'Tự do')
      const filtered = undrawn.filter(p => !p.club || p.club === 'Tự do' || !currentClubs.includes(p.club))
      if (filtered.length > 0) {
        candidates = filtered
      }
    }

    const player   = candidates[Math.floor(Math.random() * candidates.length)]
    const groupIdxValue = groupIdx
    setPhase('spinning')
    spin(player, () => {
      setLastDraw({ player, groupIdx: groupIdxValue })
      setPhase('reveal')
      setTimeout(() => {
        setUndrawn(prev => prev.filter(p => p.id !== player.id))
        setDraftGroups(prev => { const n = prev.map(g => [...g]); n[groupIdxValue] = [...n[groupIdxValue], player]; return n })
        setDrawnMap(prev => ({ ...prev, [player.id]: groupIdxValue }))
        setPhase(undrawn.length === 1 ? 'done' : 'idle')
      }, 1100)
    })
  }

  async function handleConfirm() {
    setSaving(true); setError(null)
    try {
      await saveGroupsAndMatches(draftGroups, tournament.id, eventId)
      onConfirmed()
    } catch (err) {
      setError(`Lỗi khi lưu: ${err.message}`)
      setSaving(false)
    }
  }

  const totalMatch = draftGroups.reduce((s, g) => s + (g.length * (g.length - 1)) / 2, 0)

  return (
    <div className="space-y-4">

      {/* ── Progress ── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${(drawn / players.length) * 100}%` }} />
        </div>
        <span className="text-xs font-medium text-gray-500 shrink-0">{drawn}/{players.length} VĐV</span>
      </div>

      {/* ── Main two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">

        {/* ── LEFT: Player list ── */}
        <div className="h-full bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Danh sách VĐV</p>
            <span className="text-xs text-gray-400">{undrawn.length} chưa bốc</span>
          </div>
          <div className="overflow-y-auto flex-1 max-h-[70vh]">
            {players.map((p, i) => {
              const isDrawn     = p.id in drawnMap
              const gIdx        = drawnMap[p.id]
              const isJustDrawn = lastDraw?.player.id === p.id
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-2.5 px-3 py-2 border-b border-gray-50 last:border-0 transition-colors ${
                    isJustDrawn ? (GROUP_LIGHT[gIdx % GROUP_LIGHT.length]) :
                    isDrawn     ? 'bg-gray-50' : 'bg-white'
                  }`}
                >
                  {/* Number badge */}
                  <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                    isDrawn ? 'bg-gray-200 text-gray-400' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {i + 1}
                  </span>

                  {/* Name + club */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate leading-tight ${isDrawn ? 'text-gray-400 line-through' : 'text-gray-800 font-medium'}`}>
                      {p.name}
                    </p>
                    {p.club && (
                      <p className="text-xs text-gray-400 truncate leading-tight">{p.club}</p>
                    )}
                  </div>

                  {/* Group badge */}
                  {isDrawn && (
                    <span className={`text-white text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${GROUP_BG[gIdx % GROUP_BG.length]}`}>
                      {groupLabel(gIdx)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── RIGHT: Reel + Groups ── */}
        <div className="space-y-4">

          {/* Avoid Same Club Toggle */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={localAvoidSameClub}
                onChange={e => setLocalAvoidSameClub(e.target.checked)}
                disabled={drawn > 0}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
              <span>Ưu tiên xếp khác bảng cho VĐV cùng CLB</span>
            </label>
            <span className="text-xs text-gray-400">
              {drawn > 0 ? 'Đang bốc thăm' : 'Chưa bốc thăm'}
            </span>
          </div>

          {/* Current group banner */}
          {!allDrawn && currentGroupIdx >= 0 && (
            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${GROUP_LIGHT[currentGroupIdx % GROUP_LIGHT.length]}`}>
              <span className={`w-9 h-9 rounded-xl text-white font-black text-lg flex items-center justify-center shrink-0 ${GROUP_BG[currentGroupIdx % GROUP_BG.length]}`}>
                {groupLabel(currentGroupIdx)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">
                  Đang bốc thăm Bảng {groupLabel(currentGroupIdx)}
                </p>
                <p className="text-xs text-gray-500">
                  {draftGroups[currentGroupIdx].length}/{groupTargetSize(currentGroupIdx, players.length, numGroups)} VĐV
                  {draftGroups[currentGroupIdx].length > 0 && (
                    <span className="ml-1.5 text-gray-400 truncate">
                      · {draftGroups[currentGroupIdx].map(p => p.name).join(', ')}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Spin reel */}
          <div className="flex flex-col items-center gap-3">
            <div className={`w-full rounded-2xl border-2 overflow-hidden transition-all duration-300 ${
              spinning           ? 'border-blue-400 shadow-lg shadow-blue-100'  :
              phase === 'reveal' ? 'border-green-400 shadow-lg shadow-green-100' :
                                   'border-gray-200'
            }`}>
              <div className={`px-6 py-6 text-center min-h-[120px] flex flex-col items-center justify-center transition-colors duration-300 ${
                spinning           ? 'bg-blue-50'  :
                phase === 'reveal' ? 'bg-green-50' : 'bg-gray-50'
              }`}>
                {reelDisplay && (
                  <div className="text-xs font-bold text-gray-400 mb-1">#{reelDisplay.drawNum}</div>
                )}
                <div className={`text-2xl font-black tracking-tight ${
                  spinning           ? 'text-blue-700'  :
                  phase === 'reveal' ? 'text-green-700' :
                  reelDisplay        ? 'text-gray-700'  : 'text-gray-300'
                }`}
                  style={phase === 'reveal' ? { animation: 'revealPop 0.4s ease-out' } : {}}
                >
                  {reelDisplay?.name ?? <span className="text-lg font-medium">Bấm bốc thăm...</span>}
                </div>
                {reelDisplay?.club && (
                  <div className={`text-sm mt-0.5 ${spinning ? 'text-blue-400' : 'text-gray-400'}`}>
                    {reelDisplay.club}
                  </div>
                )}
                {phase === 'reveal' && lastDraw && (
                  <div className={`mt-3 px-4 py-1.5 rounded-full text-white font-bold text-sm ${GROUP_BG[lastDraw.groupIdx % GROUP_BG.length]}`}
                    style={{ animation: 'slideUp 0.3s ease-out' }}>
                    → Bảng {groupLabel(lastDraw.groupIdx)}
                  </div>
                )}
                {(phase === 'idle' || phase === 'done') && lastDraw && drawn > 0 && (
                  <div className={`mt-2 px-3 py-0.5 rounded-full text-white text-xs font-semibold ${GROUP_BG[lastDraw.groupIdx % GROUP_BG.length]}`}>
                    ✓ Bảng {groupLabel(lastDraw.groupIdx)}
                  </div>
                )}
                {spinning && (
                  <div className="flex gap-1 mt-2">
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400"
                        style={{ animation: `dotBounce 0.8s ${i * 0.15}s infinite` }} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleDraw}
              disabled={spinning || phase === 'reveal' || allDrawn}
              className={`w-full py-3 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 ${
                spinning || phase === 'reveal' || allDrawn
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-md shadow-blue-200'
              }`}
            >
              <span className="text-lg">🎲</span>
              {spinning ? 'Đang quay...' : allDrawn ? 'Đã bốc xong' :
               currentGroupIdx >= 0 ? `Bốc vào Bảng ${groupLabel(currentGroupIdx)}` : 'Bốc thăm'}
            </button>
          </div>

          {/* Groups grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {draftGroups.map((group, idx) => {
              const target   = groupTargetSize(idx, players.length, numGroups)
              const isFull   = group.length >= target
              const isActive = idx === currentGroupIdx
              return (
                <div key={idx} className={`border rounded-xl p-2.5 transition-all duration-300 ${
                  isActive ? `${GROUP_LIGHT[idx % GROUP_LIGHT.length]} ring-2 ring-offset-1` :
                  isFull   ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
                }`}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className={`w-6 h-6 rounded-md text-white text-xs font-black flex items-center justify-center shrink-0 ${GROUP_BG[idx % GROUP_BG.length]}`}>
                      {groupLabel(idx)}
                    </span>
                    <span className="text-xs font-semibold text-gray-600 flex-1 truncate">Bảng {groupLabel(idx)}</span>
                    <span className={`text-xs font-medium ${isFull ? 'text-green-600' : 'text-gray-400'}`}>
                      {isFull ? '✓' : `${group.length}/${target}`}
                    </span>
                  </div>
                  <div className="space-y-0.5 pl-1">
                    {group.map(p => (
                      <div key={p.id} className="flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0" />
                        <span className={`text-xs truncate leading-tight ${
                          lastDraw?.player.id === p.id ? 'font-bold text-gray-900' : 'text-gray-600'
                        }`}>{p.name}</span>
                      </div>
                    ))}
                    {Array.from({ length: target - group.length }).map((_, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full border border-dashed border-gray-200 shrink-0" />
                        <span className="text-xs text-gray-200">—</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Errors */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {/* Confirm */}
          {allDrawn && (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-semibold">Bốc thăm hoàn tất!</p>
                  <p className="text-xs text-green-600 mt-0.5">{numGroups} bảng · {totalMatch} trận vòng bảng</p>
                </div>
              </div>
              <Button onClick={handleConfirm} loading={saving}>
                <CheckCircle className="w-4 h-4" />
                Xác nhận &amp; Tạo lịch
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes revealPop {
          0%   { transform: scale(0.8);  opacity: 0.4; }
          60%  { transform: scale(1.07); }
          100% { transform: scale(1);    opacity: 1;   }
        }
        @keyframes slideUp {
          from { transform: translateY(10px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes dotBounce {
          0%, 100% { transform: translateY(0);    opacity: 0.4; }
          50%       { transform: translateY(-4px); opacity: 1;   }
        }
      `}</style>
    </div>
  )
}
