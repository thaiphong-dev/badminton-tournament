import { useState, useRef, useEffect, useMemo } from 'react'
import { CheckCircle, AlertCircle, ChevronRight, LayoutGrid, GitBranch } from 'lucide-react'
import { saveKnockoutBracket, buildBracketRows } from '@/lib/utils/bracketGenerator'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import BracketView from '@/components/knockout/BracketView'
import { cn } from '@/lib/utils/cn'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getBracketSize(n) {
  if (n <= 4)  return 4
  if (n <= 8)  return 8
  if (n <= 16) return 16
  if (n <= 32) return 32
  return 64
}

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
export default function DrawKnockout({ tournament, event, players, onConfirmed }) {
  const eventId = event?.id ?? null

  const [undrawn, setUndrawn]       = useState(() => players.map((p, i) => ({ ...p, drawNum: i + 1 })))
  const [drawnSeeds, setDrawnSeeds] = useState([])
  const [drawnMap, setDrawnMap]     = useState({})
  const [lastDraw, setLastDraw]     = useState(null)
  const [phase, setPhase]           = useState('idle')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)
  const [activeTab, setActiveTab]   = useState('seeds')

  const { display: reelDisplay, spinning, spin } = useSlotAnimation(undrawn)

  const currentSeed = drawnSeeds.length + 1
  const allDrawn    = undrawn.length === 0
  const drawn       = players.length - undrawn.length
  const bracketSize = useMemo(() => getBracketSize(players.length), [players.length])

  // Build virtual match objects for BracketView preview
  // Undrawn seeds → player_id: null (shows as TBD), drawn seeds → real player_id
  const previewMatches = useMemo(() => {
    const fullSeeds = Array.from({ length: players.length }, (_, i) => ({
      player_id: drawnSeeds[i]?.id ?? null,
      seed: i + 1,
    }))
    const { rows } = buildBracketRows(fullSeeds, 'preview')
    return rows.map((r, i) => ({ ...r, id: `preview-${i}` }))
  }, [drawnSeeds, players.length])

  const previewPlayerMap = useMemo(
    () => Object.fromEntries(drawnSeeds.map(p => [p.id, p])),
    [drawnSeeds],
  )

  function handleDraw() {
    if (!undrawn.length || phase !== 'idle') return
    const player = undrawn[Math.floor(Math.random() * undrawn.length)]
    const seed   = currentSeed
    setPhase('spinning')
    spin(player, () => {
      setLastDraw({ player, seed })
      setPhase('reveal')
      setTimeout(() => {
        setUndrawn(prev => prev.filter(p => p.id !== player.id))
        setDrawnSeeds(prev => [...prev, player])
        setDrawnMap(prev => ({ ...prev, [player.id]: seed }))
        setPhase(undrawn.length === 1 ? 'done' : 'idle')
      }, 1100)
    })
  }

  async function handleConfirm() {
    setSaving(true); setError(null)
    try {
      const qualified = drawnSeeds.map((p, i) => ({
        player_id:   p.id,
        seed:        i + 1,
        player_name: p.name,
        club:        p.club,
      }))
      const saved = await saveKnockoutBracket(qualified, tournament.id, eventId)
      if (eventId && event?.status === 'setup') {
        await supabase.from('events').update({ status: 'knockout' }).eq('id', eventId)
      }
      onConfirmed(saved)
    } catch (err) {
      setError(`Lỗi khi lưu: ${err.message}`)
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${(drawn / players.length) * 100}%` }} />
        </div>
        <span className="text-xs font-medium text-gray-500 shrink-0">
          {drawn}/{players.length} VĐV · Bracket {bracketSize}
        </span>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">

        {/* LEFT: Player list */}
        <div className="h-full bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Danh sách VĐV</p>
            <span className="text-xs text-gray-400">{undrawn.length} chưa bốc</span>
          </div>
          <div className="overflow-y-auto flex-1 max-h-[70vh]">
            {players.map((p, i) => {
              const isDrawn     = p.id in drawnMap
              const seed        = drawnMap[p.id]
              const isJustDrawn = lastDraw?.player.id === p.id
              return (
                <div key={p.id} className={cn(
                  'flex items-center gap-2.5 px-3 py-2 border-b border-gray-50 last:border-0 transition-colors',
                  isJustDrawn ? 'bg-purple-50' : isDrawn ? 'bg-gray-50' : 'bg-white',
                )}>
                  <span className={cn(
                    'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0',
                    isDrawn ? 'bg-gray-200 text-gray-400' : 'bg-gray-100 text-gray-500',
                  )}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm truncate leading-tight',
                      isDrawn ? 'text-gray-400 line-through' : 'text-gray-800 font-medium',
                    )}>
                      {p.name}
                    </p>
                    {p.club && <p className="text-xs text-gray-400 truncate leading-tight">{p.club}</p>}
                  </div>
                  {isDrawn && (
                    <span className="bg-purple-600 text-white text-xs font-bold px-1.5 py-0.5 rounded shrink-0">
                      #{seed}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT — min-w-0 prevents the 1fr grid column from expanding with bracket content */}
        <div className="space-y-4 min-w-0">

          {/* Current seed banner */}
          {!allDrawn && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border bg-purple-50 border-purple-300">
              <span className="w-9 h-9 rounded-xl bg-purple-600 text-white font-black text-lg flex items-center justify-center shrink-0">
                #{currentSeed}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">Đang bốc Hạt giống #{currentSeed}</p>
                <p className="text-xs text-gray-500">{drawn}/{players.length} VĐV đã được bốc</p>
              </div>
            </div>
          )}

          {/* Spin reel */}
          <div className="flex flex-col items-center gap-3">
            <div className={cn(
              'w-full rounded-2xl border-2 overflow-hidden transition-all duration-300',
              spinning           ? 'border-purple-400 shadow-lg shadow-purple-100' :
              phase === 'reveal' ? 'border-green-400 shadow-lg shadow-green-100' :
                                   'border-gray-200',
            )}>
              <div className={cn(
                'px-6 py-6 text-center min-h-[120px] flex flex-col items-center justify-center transition-colors duration-300',
                spinning ? 'bg-purple-50' : phase === 'reveal' ? 'bg-green-50' : 'bg-gray-50',
              )}>
                {reelDisplay && (
                  <div className="text-xs font-bold text-gray-400 mb-1">#{reelDisplay.drawNum}</div>
                )}
                <div className={cn(
                  'text-2xl font-black tracking-tight',
                  spinning           ? 'text-purple-700' :
                  phase === 'reveal' ? 'text-green-700'  :
                  reelDisplay        ? 'text-gray-700'   : 'text-gray-300',
                )}
                  style={phase === 'reveal' ? { animation: 'revealPop 0.4s ease-out' } : {}}
                >
                  {reelDisplay?.name ?? <span className="text-lg font-medium">Bấm bốc thăm...</span>}
                </div>
                {reelDisplay?.club && (
                  <div className={cn('text-sm mt-0.5', spinning ? 'text-purple-400' : 'text-gray-400')}>
                    {reelDisplay.club}
                  </div>
                )}
                {phase === 'reveal' && lastDraw && (
                  <div className="mt-3 px-4 py-1.5 rounded-full bg-purple-600 text-white font-bold text-sm"
                    style={{ animation: 'slideUp 0.3s ease-out' }}>
                    → Hạt giống #{lastDraw.seed}
                  </div>
                )}
                {(phase === 'idle' || phase === 'done') && lastDraw && drawn > 0 && (
                  <div className="mt-2 px-3 py-0.5 rounded-full bg-purple-600 text-white text-xs font-semibold">
                    ✓ Hạt giống #{lastDraw.seed}
                  </div>
                )}
                {spinning && (
                  <div className="flex gap-1 mt-2">
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400"
                        style={{ animation: `dotBounce 0.8s ${i * 0.15}s infinite` }} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleDraw}
              disabled={spinning || phase === 'reveal' || allDrawn}
              className={cn(
                'w-full py-3 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2',
                spinning || phase === 'reveal' || allDrawn
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95 shadow-md shadow-purple-200',
              )}
            >
              <span className="text-lg">🎲</span>
              {spinning ? 'Đang quay...' : allDrawn ? 'Đã bốc xong' : `Bốc Hạt giống #${currentSeed}`}
            </button>
          </div>

          {/* Tab bar — rounded top, overflow-hidden for corner clipping */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('seeds')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors',
                  activeTab === 'seeds'
                    ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
                )}
              >
                <LayoutGrid className="w-4 h-4" />
                Hạt giống
              </button>
              <button
                onClick={() => setActiveTab('bracket')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors',
                  activeTab === 'bracket'
                    ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
                )}
              >
                <GitBranch className="w-4 h-4" />
                Bracket
              </button>
            </div>

            {/* Tab: Hạt giống — inside overflow-hidden, no scroll issues */}
            {activeTab === 'seeds' && (
              <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Array.from({ length: players.length }, (_, i) => {
                  const seed   = i + 1
                  const player = drawnSeeds[i]
                  const isLast = lastDraw?.seed === seed
                  return (
                    <div key={seed} className={cn(
                      'border rounded-xl p-2.5 transition-all duration-300',
                      player && isLast
                        ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-200 ring-offset-1'
                        : player
                          ? 'bg-gray-50 border-gray-200'
                          : seed === currentSeed && !allDrawn
                            ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-200 ring-offset-1'
                            : 'bg-white border-dashed border-gray-200',
                    )}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={cn(
                          'w-5 h-5 rounded-md text-xs font-black flex items-center justify-center shrink-0',
                          player ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-400',
                        )}>
                          {seed}
                        </span>
                        {player && <span className="text-xs text-green-600 ml-auto">✓</span>}
                      </div>
                      {player ? (
                        <div className="pl-0.5">
                          <p className={cn(
                            'text-xs font-bold truncate leading-tight',
                            isLast ? 'text-purple-800' : 'text-gray-700',
                          )}>
                            {player.name}
                          </p>
                          {player.club && (
                            <p className="text-xs text-gray-400 truncate leading-tight">{player.club}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-300 pl-0.5">—</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Bracket tab: empty state inside the border box */}
            {activeTab === 'bracket' && drawn === 0 && (
              <div className="py-12 text-center text-sm text-gray-400">
                Bắt đầu bốc thăm để xem bracket
              </div>
            )}
          </div>

          {/* Bracket panel — OUTSIDE overflow-hidden so horizontal scroll works correctly.
              overflow-x-auto on BracketView + overflow-y-auto here = both axes scroll. */}
          {activeTab === 'bracket' && drawn > 0 && (
            <div
              className="border border-gray-200 rounded-xl overflow-y-auto overflow-x-auto"
              style={{ maxHeight: '460px' }}
            >
              <BracketView
                matches={previewMatches}
                playerMap={previewPlayerMap}
                onMatchClick={() => {}}
                rowHeight={52}
              />
            </div>
          )}

          {/* Error */}
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
                  <p className="text-xs text-green-600 mt-0.5">{players.length} VĐV · Bracket {bracketSize}</p>
                </div>
              </div>
              <Button onClick={handleConfirm} loading={saving}>
                <CheckCircle className="w-4 h-4" />
                Xác nhận &amp; Tạo bracket
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
