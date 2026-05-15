import { useState, useEffect, useCallback } from 'react'
import { Search, UserPlus, Trash2, Loader2, ShieldCheck, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils/cn'

export default function UmpireManagement({ tournamentId }) {
  const [umpires, setUmpires]       = useState([])   // current tournament umpires
  const [workload, setWorkload]     = useState({})    // umpireId → { total, pending }
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState([])
  const [searching, setSearching]   = useState(false)
  const [loading, setLoading]       = useState(true)
  const [addingId, setAddingId]     = useState(null)
  const [removingId, setRemovingId] = useState(null)
  const [error, setError]           = useState(null)

  const fetchUmpires = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('tournament_umpires')
      .select('umpire_id, profiles!umpire_id(id, name, phone)')
      .eq('tournament_id', tournamentId)

    if (err) { setError(err.message); setLoading(false); return }

    const list = (data || []).map(row => row.profiles).filter(Boolean)
    setUmpires(list)

    // fetch match workload for each umpire in this tournament
    if (list.length > 0) {
      const ids = list.map(u => u.id)
      const { data: matches } = await supabase
        .from('matches')
        .select('umpire_id, status')
        .eq('tournament_id', tournamentId)
        .in('umpire_id', ids)

      const wl = {}
      for (const m of matches || []) {
        if (!wl[m.umpire_id]) wl[m.umpire_id] = { total: 0, pending: 0 }
        wl[m.umpire_id].total++
        if (m.status !== 'completed') wl[m.umpire_id].pending++
      }
      setWorkload(wl)
    } else {
      setWorkload({})
    }

    setLoading(false)
  }, [tournamentId])

  useEffect(() => { fetchUmpires() }, [fetchUmpires]) // eslint-disable-line react-hooks/set-state-in-effect

  // Search umpires by name or phone
  useEffect(() => {
    if (!query.trim()) { setResults([]); return } // eslint-disable-line react-hooks/set-state-in-effect

    const timer = setTimeout(async () => {
      setSearching(true)
      const q = query.trim()
      const { data } = await supabase
        .from('profiles')
        .select('id, name, phone')
        .eq('role', 'umpire')
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(8)

      const currentIds = new Set(umpires.map(u => u.id))
      setResults((data || []).filter(u => !currentIds.has(u.id)))
      setSearching(false)
    }, 350)

    return () => clearTimeout(timer)
  }, [query, umpires])

  async function handleAdd(umpire) {
    setAddingId(umpire.id)
    setError(null)
    const { error: err } = await supabase
      .from('tournament_umpires')
      .insert({ tournament_id: tournamentId, umpire_id: umpire.id })

    if (err) {
      setError(err.message)
    } else {
      setQuery('')
      setResults([])
      await fetchUmpires()
    }
    setAddingId(null)
  }

  async function handleRemove(umpireId) {
    setRemovingId(umpireId)
    setError(null)
    const { error: err } = await supabase
      .from('tournament_umpires')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('umpire_id', umpireId)

    if (err) {
      setError(err.message)
    } else {
      await fetchUmpires()
    }
    setRemovingId(null)
  }

  return (
    <div className="space-y-6">
      {/* Search box */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Thêm trọng tài</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc số điện thoại..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
          )}
        </div>

        {/* Search results */}
        {results.length > 0 && (
          <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {results.map(u => (
              <div
                key={u.id}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                  <p className="text-xs text-gray-500">{u.phone}</p>
                </div>
                <button
                  onClick={() => handleAdd(u)}
                  disabled={addingId === u.id}
                  className="ml-3 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors shrink-0"
                >
                  {addingId === u.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <UserPlus className="w-3.5 h-3.5" />
                  }
                  Thêm
                </button>
              </div>
            ))}
          </div>
        )}

        {query.trim() && !searching && results.length === 0 && (
          <p className="mt-2 text-sm text-gray-400 text-center">Không tìm thấy trọng tài nào.</p>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Current umpires list */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">
          Trọng tài trong giải ({umpires.length})
        </p>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          </div>
        ) : umpires.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl">
            <ShieldCheck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Chưa có trọng tài nào trong giải đấu này.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {umpires.map(u => {
              const wl = workload[u.id]
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {u.name?.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    {wl && (
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        wl.pending > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500',
                      )}>
                        {wl.pending > 0 ? `${wl.pending} trận chờ` : `${wl.total} trận`}
                      </span>
                    )}
                    <button
                      onClick={() => handleRemove(u.id)}
                      disabled={removingId === u.id}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa khỏi giải"
                    >
                      {removingId === u.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />
                      }
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
