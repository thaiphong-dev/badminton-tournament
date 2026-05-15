import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useUmpireRealtime } from '@/lib/hooks/useUmpireRealtime'
import { ShieldCheck, ChevronRight, Loader2, LogOut, ChevronLeft, Trophy, Clock, CheckCircle2, Zap, AlertCircle } from 'lucide-react'


const STAGE_LABELS = {
  round_of_64: '1/32', round_of_32: '1/16', round_of_16: '1/8',
  quarter: 'Tứ kết', semi: 'Bán kết', final: 'Chung kết',
  third_place: 'Hạng 3', group: 'Vòng bảng',
}

const TOURNAMENT_STATUS = {
  setup: { label: 'Chuẩn bị', color: '#f59e0b' },
  group_stage: { label: 'Vòng bảng', color: '#3b82f6' },
  knockout: { label: 'Knockout', color: '#8b5cf6' },
  completed: { label: 'Đã kết thúc', color: '#10b981' },
}

export default function UmpirePage() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()

  const [tournaments, setTournaments]       = useState([])
  const [selectedTmt, setSelectedTmt]       = useState(null)
  const [matches, setMatches]               = useState([])
  const [playerMap, setPlayerMap]           = useState({})
  const [loadingTmt, setLoadingTmt]         = useState(true)
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [error, setError]                   = useState(null)

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

  // Subscribe realtime: incoming call overlay + live match status updates
  useUmpireRealtime(profile?.id, matches, playerMap, setMatches)

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  const liveCount = matches.filter(m => m.status === 'active').length
  const pendingCount = matches.filter(m => m.status === 'pending').length

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f172a' }}>

      {/* Header */}
      <div style={{ background: '#111827', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedTmt && (
              <button
                onClick={() => setSelectedTmt(null)}
                className="p-1 rounded-lg transition-colors"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.2)' }}>
              <ShieldCheck className="w-4 h-4" style={{ color: '#22d3ee' }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
                {selectedTmt ? selectedTmt.name : 'Umpire Portal'}
              </p>
              {profile && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{profile.name}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors active:bg-white/5"
            style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Đăng xuất
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-6">

        {/* ── Tournament list ── */}
        {!selectedTmt && (
          <div>
            <div className="mb-6">
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>Giải đấu của bạn</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Chọn giải để xem trận được phân công</p>
            </div>

            {error && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <AlertCircle className="w-10 h-10" style={{ color: '#f87171' }} />
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>{error}</p>
                <button
                  onClick={retryLoadTournaments}
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ background: 'rgba(34,211,238,0.12)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.2)' }}
                >
                  Thử lại
                </button>
              </div>
            )}

            {!error && loadingTmt ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#22d3ee' }} />
              </div>
            ) : !error && tournaments.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Trophy className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.2)' }} />
                </div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>Chưa được thêm vào giải đấu nào</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>Ban tổ chức sẽ thêm bạn và cập nhật tại đây</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tournaments.map(t => {
                  const tStatus = TOURNAMENT_STATUS[t.status] ?? { label: t.status, color: '#6b7280' }
                  return (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTmt(t); setLoadingMatches(true) }}
                      className="w-full flex items-center justify-between rounded-2xl px-4 py-4 text-left transition-all active:scale-[0.99]"
                      style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.15)' }}>
                          <Trophy className="w-4 h-4" style={{ color: '#22d3ee' }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>{t.name}</p>
                          <span style={{ fontSize: 11, fontWeight: 600, color: tStatus.color }}>{tStatus.label}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }} />
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
            {/* Summary bar */}
            {!loadingMatches && matches.length > 0 && (
              <div className="flex items-center gap-3 mb-5">
                {liveCount > 0 && (
                  <div className="flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)' }}>
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22d3ee' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#22d3ee' }}>{liveCount} đang đấu</span>
                  </div>
                )}
                {pendingCount > 0 && (
                  <div className="flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <Clock className="w-3 h-3" style={{ color: '#818cf8' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#818cf8' }}>{pendingCount} chờ</span>
                  </div>
                )}
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>{matches.length} trận</span>
              </div>
            )}

            {loadingMatches ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#22d3ee' }} />
              </div>
            ) : matches.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <ShieldCheck className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.2)' }} />
                </div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>Chưa có trận nào được phân công</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>Ban tổ chức sẽ phân công và cập nhật tại đây</p>
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

// ── Match card ────────────────────────────────────────────────────────────────

function MatchCard({ match, playerMap, onClick }) {
  const p1   = playerMap[match.player1_id]
  const p2   = playerMap[match.player2_id]
  const done = match.status === 'completed'
  const live = match.status === 'active'

  const borderColor = live ? 'rgba(34,211,238,0.35)' : done ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.09)'
  const bgColor     = live ? 'rgba(34,211,238,0.05)' : '#1e293b'

  return (
    <button
      onClick={done ? undefined : onClick}
      disabled={done}
      className="w-full text-left rounded-2xl px-4 py-4 transition-all active:scale-[0.99]"
      style={{ background: bgColor, border: `1px solid ${borderColor}`, opacity: done ? 0.55 : 1 }}
    >
      {/* Match header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {STAGE_LABELS[match.stage] ?? match.stage}
          </span>
          {match.match_number && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>· #{match.match_number}</span>
          )}
        </div>
        {live && (
          <div className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5" style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.25)' }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22d3ee' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#22d3ee' }}>LIVE</span>
          </div>
        )}
        {done && (
          <div className="flex items-center gap-1" style={{ color: '#34d399' }}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span style={{ fontSize: 11, fontWeight: 600 }}>Xong</span>
          </div>
        )}
        {!done && !live && (
          <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <Clock className="w-3 h-3" />
            <span style={{ fontSize: 11 }}>Chờ bắt đầu</span>
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
          color="cyan"
        />
        <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.18)', fontWeight: 500 }}>vs</div>
        <PlayerMatchRow
          name={p2?.name}
          scores={match.player2_scores}
          opScores={match.player1_scores}
          isWinner={done && match.winner_id === match.player2_id}
          liveScore={live ? match.live_score_p2 : null}
          color="amber"
        />
      </div>

      {/* CTA */}
      {!done && !live && (
        <div className="flex items-center justify-center gap-1.5 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Zap className="w-3.5 h-3.5" style={{ color: '#22d3ee' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#22d3ee' }}>Bắt đầu ghi điểm</span>
        </div>
      )}
    </button>
  )
}

function PlayerMatchRow({ name, scores, opScores, isWinner, liveScore, color }) {
  const scoreStr = scores?.length > 0
    ? scores.map((s, i) => `${s}-${opScores?.[i] ?? 0}`).join('  ')
    : null
  const nameColor = isWinner
    ? (color === 'cyan' ? '#22d3ee' : '#fbbf24')
    : 'rgba(255,255,255,0.7)'

  return (
    <div
      className="flex items-center justify-between rounded-xl px-2.5 py-1.5"
      style={{ background: isWinner ? (color === 'cyan' ? 'rgba(34,211,238,0.08)' : 'rgba(251,191,36,0.08)') : 'transparent' }}
    >
      <span style={{ fontSize: 14, fontWeight: isWinner ? 700 : 500, color: nameColor, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name ?? 'TBD'}
      </span>
      {liveScore !== null && (
        <span style={{ fontSize: 24, fontWeight: 800, fontFamily: 'monospace', color: color === 'cyan' ? '#22d3ee' : '#fbbf24' }}>
          {liveScore}
        </span>
      )}
      {scoreStr && liveScore === null && (
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', fontWeight: 500 }}>{scoreStr}</span>
      )}
    </div>
  )
}
