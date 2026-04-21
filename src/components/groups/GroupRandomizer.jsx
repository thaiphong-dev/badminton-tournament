import { useState, useRef } from 'react'
import { Shuffle, RefreshCw, CheckCircle, AlertCircle, ChevronRight, Users, ImageDown } from 'lucide-react'
import { randomizeGroups } from '@/lib/utils/groupRandomizer'
import { saveGroupsAndMatches } from '@/lib/utils/matchScheduler'
import { buildClubColorMap } from '@/components/groups/GroupCard'
import GroupCard from '@/components/groups/GroupCard'
import Button from '@/components/ui/Button'
import { downloadElementAsImage } from '@/lib/utils/downloadImage'

// Phase: idle → preview → saving → done
export default function GroupRandomizer({ tournament, players, onConfirmed }) {
  const [phase, setPhase]       = useState('idle')  // 'idle' | 'preview' | 'saving'
  const [groups, setGroups]     = useState([])
  const [error, setError]       = useState(null)
  const [downloading, setDownloading] = useState(false)
  const gridRef = useRef(null)

  const numGroups    = tournament.num_groups
  const clubColorMap = buildClubColorMap(players)

  async function handleDownload() {
    if (!gridRef.current) return
    setDownloading(true)
    try {
      const safeName = tournament.name.replace(/[\\/:*?"<>|]/g, '_')
      await downloadElementAsImage(gridRef.current, `${safeName}_bang_dau.png`)
    } finally {
      setDownloading(false)
    }
  }

  // ── Stats for preview ───────────────────────────────────────────────────────
  const totalMatches = groups.reduce((sum, g) => {
    const n = g.length
    return sum + (n * (n - 1)) / 2  // C(n,2)
  }, 0)

  // ── Randomize ───────────────────────────────────────────────────────────────
  function handleRandomize() {
    setError(null)
    if (players.length < numGroups) {
      setError(`Cần ít nhất ${numGroups} VĐV để tạo ${numGroups} bảng (hiện có ${players.length}).`)
      return
    }
    const result = randomizeGroups(players, numGroups)
    setGroups(result)
    setPhase('preview')
  }

  // ── Confirm → save to DB ────────────────────────────────────────────────────
  async function handleConfirm() {
    setPhase('saving')
    setError(null)
    try {
      await saveGroupsAndMatches(groups, tournament.id)
      onConfirmed()
    } catch (err) {
      console.error(err)
      setError(`Lỗi khi lưu: ${err.message}`)
      setPhase('preview')
    }
  }

  // ── Idle state ──────────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shuffle className="w-8 h-8 text-blue-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Phân bảng tự động</h3>
        <p className="text-gray-500 text-sm mb-1">
          {players.length} VĐV → {numGroups} bảng · Đảm bảo không trùng CLB
        </p>
        <p className="text-gray-400 text-xs mb-8">
          VĐV "Tự do" có thể cùng bảng với nhau
        </p>

        {error && (
          <div className="flex items-center justify-center gap-2 mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 max-w-md mx-auto">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <Button onClick={handleRandomize} size="lg">
          <Shuffle className="w-5 h-5" />
          Random {numGroups} bảng
        </Button>
      </div>
    )
  }

  // ── Preview + Confirm ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-5 py-4">
        <div className="flex items-center gap-6 text-sm">
          <span className="flex items-center gap-1.5 text-blue-700 font-medium">
            <Users className="w-4 h-4" />
            {players.length} VĐV
          </span>
          <span className="text-blue-600">
            {numGroups} bảng · {totalMatches} trận vòng bảng
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            onClick={handleDownload}
            loading={downloading}
            disabled={phase === 'saving'}
            title="Tải ảnh bảng đấu"
          >
            <ImageDown className="w-4 h-4" />
            Tải ảnh
          </Button>
          <Button
            variant="secondary"
            onClick={handleRandomize}
            disabled={phase === 'saving'}
          >
            <RefreshCw className="w-4 h-4" />
            Random lại
          </Button>
          <Button
            onClick={handleConfirm}
            loading={phase === 'saving'}
            disabled={phase === 'saving'}
          >
            <CheckCircle className="w-4 h-4" />
            Xác nhận &amp; Tạo lịch
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Group cards grid – wrapped in ref for image download */}
      <div ref={gridRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3  bg-white p-2 rounded-xl">
        {groups.map((group, idx) => (
          <GroupCard
            key={idx}
            group={group}
            groupIndex={idx}
            clubColorMap={clubColorMap}
          />
        ))}
      </div>

      {/* Bottom confirm (convenience) */}
      <div className="flex justify-end pt-2 border-t border-gray-100">
        <Button
          onClick={handleConfirm}
          loading={phase === 'saving'}
          disabled={phase === 'saving'}
          size="lg"
        >
          <CheckCircle className="w-5 h-5" />
          Xác nhận &amp; Tạo lịch thi đấu
        </Button>
      </div>
    </div>
  )
}
