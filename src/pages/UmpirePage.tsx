import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useUmpireRealtime } from '@/lib/hooks/useUmpireRealtime'
import { ShieldCheck, ChevronRight, Loader2, LogOut, ChevronLeft, Trophy, Clock, CheckCircle2, Zap, AlertCircle, History } from 'lucide-react'
import PushSubscribeButton from '@/components/ui/PushSubscribeButton'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils/cn'

const STAGE_LABELS = {
  round_of_64: '1/32', round_of_32: '1/16', round_of_16: '1/8',
  quarter: 'Tứ kết', semi: 'Bán kết', final: 'Chung kết',
  third_place: 'Hạng 3', group: 'Vòng bảng',
}

const TOURNAMENT_STATUS = {
  setup:        { label: 'Chuẩn bị',   color: 'text-amber-600',  bg: 'bg-amber-50'  },
  group_stage:  { label: 'Vòng bảng',  color: 'text-blue-600',   bg: 'bg-blue-50'   },
  knockout:     { label: 'Knockout',   color: 'text-purple-600', bg: 'bg-purple-50' },
  completed:    { label: 'Đã kết thúc', color: 'text-green-600', bg: 'bg-green-50'  },
}

export default function UmpirePage() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const { t } = useI18n()

  const [view, setView]                     = useState('assigned')
  const [tournaments, setTournaments]       = useState([])
  const [selectedTmt, setSelectedTmt]       = useState(null)
  const [matches, setMatches]               = useState([])
  const [playerMap, setPlayerMap]           = useState({})
  const [loadingTmt, setLoadingTmt]         = useState(true)
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [error, setError]                   = useState(null)
  const [history, setHistory]               = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  function retryLoadTournaments() {
    setError(null)
    setLoadingTmt(true)
    supabase
      .from('tournament_umpires')
      .select('tournament_id, tournaments(id, name, status)')
      .eq('umpire_id', profile.id)
      .then(({ data, error: err }) => {
        if (err) { setError('Không thể tải dữ liệu. Vui lòng thử lại.'); setLoadingTmt(false); return }
        const list = (data || [])
          .map(r => r.tournaments)
          .filter(Boolean)
          .filter(t => t.status !== 'archived')
        setTournaments(list)
        setLoadingTmt(false)
      })
      .catch(() => { setError('Lỗi kết nối. Vui lòng thử lại.'); setLoadingTmt(false) })
  }

  useEffect(() => {
    if (!profile) return
    retryLoadTournaments()
  }, [profile]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedTmt || !profile) return
    setError(null)
    supabase
      .from('matches')
      .select('id, stage, match_number, status, player1_id, player2_id, player1_scores, player2_scores, winner_id, live_score_p1, live_score_p2, current_set')
      .eq('tournament_id', selectedTmt.id)
      .eq('umpire_id', profile.id)
      .order('match_number', { ascending: true })
      .then(async ({ data: mList, error: err }) => {
        if (err) { setError('Không thể tải trận đấu. Vui lòng thử lại.'); setLoadingMatches(false); return }
        if (!mList?.length) { setMatches([]); setLoadingMatches(false); return }
        const pIds = [...new Set(mList.flatMap(m => [m.player1_id, m.player2_id]).filter(Boolean))]
        const { data: pList } = await supabase.from('players').select('id, name').in('id', pIds)
        setPlayerMap(Object.fromEntries((pList || []).map(p => [p.id, p])))
        setMatches(mList)
        setLoadingMatches(false)
      })
      .catch(() => { setError('Lỗi kết nối. Vui lòng thử lại.'); setLoadingMatches(false) })
  }, [selectedTmt, profile])

  useEffect(() => {
    if (!profile?.id || view !== 'history') return
    setLoadingHistory(true)
    supabase
      .from('matches')
      .select(`
        id, stage, match_number, status, player1_scores, player2_scores, winner_id, updated_at,
        tournaments(id, name),
        p1:players!player1_id(id, name),
        p2:players!player2_id(id, name)
      `)
      .eq('umpire_id', profile.id)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(100)
      .then(async ({ data, error: err }) => {
        if (err || !data?.length) { setHistory(data || []); setLoadingHistory(false); return }
        const matchIds = data.map(m => m.id)
        const { data: evals } = await supabase
          .from('umpire_evaluations')
          .select('match_id, rating, comment')
          .in('match_id', matchIds)
        const evalMap = Object.fromEntries((evals ?? []).map(e => [e.match_id, e]))
        setHistory(data.map(m => ({ ...m, evaluation: evalMap[m.id] ?? null })))
        setLoadingHistory(false)
      })
  }, [profile?.id, view])

  useUmpireRealtime(profile?.id, matches, playerMap, setMatches)

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  const liveCount    = matches.filter(m => m.status === 'active').length
  const pendingCount = matches.filter(m => m.status === 'pending').length
  const urgentMatch  = matches.find(m => m.status === 'calling' || m.status === 'active')

  return (
    <div className="min-h-screen flex flex-col bg-surface">

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedTmt && (
              <button
                onClick={() => setSelectedTmt(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">
                {selectedTmt ? selectedTmt.name : 'Umpire Portal'}
              </p>
              {profile && (
                <p className="text-xs text-gray-400">{profile.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PushSubscribeButton userId={profile?.id} className="text-gray-400 hover:text-gray-600" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Đăng xuất
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-6">

        {/* ── Urgent match banner ── */}
        {urgentMatch && (
          <button
            onClick={() => navigate(`/umpire/match/${urgentMatch.id}`)}
            className={cn(
              'w-full flex items-center gap-3 rounded-2xl px-4 py-3 mb-4 text-left transition-all active:scale-[0.99] animate-pulse border',
              urgentMatch.status === 'calling'
                ? 'bg-amber-50 border-amber-300'
                : 'bg-blue-50 border-blue-300',
            )}
          >
            <span className="text-xl">
              {urgentMatch.status === 'calling' ? '📞' : '🏸'}
            </span>
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-bold', urgentMatch.status === 'calling' ? 'text-amber-700' : 'text-blue-700')}>
                {urgentMatch.status === 'calling' ? 'BTC đang gọi bạn vào sân!' : 'Trận đang diễn ra — tiếp tục điều hành'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {playerMap[urgentMatch.player1_id]?.name ?? '?'} vs {playerMap[urgentMatch.player2_id]?.name ?? '?'}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />
          </button>
        )}

        {/* ── View toggle ── */}
        {!selectedTmt && (
          <div className="flex mb-6 rounded-xl overflow-hidden border border-gray-200 bg-white">
            <button
              onClick={() => setView('assigned')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors',
                view === 'assigned' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600',
              )}
            >
              <ShieldCheck className="w-4 h-4" />
              {t('umpirePage.assigned')}
            </button>
            <button
              onClick={() => setView('history')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors border-l border-gray-200',
                view === 'history' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600',
              )}
            >
              <History className="w-4 h-4" />
              {t('umpirePage.history')}
            </button>
          </div>
        )}

        {/* ── History view ── */}
        {!selectedTmt && view === 'history' && (
          <div>
            <h2 className="text-lg font-extrabold text-gray-900 mb-4">{t('umpirePage.history')}</h2>
            {loadingHistory ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-16">
                <History className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-400">Chưa có trận nào đã điều hành</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {history.map(m => {
                  const p1Won = m.winner_id === m.p1?.id
                  const p2Won = m.winner_id === m.p2?.id
                  const date  = m.updated_at
                    ? new Date(m.updated_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : ''
                  const scoreStr = m.player1_scores?.length
                    ? m.player1_scores.map((s, i) => `${s}–${(m.player2_scores ?? [])[i] ?? 0}`).join('  ')
                    : null
                  return (
                    <div key={m.id} className="rounded-2xl px-4 py-4 bg-white border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {m.tournaments?.name ?? '—'}
                        </span>
                        <span className="text-xs text-gray-400">{date}</span>
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">
                          {STAGE_LABELS[m.stage] ?? m.stage}{m.match_number ? ` · #${m.match_number}` : ''}
                        </span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      </div>
                      <div className="space-y-1 mt-2">
                        <div className="flex items-center justify-between">
                          <span className={cn('text-sm', p1Won ? 'font-bold text-blue-600' : 'text-gray-600')}>
                            {m.p1?.name ?? 'TBD'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={cn('text-sm', p2Won ? 'font-bold text-amber-600' : 'text-gray-600')}>
                            {m.p2?.name ?? 'TBD'}
                          </span>
                          {scoreStr && (
                            <span className="text-xs font-mono text-gray-400">{scoreStr}</span>
                          )}
                        </div>
                      </div>
                      {m.evaluation && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-amber-400">
                              {'★'.repeat(m.evaluation.rating)}{'☆'.repeat(5 - m.evaluation.rating)}
                            </span>
                            {m.evaluation.comment && (
                              <span className="text-xs text-gray-400 italic">"{m.evaluation.comment}"</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tournament list ── */}
        {!selectedTmt && view === 'assigned' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-extrabold text-gray-900 mb-1">Giải đấu của bạn</h2>
              <p className="text-sm text-gray-400">Chọn giải để xem trận được phân công</p>
            </div>

            {error && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <AlertCircle className="w-10 h-10 text-red-400" />
                <p className="text-sm text-gray-500 text-center">{error}</p>
                <button
                  onClick={retryLoadTournaments}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  Thử lại
                </button>
              </div>
            )}

            {!error && loadingTmt ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : !error && tournaments.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-sm text-gray-400 mb-1">Chưa được thêm vào giải đấu nào</p>
                <p className="text-xs text-gray-300">Ban tổ chức sẽ thêm bạn và cập nhật tại đây</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tournaments.map(t => {
                  const tStatus = TOURNAMENT_STATUS[t.status] ?? { label: t.status, color: 'text-gray-500', bg: 'bg-gray-50' }
                  return (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTmt(t); setLoadingMatches(true) }}
                      className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-4 py-4 text-left hover:border-blue-200 hover:bg-blue-50/30 transition-all active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                          <Trophy className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                          <span className={cn('text-xs font-semibold', tStatus.color)}>{tStatus.label}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 shrink-0 text-gray-300" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Match list ── */}
        {selectedTmt && (
          <div>
            {!loadingMatches && matches.length > 0 && (
              <div className="flex items-center gap-3 mb-5">
                {liveCount > 0 && (
                  <div className="flex items-center gap-1.5 rounded-full px-3 py-1 bg-green-50 border border-green-200">
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-green-500" />
                    <span className="text-xs font-semibold text-green-600">{liveCount} đang đấu</span>
                  </div>
                )}
                {pendingCount > 0 && (
                  <div className="flex items-center gap-1.5 rounded-full px-3 py-1 bg-purple-50 border border-purple-200">
                    <Clock className="w-3 h-3 text-purple-500" />
                    <span className="text-xs font-semibold text-purple-600">{pendingCount} chờ</span>
                  </div>
                )}
                <span className="text-xs text-gray-400 ml-auto">{matches.length} trận</span>
              </div>
            )}

            {loadingMatches ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : matches.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-sm text-gray-400 mb-1">Chưa có trận nào được phân công</p>
                <p className="text-xs text-gray-300">Ban tổ chức sẽ phân công và cập nhật tại đây</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {matches.map(m => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    playerMap={playerMap}
                    onClick={() => navigate(`/umpire/match/${m.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function MatchCard({ match, playerMap, onClick }) {
  const p1   = playerMap[match.player1_id]
  const p2   = playerMap[match.player2_id]
  const done = match.status === 'completed'
  const live = match.status === 'active'

  return (
    <button
      onClick={done ? undefined : onClick}
      disabled={done}
      className={cn(
        'w-full text-left bg-white rounded-2xl px-4 py-4 border transition-all active:scale-[0.99]',
        live ? 'border-green-400 shadow-sm' : done ? 'border-gray-200 opacity-60' : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50/20',
      )}
    >
      {/* Match header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {STAGE_LABELS[match.stage] ?? match.stage}
          </span>
          {match.match_number && (
            <span className="text-xs text-gray-300">· #{match.match_number}</span>
          )}
        </div>
        {live && (
          <div className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 bg-green-50 border border-green-300">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-green-500" />
            <span className="text-xs font-bold text-green-600">LIVE</span>
          </div>
        )}
        {done && (
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">Xong</span>
          </div>
        )}
        {!done && !live && (
          <div className="flex items-center gap-1 text-gray-400">
            <Clock className="w-3 h-3" />
            <span className="text-xs">Chờ bắt đầu</span>
          </div>
        )}
      </div>

      {/* Players */}
      <div className="space-y-1.5">
        <PlayerMatchRow
          name={p1?.name}
          scores={match.player1_scores}
          opScores={match.player2_scores}
          isWinner={done && match.winner_id === match.player1_id}
          liveScore={live ? match.live_score_p1 : null}
          color="blue"
        />
        <div className="text-center text-xs text-gray-300 font-medium">vs</div>
        <PlayerMatchRow
          name={p2?.name}
          scores={match.player2_scores}
          opScores={match.player1_scores}
          isWinner={done && match.winner_id === match.player2_id}
          liveScore={live ? match.live_score_p2 : null}
          color="amber"
        />
      </div>

      {!done && !live && (
        <div className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
          <Zap className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs font-semibold text-blue-600">Bắt đầu ghi điểm</span>
        </div>
      )}
    </button>
  )
}

function PlayerMatchRow({ name, scores, opScores, isWinner, liveScore, color }) {
  const scoreStr = scores?.length > 0
    ? scores.map((s, i) => `${s}-${opScores?.[i] ?? 0}`).join('  ')
    : null
  const nameCls = isWinner
    ? (color === 'blue' ? 'font-bold text-blue-600' : 'font-bold text-amber-600')
    : 'text-gray-600'
  const scoreCls = color === 'blue' ? 'text-blue-600' : 'text-amber-500'
  const bgCls = isWinner
    ? (color === 'blue' ? 'bg-blue-50' : 'bg-amber-50')
    : ''

  return (
    <div className={cn('flex items-center justify-between rounded-xl px-2.5 py-1.5', bgCls)}>
      <span className={cn('text-sm flex-1 min-w-0 truncate', nameCls)}>
        {name ?? 'TBD'}
      </span>
      {liveScore !== null && (
        <span className={cn('text-2xl font-black font-mono ml-2 shrink-0', scoreCls)}>
          {liveScore}
        </span>
      )}
      {scoreStr && liveScore === null && (
        <span className="text-xs text-gray-400 font-mono">{scoreStr}</span>
      )}
    </div>
  )
}
