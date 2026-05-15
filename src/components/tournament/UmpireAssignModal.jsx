import { useState, useEffect } from 'react'
import { X, UserCheck, Loader2, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils/cn'

/**
 * Modal cho creator assign trọng tài vào một trận đấu.
 * Props:
 *   match        – match object (id, player1_name, player2_name, umpire_id)
 *   tournamentId – string
 *   onClose      – fn
 *   onAssigned   – fn(matchId, umpireId)
 */
export default function UmpireAssignModal({ match, tournamentId, onClose, onAssigned }) {
  const [umpires, setUmpires]   = useState([])
  const [workload, setWorkload] = useState({})  // umpireId → pending count
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [selected, setSelected] = useState(match.umpire_id ?? null)
  const [error, setError]       = useState(null)

  useEffect(() => {
    async function load() {
      // Get all umpires in this tournament
      const { data: tuData } = await supabase
        .from('tournament_umpires')
        .select('umpire_id, profiles!umpire_id(id, name, phone)')
        .eq('tournament_id', tournamentId)

      const list = (tuData || []).map(r => r.profiles).filter(Boolean)
      setUmpires(list)

      // Workload: pending matches per umpire in this tournament
      if (list.length > 0) {
        const { data: matches } = await supabase
          .from('matches')
          .select('umpire_id, status')
          .eq('tournament_id', tournamentId)
          .neq('status', 'completed')
          .in('umpire_id', list.map(u => u.id))

        const wl = {}
        for (const m of matches || []) {
          wl[m.umpire_id] = (wl[m.umpire_id] ?? 0) + 1
        }
        setWorkload(wl)
      }

      setLoading(false)
    }
    load()
  }, [tournamentId])

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('matches')
      .update({ umpire_id: selected })
      .eq('id', match.id)

    if (err) {
      setError(err.message)
      setSaving(false)
    } else {
      onAssigned?.(match.id, selected)
      onClose()
    }
  }

  const matchLabel = [match.player1_name, match.player2_name].filter(Boolean).join(' vs ') || `Trận #${match.id?.slice(-4)}`

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Phân công trọng tài</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{matchLabel}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            </div>
          ) : umpires.length === 0 ? (
            <div className="text-center py-8">
              <ShieldCheck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Chưa có trọng tài nào trong giải.</p>
              <p className="text-xs text-gray-400 mt-1">Thêm trọng tài trong tab "Trọng tài".</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Option: no umpire */}
              <button
                onClick={() => setSelected(null)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 text-left transition-colors',
                  selected === null
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <span className="text-xs text-gray-400">–</span>
                </div>
                <span className="text-sm text-gray-500 italic">Chưa phân công</span>
                {selected === null && (
                  <span className="ml-auto w-3.5 h-3.5 rounded-full bg-blue-500 shrink-0" />
                )}
              </button>

              {umpires.map(u => {
                const pending = workload[u.id] ?? 0
                const isAssigned = match.umpire_id === u.id
                return (
                  <button
                    key={u.id}
                    onClick={() => setSelected(u.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 text-left transition-colors',
                      selected === u.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-100',
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {u.name?.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                      <p className="text-xs text-gray-400">{u.phone}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {pending > 0 && (
                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                          {pending} trận
                        </span>
                      )}
                      {isAssigned && (
                        <UserCheck className="w-4 h-4 text-blue-400" />
                      )}
                      {selected === u.id && (
                        <span className="w-3.5 h-3.5 rounded-full bg-blue-500 shrink-0" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 mt-3">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3 border-t border-gray-100 pt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading || umpires.length === 0}
            className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Lưu
          </button>
        </div>
      </div>
    </div>
  )
}
