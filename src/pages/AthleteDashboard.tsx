import { useState, useEffect, useRef, startTransition } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, User, Loader2, CheckCircle2, Clock, ChevronRight, Save, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { DISCIPLINE_LABELS, DISCIPLINE_ICONS } from '@/lib/constants'
import { cn } from '@/lib/utils/cn'
import { showToast } from '@/lib/hooks/useApiError'
import PushSubscribeButton from '@/components/ui/PushSubscribeButton'
import { useI18n } from '@/i18n'

// ── Module-level constants ────────────────────────────────────────────────────

const TABS = [
  { id: 'mine',    label: 'Đăng ký của tôi', icon: CalendarDays },
  { id: 'matches', label: 'Lịch thi đấu',    icon: Clock },
  { id: 'profile', label: 'Hồ sơ',           icon: User },
]

const STATUS_BADGE = {
  pending:  { label: 'Chờ duyệt', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Đã duyệt',  color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Từ chối',   color: 'bg-red-100 text-red-700' },
}

const STAGE_LABELS = {
  group: 'Vòng bảng', round_of_16: '1/8', quarter: 'Tứ kết',
  semi: 'Bán kết', final: 'Chung kết', third_place: 'Hạng 3',
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AthleteDashboard() {
  const { profile } = useAuth()
  const { t } = useI18n()
  const [tab, setTab]               = useState('mine')
  const [newNotifCount, setNewNotifCount] = useState(0)
  const mountKey          = useRef(Date.now())
  const athletePlayerIds  = useRef(new Set())

  // NR5: Realtime đăng ký được duyệt/từ chối
  useEffect(() => {
    if (!profile) return

    const channel = supabase.channel(`athlete-reg-${profile.id}-${mountKey.current}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournament_registrations',
        filter: `athlete_id=eq.${profile.id}`,
      }, (payload) => {
        const newStatus = payload.new?.status
        if (newStatus === 'approved') {
          setNewNotifCount(prev => prev + 1)
          showToast(t('athlete.regApproved'), 'success')
        } else if (newStatus === 'rejected') {
          setNewNotifCount(prev => prev + 1)
          showToast(t('athlete.regRejected'), 'error')
        }
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || err) {
          console.warn('[AthleteDashboard] reg subscription error:', status, err)
        }
      })

    return () => supabase.removeChannel(channel)
  }, [profile?.id])

  // NR6: Load player IDs trước, rồi mới subscribe matches theo từng player ID
  useEffect(() => {
    if (!profile?.id) return
    let channels = []
    let cancelled = false

    supabase
      .from('players')
      .select('id')
      .eq('athlete_id', profile.id)
      .then(({ data }) => {
        if (cancelled || !data?.length) return
        const playerIds = data.map(p => p.id)
        athletePlayerIds.current = new Set(playerIds)

        const handleMatchUpdate = (payload) => {
          const m = payload.new
          if (m.status === 'calling') {
            showToast(`📞 Trận của bạn được gọi vào Sân ${m.court_number}! Vui lòng vào sân.`, 'info')
          } else if (m.status === 'active') {
            showToast(`🏸 Trận tại Sân ${m.court_number} đã bắt đầu!`, 'success')
          }
        }

        playerIds.forEach(pid => {
          const ch1 = supabase.channel(`athlete-mp1-${pid}-${mountKey.current}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `player1_id=eq.${pid}` }, handleMatchUpdate)
            .subscribe()
          const ch2 = supabase.channel(`athlete-mp2-${pid}-${mountKey.current}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `player2_id=eq.${pid}` }, handleMatchUpdate)
            .subscribe()
          channels.push(ch1, ch2)
        })
      })

    return () => {
      cancelled = true
      channels.forEach(ch => supabase.removeChannel(ch))
    }
  }, [profile?.id])

  function switchTab(id) {
    if (id === 'mine') setNewNotifCount(0)
    setTab(id)
  }

  if (!profile) return null

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Greeting */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Xin chào, {profile.name} 👋</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vận động viên · {profile.club || 'Chưa có CLB'}</p>
        </div>
        <PushSubscribeButton userId={profile?.id} className="shrink-0 mt-1" />
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map(tb => {
          const Icon = tb.icon
          return (
            <button
              key={tb.id}
              onClick={() => switchTab(tb.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === tb.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              <Icon className="w-4 h-4" />
              {tb.label}
              {tb.id === 'mine' && newNotifCount > 0 && (
                <span className="ml-1 bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none">
                  {newNotifCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'mine'    && <MyRegistrationsTab profile={profile} />}
      {tab === 'matches' && <MatchScheduleTab profile={profile} />}
      {tab === 'profile' && <ProfileTab profile={profile} />}
    </div>
  )
}

// ── Tab: Lịch thi đấu ────────────────────────────────────────────────────────

function MatchScheduleTab({ profile }) {
  const [playerList, setPlayerList] = useState([])
  const [matches, setMatches]       = useState([])
  const [loading, setLoading]       = useState(true)
  const mountKey = useRef(Date.now())

  async function load() {
    try {
      const { data: playerData, error: pErr } = await supabase
        .from('players')
        .select('id, event_id, tournament_id')
        .eq('athlete_id', profile.id)
      if (pErr) throw pErr
      if (!playerData?.length) { setLoading(false); return }

      setPlayerList(playerData)
      const idList = playerData.map(p => p.id).join(',')

      const { data: matchData, error: mErr } = await supabase
        .from('matches')
        .select(`
          id, player1_id, player2_id, event_id, tournament_id,
          stage, match_number, status,
          player1_scores, player2_scores, winner_id,
          court_number, wave_number,
          p1:players!player1_id(id, name),
          p2:players!player2_id(id, name),
          tournament:tournaments!tournament_id(id, name),
          event:events!event_id(id, name, discipline)
        `)
        .or(`player1_id.in.(${idList}),player2_id.in.(${idList})`)
        .order('wave_number', { nullsFirst: false })
        .order('match_number')
      if (mErr) throw mErr

      const myIds = new Set(playerData.map(p => p.id))
      setMatches((matchData || []).map(m => ({
        ...m,
        myPlayerId: myIds.has(m.player1_id) ? m.player1_id : m.player2_id,
      })))
    } catch (err) {
      console.error('[MatchScheduleTab] load:', err)
      showToast('Không thể tải lịch thi đấu.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    startTransition(() => { load() })
  }, [profile.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: patch match row in-place on score / status update
  useEffect(() => {
    if (!playerList.length) return
    const channels = []
    playerList.forEach(({ id: pid }) => {
      const patchMatch = payload =>
        setMatches(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
      const c1 = supabase.channel(`ms-p1-${pid}-${mountKey.current}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `player1_id=eq.${pid}` }, patchMatch)
        .subscribe()
      const c2 = supabase.channel(`ms-p2-${pid}-${mountKey.current}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `player2_id=eq.${pid}` }, patchMatch)
        .subscribe()
      channels.push(c1, c2)
    })
    return () => channels.forEach(ch => supabase.removeChannel(ch))
  }, [playerList.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingBox />

  if (!matches.length) {
    return (
      <EmptyBox
        icon={Clock}
        title="Chưa có trận đấu nào"
        desc="Trận đấu sẽ xuất hiện tại đây khi Ban tổ chức xếp lịch."
      />
    )
  }

  const calling = matches.filter(m => m.status === 'calling' || m.status === 'active')
  const pending = matches.filter(m => m.status === 'pending')
  const done    = matches.filter(m => m.status === 'completed')

  return (
    <div className="space-y-5">
      {calling.length > 0 && (
        <MatchGroup title="🏸 Đang thi đấu" count={calling.length} matches={calling} />
      )}
      {pending.length > 0 && (
        <MatchGroup title="⏳ Sắp thi đấu" count={pending.length} matches={pending} />
      )}
      {done.length > 0 && (
        <MatchGroup title="✅ Đã thi đấu" count={done.length} matches={done} collapsible />
      )}
    </div>
  )
}

function MatchGroup({ title, count, matches, collapsible = false }) {
  const [open, setOpen] = useState(!collapsible)
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => collapsible && setOpen(o => !o)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 text-left',
          collapsible && 'hover:bg-gray-50 transition-colors',
        )}
      >
        <span className="font-semibold text-sm text-gray-800">{title} ({count})</span>
        {collapsible && (
          <ChevronRight className={cn('w-4 h-4 text-gray-400 transition-transform shrink-0', open && 'rotate-90')} />
        )}
      </button>
      {open && (
        <div className="divide-y divide-gray-100 border-t border-gray-100">
          {matches.map(m => <MatchRow key={m.id} match={m} />)}
        </div>
      )}
    </div>
  )
}

function MatchRow({ match: m }) {
  const isP1     = m.myPlayerId === m.player1_id
  const opponent = isP1 ? m.p2 : m.p1
  const myScores = isP1 ? m.player1_scores : m.player2_scores
  const opScores = isP1 ? m.player2_scores : m.player1_scores
  const iWon     = m.status === 'completed' && m.winner_id === m.myPlayerId
  const live     = m.status === 'active'
  const calling  = m.status === 'calling'
  const done     = m.status === 'completed'
  const scoreStr = done && myScores?.length
    ? myScores.map((s, i) => `${s}–${opScores?.[i] ?? 0}`).join('  ')
    : null

  return (
    <div className={cn(
      'px-4 py-3',
      calling && 'bg-blue-50/60',
      iWon && done && 'bg-green-50/40',
    )}>
      <p className="text-[11px] text-gray-400 mb-0.5 truncate">
        {m.tournament?.name ?? '—'} · {DISCIPLINE_LABELS[m.event?.discipline] ?? m.event?.name ?? '—'}
      </p>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500">
            {STAGE_LABELS[m.stage] ?? m.stage}
            {m.match_number ? ` · #${m.match_number}` : ''}
            {m.court_number != null && !done && (
              <span className="ml-1.5 text-blue-500 font-medium">
                Sân {m.court_number}{m.wave_number != null ? ` · Lượt ${m.wave_number}` : ''}
              </span>
            )}
          </p>
          <p className={cn('text-sm font-semibold truncate mt-0.5', iWon ? 'text-green-700' : 'text-gray-800')}>
            vs {opponent?.name ?? 'TBD'}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {calling && <span className="text-xs font-bold text-blue-600 animate-pulse block">📞 Vào sân!</span>}
          {live && !calling && <span className="text-xs font-bold text-red-500 animate-pulse block">● LIVE</span>}
          {done && scoreStr && (
            <span className={cn('text-sm font-mono font-bold', iWon ? 'text-green-600' : 'text-gray-500')}>
              {scoreStr}
            </span>
          )}
          {!done && !live && !calling && m.court_number == null && (
            <span className="text-xs text-gray-400 flex items-center gap-1 justify-end">
              <Clock className="w-3 h-3" /> Chờ xếp lịch
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tab: Của tôi ──────────────────────────────────────────────────────────────

function MyRegistrationsTab({ profile }) {
  const [regs, setRegs]         = useState([])
  const [matchMap, setMatchMap] = useState({})   // eventId → Match[]
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      try {
      const { data: regData, error: regErr } = await supabase
        .from('tournament_registrations')
        .select(`
          id, status, note, created_at, event_id,
          looking_for_partner, partner_note,
          tournaments(id, name, status, start_date),
          events(id, name, discipline)
        `)
        .eq('athlete_id', profile.id)
        .order('created_at', { ascending: false })

      if (regErr) throw regErr
      const regs = regData || []
      setRegs(regs)

      // For approved regs, find player records then their matches
      const approvedEventIds = regs
        .filter(r => r.status === 'approved')
        .map(r => r.event_id)
        .filter(Boolean)

      if (approvedEventIds.length > 0) {
        const { data: myPlayers } = await supabase
          .from('players')
          .select('id, event_id')
          .eq('athlete_id', profile.id)
          .in('event_id', approvedEventIds)

        if (myPlayers?.length) {
          const myPlayerIds = myPlayers.map(p => p.id)
          const eventByPlayer = Object.fromEntries(myPlayers.map(p => [p.id, p.event_id]))
          const idList = myPlayerIds.join(',')

          const { data: matchData } = await supabase
            .from('matches')
            .select(`
              id, player1_id, player2_id, event_id, stage, match_number,
              status, player1_scores, player2_scores, winner_id,
              court_number, wave_number,
              p1:players!player1_id(id, name),
              p2:players!player2_id(id, name)
            `)
            .or(`player1_id.in.(${idList}),player2_id.in.(${idList})`)
            .order('wave_number', { nullsFirst: false })
            .order('match_number')

          const byEvent = {}
          for (const m of matchData || []) {
            const myPid = myPlayerIds.find(pid => pid === m.player1_id || pid === m.player2_id)
            if (!myPid) continue
            const eid = eventByPlayer[myPid]
            if (!byEvent[eid]) byEvent[eid] = []
            byEvent[eid].push({ ...m, myPlayerId: myPid })
          }
          setMatchMap(byEvent)
        }
      }
      } catch (err) {
        console.error('[AthleteDashboard] load registrations:', err)
        showToast('Không thể tải đăng ký của bạn. Vui lòng thử lại.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [profile.id])

  if (loading) return <LoadingBox />

  if (regs.length === 0) {
    return (
      <EmptyBox
        icon={CalendarDays}
        title="Chưa có đơn đăng ký nào"
        desc='Vào tab "Giải đang mở" để đăng ký tham gia giải đấu.'
      />
    )
  }

  // Group by tournament
  const byTournament = regs.reduce((acc, r) => {
    const tid = r.tournaments?.id ?? 'unknown'
    if (!acc[tid]) acc[tid] = { tournament: r.tournaments, regs: [] }
    acc[tid].regs.push(r)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {Object.values(byTournament).map(({ tournament, regs: tRegs }) => (
        <div key={tournament?.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm truncate">{tournament?.name}</h3>
            {tournament?.start_date && (
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(tournament.start_date).toLocaleDateString('vi-VN')}
              </p>
            )}
          </div>
          <div className="divide-y divide-gray-100">
            {tRegs.map(r => {
              const badge    = STATUS_BADGE[r.status] ?? STATUS_BADGE.pending
              const matches  = matchMap[r.event_id] ?? []
              return (
                <div key={r.id}>
                  {/* Registration row */}
                  <div className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-gray-700 flex items-center gap-1.5">
                      <span>{DISCIPLINE_ICONS[r.events?.discipline] ?? '🏸'}</span>
                      {DISCIPLINE_LABELS[r.events?.discipline] ?? r.events?.name}
                    </span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', badge.color)}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Match schedule for approved events */}
                  {r.status === 'approved' && matches.length > 0 && (
                    <div className="mx-5 mb-3 border border-gray-100 rounded-xl overflow-hidden">
                      <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Lịch thi đấu</p>
                      </div>
                      {matches.map(m => {
                        const isP1     = m.myPlayerId === m.player1_id
                        const opponent = isP1 ? m.p2 : m.p1
                        const myScores = isP1 ? m.player1_scores : m.player2_scores
                        const opScores = isP1 ? m.player2_scores : m.player1_scores
                        const iWon     = m.status === 'completed' && m.winner_id === m.myPlayerId
                        const done     = m.status === 'completed'
                        const live     = m.status === 'active'
                        const scoreStr = done && myScores?.length
                          ? myScores.map((s, i) => `${s}–${opScores?.[i] ?? 0}`).join(' ')
                          : null
                        const scheduled = m.court_number != null && m.wave_number != null
                        const calling  = m.status === 'calling'
                        return (
                          <div key={m.id} className={cn(
                            'flex items-center justify-between px-3 py-2 border-b border-gray-50 last:border-0',
                            iWon && 'bg-green-50/60',
                            calling && 'bg-blue-50/60',
                          )}>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] text-gray-400">
                                {STAGE_LABELS[m.stage] ?? m.stage}
                                {m.match_number ? ` · #${m.match_number}` : ''}
                                {scheduled && !done && (
                                  <span className="ml-1.5 text-blue-500 font-medium">
                                    Sân {m.court_number} · Lượt {m.wave_number}
                                  </span>
                                )}
                              </p>
                              <p className={cn(
                                'text-xs font-medium truncate',
                                iWon ? 'text-green-700' : 'text-gray-700',
                              )}>
                                vs {opponent?.name ?? 'TBD'}
                              </p>
                            </div>
                            <div className="shrink-0 text-right ml-3">
                              {calling && (
                                <span className="text-[10px] font-bold text-blue-600 animate-pulse">📞 Vào sân!</span>
                              )}
                              {live && !calling && (
                                <span className="text-[10px] font-bold text-red-500 animate-pulse">● LIVE</span>
                              )}
                              {done && scoreStr && (
                                <span className={cn(
                                  'text-xs font-mono font-semibold',
                                  iWon ? 'text-green-600' : 'text-gray-500',
                                )}>
                                  {scoreStr}
                                </span>
                              )}
                              {!done && !live && !calling && (
                                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                  <Clock className="w-3 h-3" /> Chờ
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Approved but no matches scheduled yet */}
                  {r.status === 'approved' && matches.length === 0 && (
                    <p className="px-5 pb-3 text-xs text-gray-400 italic">
                      Lịch thi đấu chưa được xếp.
                    </p>
                  )}

                  {/* Doubles partner finder — only for approved doubles registrations */}
                  {r.status === 'approved' && r.events?.discipline?.includes('doubles') && (
                    <DoublesPartnerSection reg={r} profile={profile} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Doubles partner finder ────────────────────────────────────────────────────

function DoublesPartnerSection({ reg, profile }) {
  const [looking, setLooking]         = useState(reg.looking_for_partner ?? false)
  const [note, setNote]               = useState(reg.partner_note ?? '')
  const [partners, setPartners]       = useState([])
  const [loadingPartners, setLoadingPartners] = useState(false)
  const [toggling, setToggling]       = useState(false)

  // Load other athletes looking for a partner in the same event
  useEffect(() => {
    async function fetchPartners() {
      setLoadingPartners(true)
      const { data } = await supabase
        .from('tournament_registrations')
        .select('id, athlete_id, looking_for_partner, partner_note, profiles(id, name, club, phone)')
        .eq('event_id', reg.event_id)
        .eq('looking_for_partner', true)
        .neq('athlete_id', profile.id)
      setPartners(data || [])
      setLoadingPartners(false)
    }
    fetchPartners()
  }, [reg.event_id, profile.id])

  async function handleToggle() {
    setToggling(true)
    const newVal = !looking
    const { error } = await supabase
      .from('tournament_registrations')
      .update({ looking_for_partner: newVal, partner_note: newVal ? (note || null) : null })
      .eq('id', reg.id)
    if (!error) {
      setLooking(newVal)
      if (!newVal) setNote('')
    }
    setToggling(false)
  }

  async function handleNoteBlur() {
    if (!looking) return
    await supabase
      .from('tournament_registrations')
      .update({ partner_note: note.trim() || null })
      .eq('id', reg.id)
  }

  return (
    <div className="mx-5 mb-3 border border-blue-100 rounded-xl overflow-hidden bg-blue-50/30">
      {/* Toggle row */}
      <div className="px-3 py-2 flex items-center gap-2">
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={cn(
            'text-xs px-3 py-1 rounded-full font-medium border transition-colors shrink-0',
            looking
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400',
            toggling && 'opacity-60 cursor-not-allowed',
          )}
        >
          {looking ? '● Đang tìm partner' : 'Tìm partner'}
        </button>
        {looking && (
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value.slice(0, 100))}
            onBlur={handleNoteBlur}
            placeholder="Lời nhắn cho partner (tuỳ chọn)…"
            maxLength={100}
            className="flex-1 min-w-0 px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        )}
      </div>

      {/* Partner list */}
      <div className="border-t border-blue-100 px-3 py-2 space-y-1.5">
        <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide">
          Đang tìm partner trong nội dung này
        </p>
        {loadingPartners ? (
          <p className="text-xs text-gray-400 italic py-1">Đang tải…</p>
        ) : partners.length === 0 ? (
          <p className="text-xs text-gray-400 italic py-1">Chưa có ai đang tìm partner.</p>
        ) : (
          partners.map(p => {
            const pl = p.profiles
            const phone = pl?.phone
            return (
              <div key={p.id} className="flex items-center justify-between gap-2 py-1">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-800 truncate">{pl?.name ?? '—'}</p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {pl?.club || 'Chưa có CLB'}
                    {p.partner_note ? ` · ${p.partner_note}` : ''}
                  </p>
                </div>
                <a
                  href={phone ? `tel:${phone}` : '#'}
                  onClick={!phone ? (e) => { e.preventDefault(); navigator.clipboard?.writeText(pl?.name ?? '') } : undefined}
                  className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                >
                  Liên hệ
                </a>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Tab: Hồ sơ ───────────────────────────────────────────────────────────────

function ProfileTab({ profile: initProfile }) {
  const { signOut } = useAuth()
  const navigate    = useNavigate()
  const [name, setName]   = useState(initProfile.name || '')
  const [club, setClub]   = useState(initProfile.club || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setError(null); setSaved(false)
    const { error: err } = await supabase
      .from('profiles')
      .update({ name, club: club || null })
      .eq('id', initProfile.id)

    if (err) {
      setError(err.message)
    } else {
      setSaved(true)
      // Update localStorage session
      const stored = JSON.parse(localStorage.getItem('bt_session') || 'null')
      if (stored) {
        localStorage.setItem('bt_session', JSON.stringify({ ...stored, name, club: club || null }))
        window.dispatchEvent(new Event('auth-change'))
      }
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  async function handleLogout() {
    signOut()
    navigate('/login')
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">Thông tin cá nhân</h3>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Họ và tên</label>
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Số điện thoại</label>
          <input
            type="tel"
            value={initProfile.phone}
            disabled
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-400 bg-gray-50 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            CLB / Đội <span className="text-gray-400 font-normal">(tuỳ chọn)</span>
          </label>
          <input
            type="text"
            value={club}
            onChange={e => setClub(e.target.value)}
            placeholder="CLB Cầu Lông XYZ"
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          {saving
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : saved
            ? <CheckCircle2 className="w-4 h-4 text-green-300" />
            : <Save className="w-4 h-4" />
          }
          {saving ? 'Đang lưu...' : saved ? 'Đã lưu!' : 'Lưu thay đổi'}
        </button>
      </form>

      <button
        onClick={handleLogout}
        className="w-full py-2.5 border border-gray-300 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
      >
        Đăng xuất
      </button>
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function LoadingBox() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
    </div>
  )
}

function EmptyBox({ icon, title, desc }) {
  const Icon = icon
  return (
    <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
      <Icon className="w-8 h-8 text-gray-300 mx-auto mb-3" />
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{desc}</p>
    </div>
  )
}
