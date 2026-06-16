import { useState, useCallback } from 'react'
import { X, Shuffle } from 'lucide-react'
import { getBracketSize, buildSeedPositions } from '@/lib/utils/bracketGenerator'
import { cn } from '@/lib/utils/cn'

/**
 * Drag-and-drop first-round bracket builder.
 *
 * Props:
 *  qualified      – Array of qualified players (with seed, player_id, player_name, group_number, qualified_as)
 *  onPairingsChange(pairings | null) – called whenever slots change;
 *                   pairings = [{p1Id, p2Id}, ...] when all slots filled, else null
 */
export default function BracketBuilder({ qualified, onPairingsChange }) {
  const bracketSize = getBracketSize(qualified.length)
  const matchCount  = bracketSize / 2

  const [slots, setSlots] = useState(() =>
    Array.from({ length: matchCount }, () => ({ p1: null, p2: null }))
  )
  // dragging: { player, from: 'pool' | { slotIdx, pos } }
  const [dragging,  setDragging]  = useState(null)
  // dragOver: 'pool' | { slotIdx, pos } | null
  const [dragOver,  setDragOver]  = useState(null)

  // Players not yet in any slot
  const pool = qualified.filter(p =>
    !slots.some(s =>
      s.p1?.player_id === p.player_id || s.p2?.player_id === p.player_id
    )
  )

  const pushUpdate = useCallback((newSlots) => {
    setSlots(newSlots)
    const filled = newSlots.every(s => s.p1 && s.p2)
    onPairingsChange(
      filled
        ? newSlots.map(s => ({ p1Id: s.p1.player_id, p2Id: s.p2.player_id }))
        : null
    )
  }, [onPairingsChange])

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragStart(player, from) {
    setDragging({ player, from })
  }

  function handleDrop(target) {
    if (!dragging) return
    const { player: dragPlayer, from } = dragging
    const newSlots = slots.map(s => ({ ...s }))

    // 1) Remove drag player from source slot (if from a slot)
    if (from !== 'pool') {
      const { slotIdx, pos } = from
      newSlots[slotIdx] = { ...newSlots[slotIdx], [pos]: null }
    }

    // 2) Place drag player in target
    if (target !== 'pool') {
      const { slotIdx, pos } = target
      const displaced = newSlots[slotIdx][pos]

      // Swap: displaced goes back to source slot
      if (displaced && from !== 'pool') {
        const { slotIdx: srcIdx, pos: srcPos } = from
        newSlots[srcIdx] = { ...newSlots[srcIdx], [srcPos]: displaced }
      }
      // If displaced came from pool → just leaves pool (handled automatically)

      newSlots[slotIdx] = { ...newSlots[slotIdx], [pos]: dragPlayer }
    }
    // If target === 'pool' → drag player simply returns to pool (source already cleared)

    pushUpdate(newSlots)
    setDragging(null)
    setDragOver(null)
  }

  function removeFromSlot(slotIdx, pos) {
    const newSlots = slots.map(s => ({ ...s }))
    newSlots[slotIdx] = { ...newSlots[slotIdx], [pos]: null }
    pushUpdate(newSlots)
  }

  // Fill slots using default seed positioning (same as auto mode)
  function autoFill() {
    const seeded  = [...qualified].sort((a, b) => a.seed - b.seed)
    const seedPos = buildSeedPositions(bracketSize)
    const newSlots = Array.from({ length: matchCount }, (_, i) => ({
      p1: seeded[seedPos[i * 2]]      ?? null,
      p2: seeded[seedPos[i * 2 + 1]] ?? null,
    }))
    pushUpdate(newSlots)
  }

  function reset() {
    const empty = Array.from({ length: matchCount }, () => ({ p1: null, p2: null }))
    pushUpdate(empty)
  }

  const filledCount = slots.filter(s => s.p1 && s.p2).length
  const isDragging  = dragging !== null

  return (
    <div className="space-y-4">

      {/* ── Pool ── */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver('pool') }}
        onDragLeave={() => setDragOver(null)}
        onDrop={e => { e.preventDefault(); handleDrop('pool') }}
        className={cn(
          'min-h-[72px] rounded-xl border-2 border-dashed p-3 transition-colors',
          dragOver === 'pool'
            ? 'border-red-400 bg-red-50'
            : isDragging
              ? 'border-gray-300 bg-gray-50'
              : 'border-gray-200 bg-gray-50',
        )}
      >
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
          Chưa xếp ({pool.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {pool.map(p => (
            <PlayerChip
              key={p.player_id}
              player={p}
              faded={isDragging && dragging.player.player_id === p.player_id}
              onDragStart={() => handleDragStart(p, 'pool')}
              onDragEnd={() => { setDragging(null); setDragOver(null) }}
            />
          ))}
          {pool.length === 0 && !isDragging && (
            <p className="text-xs text-gray-400 italic">Tất cả VĐV đã xếp cặp ✓</p>
          )}
        </div>
      </div>

      {/* ── Match slots ── */}
      <div className="space-y-2">
        {slots.map((slot, i) => (
          <div key={i} className="flex items-stretch gap-2">
            <div className="flex items-center w-16 shrink-0">
              <span className="text-xs font-bold text-gray-400">Trận {i + 1}</span>
            </div>

            <SlotZone
              player={slot.p1}
              isDropTarget={isTarget(dragOver, i, 'p1')}
              isDraggingThis={isDragging && dragging.from !== 'pool' && dragging.from.slotIdx === i && dragging.from.pos === 'p1'}
              onDragOver={e => { e.preventDefault(); setDragOver({ slotIdx: i, pos: 'p1' }) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => { e.preventDefault(); handleDrop({ slotIdx: i, pos: 'p1' }) }}
              onDragStart={slot.p1 ? () => handleDragStart(slot.p1, { slotIdx: i, pos: 'p1' }) : undefined}
              onDragEnd={() => { setDragging(null); setDragOver(null) }}
              onRemove={() => removeFromSlot(i, 'p1')}
            />

            <div className="flex items-center px-1 shrink-0">
              <span className="text-[10px] font-black text-gray-300">VS</span>
            </div>

            <SlotZone
              player={slot.p2}
              isDropTarget={isTarget(dragOver, i, 'p2')}
              isDraggingThis={isDragging && dragging.from !== 'pool' && dragging.from.slotIdx === i && dragging.from.pos === 'p2'}
              onDragOver={e => { e.preventDefault(); setDragOver({ slotIdx: i, pos: 'p2' }) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => { e.preventDefault(); handleDrop({ slotIdx: i, pos: 'p2' }) }}
              onDragStart={slot.p2 ? () => handleDragStart(slot.p2, { slotIdx: i, pos: 'p2' }) : undefined}
              onDragEnd={() => { setDragging(null); setDragOver(null) }}
              onRemove={() => removeFromSlot(i, 'p2')}
            />
          </div>
        ))}
      </div>

      {/* ── Footer controls ── */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          <span className={cn('font-bold', filledCount === matchCount ? 'text-green-600' : 'text-gray-600')}>
            {filledCount}/{matchCount}
          </span>{' '}
          cặp đã xếp
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={autoFill}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors px-2 py-1.5 rounded-lg hover:bg-blue-50"
          >
            <Shuffle className="w-3.5 h-3.5" />
            Điền theo seed
          </button>
          <button
            onClick={reset}
            className="text-xs font-semibold text-red-400 hover:text-red-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50"
          >
            Xóa hết
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isTarget(dragOver, slotIdx, pos) {
  return (
    dragOver !== null &&
    dragOver !== 'pool' &&
    dragOver.slotIdx === slotIdx &&
    dragOver.pos === pos
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PlayerChip({ player, faded, onDragStart, onDragEnd }) {
  const isFirst = player.qualified_as === 'Nhất bảng'
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-grab active:cursor-grabbing select-none transition-opacity',
        isFirst
          ? 'bg-amber-50 border-amber-200'
          : 'bg-blue-50 border-blue-200',
        faded && 'opacity-30',
      )}
    >
      <div>
        <p className="text-[9px] font-bold text-gray-400 leading-none mb-0.5">
          #{player.seed} · B{player.group_number}
        </p>
        <p className="text-xs font-semibold text-gray-800 leading-none">
          {player.player_name}
        </p>
      </div>
    </div>
  )
}

function SlotZone({ player, isDropTarget, isDraggingThis, onDragOver, onDragLeave, onDrop, onDragStart, onDragEnd, onRemove }) {
  if (player) {
    const isFirst = player.qualified_as === 'Nhất bảng'
    return (
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'flex-1 flex items-center justify-between px-3 py-2.5 rounded-xl border-2 cursor-grab active:cursor-grabbing select-none transition-all',
          isDraggingThis && 'opacity-40',
          isDropTarget
            ? 'border-blue-500 bg-blue-50 scale-[1.01]'
            : isFirst
              ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
              : 'bg-blue-50 border-blue-200 hover:border-blue-300',
        )}
      >
        <div className="min-w-0">
          <p className="text-[9px] font-bold text-gray-400 leading-none mb-0.5">
            #{player.seed} · {player.qualified_as === 'Nhất bảng' ? '🥇' : '🥈'} B{player.group_number}
          </p>
          <p className="text-sm font-bold text-gray-800 truncate">{player.player_name}</p>
        </div>
        <button
          onMouseDown={e => { e.stopPropagation(); onRemove() }}
          className="ml-2 p-0.5 rounded-md hover:bg-white/80 text-gray-300 hover:text-red-400 transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'flex-1 flex items-center justify-center px-3 py-3 rounded-xl border-2 border-dashed select-none transition-all text-xs',
        isDropTarget
          ? 'border-blue-500 bg-blue-50 text-blue-500 scale-[1.01]'
          : 'border-gray-200 bg-white text-gray-300',
      )}
    >
      + Kéo VĐV vào đây
    </div>
  )
}
