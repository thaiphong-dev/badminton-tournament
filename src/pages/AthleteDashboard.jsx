import { useState, useEffect, useRef, startTransition } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, CalendarDays, User, Loader2, CheckCircle2, Clock, XCircle, ChevronRight, MapPin, Save, AlertCircle, Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { DISCIPLINE_LABELS, DISCIPLINE_ICONS } from '@/lib/constants'
import { cn } from '@/lib/utils/cn'
import RegistrationModal from '@/components/athlete/RegistrationModal'
import { showToast } from '@/lib/hooks/useApiError'

const STATUS_BADGE = {
  pending:  { label: 'Chờ duyệt', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Đã duyệt',  color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Từ chối',   color: 'bg-red-100 text-red-700' },
}

const TABS = [
  { id: 'open',    label: 'Giải đang mở', icon: Trophy },
  { id: 'mine',    label: 'Của tôi',      icon: CalendarDays },
  { id: 'profile', label: 'Hồ sơ',        icon: User },
]

export default function AthleteDashboard() {
  const { profile } = useAuth()
  const [tab, setTab]               = useState('open')
  const [newNotifCount, setNewNotifCount] = useState(0)
  const [toast, setToast]           = useState(null)
  const toastTimerRef               = useRef(null)

  useEffect(() => {
    if (!profile) return

    const channel = supabase.channel(`athlete-reg-${profile.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournament_registrations',
        filter: `athlete_id=eq.${profile.id}`,
      }, (payload) => {
        const newStatus = payload.new?.status
        if (newStatus === 'approved' || newStatus === 'rejected') {
          setNewNotifCount(prev => prev + 1)
          const msg = newStatus === 'approved'
            ? 'Đăng ký của bạn đã được duyệt!'
            : 'Đăng ký của bạn bị từ chối.'
          setToast({ msg, ok: newStatus === 'approved' })
          clearTimeout(toastTimerRef.current)
          toastTimerRef.current = setTimeout(() => setToast(null), 4000)
        }
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || err) {
          console.warn('[AthleteDashboard] Realtime subscription error:', status, err)
        }
      })

    return () => {
      supabase.removeChannel(channel)
      clearTimeout(toastTimerRef.current)
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
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Xin chào, {profile.name} 👋</h1>
        <p className="text-sm text-gray-500 mt-0.5">Vận động viên · {profile.club || 'Chưa có CLB'}</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {t.id === 'mine' && newNotifCount > 0 && (
                <span className="ml-1 bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none">
                  {newNotifCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'open'    && <OpenTournamentsTab profile={profile} />}
      {tab === 'mine'    && <MyRegistrationsTab profile={profile} />}
      {tab === 'profile' && <ProfileTab profile={profile} />}

      {/* Toast notification */}
      {toast && (
        <div className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all',
          toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white',
        )}>
          <Bell className="w-4 h-4 shrink-0" />
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ── Status helper for athlete view ───────────────────────────────────────────

function athleteStatus(t) {
  if (t.status === 'completed')
    return { label: 'Đã hoàn thành',     color: 'bg-gray-100 text-gray-500' }
  if (t.status === 'group_stage' || t.status === 'knockout')
    return { label: 'Đang thi đấu',      color: 'bg-blue-100 text-blue-700' }
  if (t.registration_open)
    return { label: 'Mở đăng ký',        color: 'bg-green-100 text-green-700' }
  return   { label: 'Chưa mở đăng ký',  color: 'bg-gray-100 text-gray-400' }
}

const ATHLETE_PAGE_SIZE = 8

// ── Tab: Giải đấu ─────────────────────────────────────────────────────────────

function OpenTournamentsTab({ profile }) {
  const [tournaments, setTournaments] = useState([])
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [myRegIds, setMyRegIds]       = useState(new Set())
  const [loading, setLoading]         = useState(true)
  const [registerFor, setRegisterFor] = useState(null)

  async function load(p) {
    setLoading(true)
    const from = (p - 1) * ATHLETE_PAGE_SIZE
    const to   = from + ATHLETE_PAGE_SIZE - 1
    try {
      const [tRes, rRes] = await Promise.all([
        supabase
          .from('tournaments')
          .select('*, events(id, name, discipline, status)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to),
        supabase
          .from('tournament_registrations')
          .select('event_id')
          .eq('athlete_id', profile.id),
      ])
      if (tRes.error) throw tRes.error
      setTournaments(tRes.data || [])
      setTotal(tRes.count ?? 0)
      setMyRegIds(new Set((rRes.data || []).map(r => r.event_id)))
    } catch (err) {
      console.error('[AthleteDashboard] load tournaments:', err)
      showToast('Không thể tải danh sách giải đấu. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { startTransition(() => { load(page) }) }, [page, profile.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleRegistered() {
    setRegisterFor(null)
    supabase
      .from('tournament_registrations')
      .select('event_id')
      .eq('athlete_id', profile.id)
      .then(({ data }) => setMyRegIds(new Set((data || []).map(r => r.event_id))))
  }

  const totalPages = Math.ceil(total / ATHLETE_PAGE_SIZE)

  if (loading) return <LoadingBox />

  if (total === 0) {
    return (
      <EmptyBox
        icon={Trophy}
        title="Chưa có giải đấu nào"
        desc="Kiểm tra lại sau khi ban tổ chức tạo giải mới."
      />
    )
  }

  return (
    <div className="space-y-4">
      {tournaments.map(t => {
        const events     = t.events || []
        const st         = athleteStatus(t)
        const canRegister = t.registration_open && t.status !== 'completed'
        const alreadyAll = events.length > 0 && events.every(e => myRegIds.has(e.id))
        const isDone     = t.status === 'completed'

        return (
          <div key={t.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-4 pb-3 border-b border-gray-100">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 text-base truncate">{t.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5 flex-wrap">
                    {t.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{t.location}
                      </span>
                    )}
                    {t.start_date && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {new Date(t.start_date).toLocaleDateString('vi-VN')}
                      </span>
                    )}
                  </div>
                </div>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', st.color)}>
                  {st.label}
                </span>
              </div>
            </div>

            {/* Events list */}
            {events.length === 0 ? (
              <p className="px-5 py-3 text-xs text-gray-400 italic">Chưa có nội dung thi đấu.</p>
            ) : (
              <div className="px-5 py-3 space-y-1.5">
                {events.map(e => {
                  const registered = myRegIds.has(e.id)
                  return (
                    <div key={e.id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 flex items-center gap-1.5">
                        <span>{DISCIPLINE_ICONS[e.discipline] ?? '🏸'}</span>
                        {DISCIPLINE_LABELS[e.discipline] ?? e.name}
                      </span>
                      {registered && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đã đăng ký
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* CTA row */}
            {events.length > 0 && (
              <div className="px-5 pb-4 flex gap-2">
                {isDone ? (
                  <a
                    href={`/tournament/${t.id}/results`}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors border border-yellow-200"
                  >
                    🏆 Xem kết quả
                  </a>
                ) : canRegister ? (
                  <button
                    onClick={() => setRegisterFor({ tournament: t, events })}
                    disabled={alreadyAll}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                      alreadyAll
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700',
                    )}
                  >
                    {alreadyAll ? 'Đã đăng ký tất cả' : '+ Đăng ký tham gia'}
                  </button>
                ) : (
                  <div className="flex-1 py-2.5 rounded-xl text-sm text-center text-gray-400 bg-gray-50">
                    {t.status === 'group_stage' || t.status === 'knockout'
                      ? 'Giải đang diễn ra'
                      : 'Chưa mở đăng ký'}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <AthletePagination page={page} totalPages={totalPages} onChange={p => setPage(p)} />
      )}

      {registerFor && (
        <RegistrationModal
          tournament={registerFor.tournament}
          events={registerFor.events}
          athleteId={profile.id}
          existingEventIds={myRegIds}
          onClose={() => setRegisterFor(null)}
          onSuccess={handleRegistered}
        />
      )}
    </div>
  )
}

function AthletePagination({ page, totalPages, onChange }) {
  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ‹ Trước
      </button>
      <span className="text-sm text-gray-500">{page} / {totalPages}</span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Tiếp ›
      </button>
    </div>
  )
}

// ── Tab: Của tôi ──────────────────────────────────────────────────────────────

const STAGE_LABELS = {
  group: 'Vòng bảng', round_of_16: '1/8', quarter: 'Tứ kết',
  semi: 'Bán kết', final: 'Chung kết', third_place: 'Hạng 3',
}

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
              p1:players!player1_id(id, name),
              p2:players!player2_id(id, name)
            `)
            .or(`player1_id.in.(${idList}),player2_id.in.(${idList})`)
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
                        return (
                          <div key={m.id} className={cn(
                            'flex items-center justify-between px-3 py-2 border-b border-gray-50 last:border-0',
                            iWon && 'bg-green-50/60',
                          )}>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] text-gray-400">
                                {STAGE_LABELS[m.stage] ?? m.stage}
                                {m.match_number ? ` · #${m.match_number}` : ''}
                              </p>
                              <p className={cn(
                                'text-xs font-medium truncate',
                                iWon ? 'text-green-700' : 'text-gray-700',
                              )}>
                                vs {opponent?.name ?? 'TBD'}
                              </p>
                            </div>
                            <div className="shrink-0 text-right ml-3">
                              {live && (
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
                              {!done && !live && (
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
                </div>
              )
            })}
          </div>
        </div>
      ))}
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
