import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export default function SetBreakScreen({ state, player1, player2, onContinue }) {
  const [selectedServerTeam,   setSelectedServerTeam]   = useState(state.setJustWon ?? null)
  const [selectedServerPlayer, setSelectedServerPlayer] = useState(null)
  const [selectedReceiverPlayer, setSelectedReceiverPlayer] = useState(null)
  const [countdown, setCountdown] = useState(120)

  const { completedSets, setJustWon, isDoubles } = state
  const setWinner = setJustWon === 'p1' ? player1 : player2
  const p1Sets    = completedSets.filter(s => s.p1 > s.p2).length
  const p2Sets    = completedSets.filter(s => s.p2 > s.p1).length

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

  const autoDataRef = useRef(null)
  useLayoutEffect(() => {
    autoDataRef.current = { isReady, selectedServerTeam, selectedServerPlayer, selectedReceiverPlayer, isDoubles, teams, onContinue }
  })

  useEffect(() => {
    if (countdown !== 0) return
    const d = autoDataRef.current
    if (!d?.isReady) return
    const team      = d.teams.find(t => t.id === d.selectedServerTeam)
    const receiving = d.selectedServerTeam === 'p1' ? d.teams[1] : d.teams[0]
    d.onContinue(
      d.selectedServerTeam,
      d.isDoubles ? d.selectedServerPlayer : team.name,
      d.isDoubles ? d.selectedReceiverPlayer : receiving.name,
    )
  }, [countdown]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 bg-surface flex flex-col overflow-y-auto">

      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 text-center">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Kết thúc ván {completedSets.length}
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 py-6 gap-5 max-w-sm mx-auto w-full">

        {/* Winner announcement */}
        <div className="w-full bg-white border border-gray-200 rounded-2xl p-5 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-blue-50 border-2 border-blue-400 flex items-center justify-center mx-auto mb-3">
            <span className="text-blue-600 font-black text-2xl">
              {setWinner?.name?.[0]?.toUpperCase()}
            </span>
          </div>
          <p className="text-lg font-extrabold text-gray-900 mb-1">{setWinner?.name} THẮNG</p>
          <p className="text-sm font-semibold text-blue-600">Tỉ số hiện tại: {p1Sets} – {p2Sets}</p>

          {/* Set breakdown */}
          <div className="flex items-center justify-center gap-2 mt-3">
            {completedSets.map((s, i) => (
              <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1">
                <span className="text-sm font-bold text-gray-700">{s.p1} – {s.p2}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Interval timer */}
        <div className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-center shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Nghỉ giải lao 2 phút</p>
          <div className="flex items-center justify-center gap-3">
            <Clock size={28} className={countdown <= 10 ? 'text-red-500' : 'text-blue-500'} />
            <span className={cn('text-5xl font-black font-mono', countdown <= 10 ? 'text-red-500' : 'text-gray-900')}>
              {mins}:{secs}
            </span>
          </div>
        </div>

        {/* Server selection */}
        <div className="w-full space-y-4">
          <SelectionBlock
            label="Bước 1: Đội nào giao cầu tiếp theo?"
            options={teams}
            selected={selectedServerTeam}
            onSelect={(id) => { setSelectedServerTeam(id); setSelectedServerPlayer(null); setSelectedReceiverPlayer(null) }}
          />

          {isDoubles && selectedServerTeam && (
            <SelectionBlock
              label="Bước 2: Ai là người giao cầu?"
              options={teams.find(t => t.id === selectedServerTeam).players.filter(Boolean).map(p => ({ id: p, name: p }))}
              selected={selectedServerPlayer}
              onSelect={setSelectedServerPlayer}
            />
          )}

          {isDoubles && selectedServerTeam && selectedServerPlayer && (
            <SelectionBlock
              label="Bước 3: Ai là người nhận cầu?"
              options={receivingTeam.players.filter(Boolean).map(p => ({ id: p, name: p }))}
              selected={selectedReceiverPlayer}
              onSelect={setSelectedReceiverPlayer}
            />
          )}
        </div>

        {/* CTA */}
        <div className="w-full pt-2 pb-6">
          <button
            disabled={!isReady}
            onClick={() => onContinue(
              selectedServerTeam,
              isDoubles ? selectedServerPlayer : teams.find(t => t.id === selectedServerTeam).name,
              isDoubles ? selectedReceiverPlayer : receivingTeam.name,
            )}
            className={cn(
              'w-full py-5 rounded-2xl font-extrabold text-lg transition-all',
              isReady
                ? 'bg-amber-400 text-gray-900 shadow-lg shadow-amber-100 active:scale-[0.98]'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed',
            )}
          >
            Bắt đầu ván {completedSets.length + 1}
          </button>
        </div>
      </div>
    </div>
  )
}

function SelectionBlock({ label, options, selected, onSelect }) {
  return (
    <div>
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
