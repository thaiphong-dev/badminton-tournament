import { useState, useEffect, useCallback, startTransition, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Users, Trophy, Activity, Shield, Search, ChevronRight,
  AlertCircle, Check, X, CreditCard, Package, Star, Settings, FileText, KeyRound,
  Ban, RotateCcw, Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { STATUS_LABELS } from '@/lib/constants'
import Badge from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { cn } from '@/lib/utils/cn'
import OrdersTab from '@/components/admin/OrdersTab'
import PlansTab from '@/components/admin/PlansTab'
import SubscriptionsTab from '@/components/admin/SubscriptionsTab'
import SettingsTab from '@/components/admin/SettingsTab'
import AuditLogTab from '@/components/admin/AuditLogTab'

const ROLE_CONFIG = {
  admin:   { label: 'Admin',     badge: 'red'     },
  creator: { label: 'Creator',   badge: 'purple'  },
  umpire:  { label: 'Trọng tài', badge: 'blue'    },
  athlete: { label: 'VĐV',       badge: 'green'   },
}

const ROLES = ['admin', 'creator', 'umpire', 'athlete']

const TOURNAMENT_STATUS_BADGE = {
  setup:       'yellow',
  group_stage: 'blue',
  knockout:    'purple',
  completed:   'green',
}

const PAGE_SIZE = 25

const TABS = [
  { id: 'users',         label: 'Users',         Icon: Users      },
  { id: 'tournaments',   label: 'Giải đấu',      Icon: Trophy     },
  { id: 'orders',        label: 'Đơn hàng',      Icon: CreditCard },
  { id: 'plans',         label: 'Gói DV',        Icon: Package    },
  { id: 'subscriptions', label: 'Subscriptions', Icon: Star       },
  { id: 'settings',      label: 'Cài đặt',       Icon: Settings   },
  { id: 'audit',         label: 'Audit Log',     Icon: FileText   },
]

function formatRevenue(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' tr'
  if (n >= 1_000) return Math.round(n / 1_000) + 'k'
  return String(n)
}

function daysLeft(expiresAt) {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt) - Date.now()) / 86_400_000)
}

export default function AdminDashboard() {
  const { profile } = useAuth()
  const adminId = profile?.id ?? ''

  const [searchParams] = useSearchParams()
  const initialTab = TABS.some(t => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'users'

  const [stats, setStats]             = useState(null)
  const [profiles, setProfiles]       = useState([])
  const [usersTotalCount, setUsersTotalCount] = useState(0)
  const [usersPage, setUsersPage]     = useState(0)
  const [subMap, setSubMap]           = useState({})
  const [tournaments, setTournaments] = useState([])
  const [tournamentsTotalCount, setTournamentsTotalCount] = useState(0)
  const [tournamentsPage, setTournamentsPage] = useState(0)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [search, setSearch]           = useState('')
  const [tab, setTab]                 = useState(initialTab)
  const visited = useRef(new Set([initialTab]))
  const navigate = useNavigate()
  const [pendingOrderCount, setPendingOrderCount] = useState(0)
  const [resetTarget, setResetTarget]     = useState(null)
  const [suspendTarget, setSuspendTarget] = useState(null) // { id, name } for suspend modal
  const [deleteTarget, setDeleteTarget]   = useState(null) // { id, name } for delete confirm

  function switchTab(id) {
    visited.current.add(id)
    setTab(id)
    setSearch('')
    setUsersPage(0)
    setTournamentsPage(0)
  }

  const loadUsers = useCallback(async (page, q) => {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    let query = supabase
      .from('profiles')
      .select('id, name, phone, role, club, created_at, is_active', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
    if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,club.ilike.%${q}%`)
    const { data, count } = await query
    setProfiles(data ?? [])
    setUsersTotalCount(count ?? 0)
  }, [])

  const loadTournaments = useCallback(async (page, q) => {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    let query = supabase
      .from('tournaments')
      .select('id, name, status, is_suspended, suspended_reason, created_at, creator_id, profiles!creator_id(name), events(id)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
    if (q) query = query.or(`name.ilike.%${q}%`)
    const { data, count } = await query
    setTournaments(data ?? [])
    setTournamentsTotalCount(count ?? 0)
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [totalRes, cRes, aRes, uRes, tStatsRes, subRes, ordRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'creator'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'athlete'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'umpire'),
        supabase.from('tournaments').select('status, is_suspended'),
        supabase.from('subscriptions').select('id, creator_id, plan_id, status, expires_at, plan:subscription_plans!plan_id(name, slug)').eq('status', 'active'),
        supabase.from('payment_orders').select('id, amount, status, confirmed_at, created_at').in('status', ['waiting', 'confirmed']),
      ])

      const tourn = tStatsRes.data ?? []
      const subs  = subRes.data ?? []
      const ords  = ordRes.data ?? []

      const sm = {}
      subs.forEach(s => { sm[s.creator_id] = s })
      setSubMap(sm)

      const now = Date.now()
      const expiringSoon = subs.filter(s => {
        if (!s.expires_at) return false
        const d = new Date(s.expires_at) - now
        return d > 0 && d <= 7 * 86_400_000
      }).length
      const waitingOrders = ords.filter(o => o.status === 'waiting').length
      const thisMonth = new Date().toISOString().slice(0, 7)
      const monthRevenue = ords
        .filter(o => o.status === 'confirmed' && (o.confirmed_at ?? o.created_at)?.startsWith(thisMonth))
        .reduce((sum, o) => sum + (Number(o.amount) || 0), 0)

      setStats({
        total:        totalRes.count ?? 0,
        creator:      cRes.count ?? 0,
        athlete:      aRes.count ?? 0,
        umpire:       uRes.count ?? 0,
        admin:        (totalRes.count ?? 0) - (cRes.count ?? 0) - (aRes.count ?? 0) - (uRes.count ?? 0),
        tournaments:  tourn.length,
        active:       tourn.filter(t => t.status !== 'completed').length,
        suspended:    tourn.filter(t => t.is_suspended).length,
        activeSubs:   subs.length,
        expiringSoon,
        waitingOrders,
        monthRevenue,
      })

      await Promise.all([loadUsers(0, ''), loadTournaments(0, '')])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [loadUsers, loadTournaments])

  useEffect(() => {
    startTransition(() => { fetchAll() })
  }, [fetchAll])

  // Reload users when page changes
  useEffect(() => {
    if (tab === 'users') loadUsers(usersPage, search)
  }, [usersPage])

  // Reload tournaments when page changes
  useEffect(() => {
    if (tab === 'tournaments') loadTournaments(tournamentsPage, search)
  }, [tournamentsPage])

  async function fetchPendingCount() {
    const { count } = await supabase
      .from('payment_orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'waiting')
    setPendingOrderCount(count ?? 0)
  }

  useEffect(() => {
    fetchPendingCount()
    const channel = supabase.channel('admin-pending-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_orders' },
        () => fetchPendingCount())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function handleRoleChange(profileId, newRole) {
    const { error: err } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', profileId)
    if (err) { alert('Lỗi đổi role: ' + err.message); return }
    setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, role: newRole } : p))
    setStats(prev => {
      if (!prev) return prev
      const old = profiles.find(p => p.id === profileId)?.role
      if (!old || old === newRole) return prev
      return {
        ...prev,
        [old]: Math.max(0, (prev[old] ?? 0) - 1),
        [newRole]: (prev[newRole] ?? 0) + 1,
      }
    })
  }

  async function handleDeactivateUser(profileId) {
    const { error: err } = await supabase.rpc('admin_deactivate_user', {
      p_admin_id: adminId,
      p_target_id: profileId,
      p_reason: null,
    })
    if (err) { alert('Lỗi: ' + err.message); return }
    setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, is_active: false } : p))
  }

  async function handleActivateUser(profileId) {
    const { error: err } = await supabase.rpc('admin_activate_user', {
      p_admin_id: adminId,
      p_target_id: profileId,
    })
    if (err) { alert('Lỗi: ' + err.message); return }
    setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, is_active: true } : p))
  }

  async function handleResetPassword(targetId, newPassword) {
    const { error } = await supabase.rpc('admin_reset_user_password', {
      p_admin_id:     adminId,
      p_target_id:    targetId,
      p_new_password: newPassword,
    })
    if (error) throw new Error(error.message)
    setResetTarget(null)
  }

  async function handleSuspendTournament(tournamentId, reason) {
    const { error: err } = await supabase.rpc('admin_suspend_tournament', {
      p_admin_id:      adminId,
      p_tournament_id: tournamentId,
      p_reason:        reason || null,
    })
    if (err) throw new Error(err.message)
    setTournaments(prev => prev.map(t =>
      t.id === tournamentId ? { ...t, is_suspended: true, suspended_reason: reason || null } : t
    ))
    setStats(prev => prev ? { ...prev, suspended: (prev.suspended ?? 0) + 1 } : prev)
    setSuspendTarget(null)
  }

  async function handleUnsuspendTournament(tournamentId) {
    const { error: err } = await supabase.rpc('admin_unsuspend_tournament', {
      p_admin_id:      adminId,
      p_tournament_id: tournamentId,
    })
    if (err) { alert('Lỗi: ' + err.message); return }
    setTournaments(prev => prev.map(t =>
      t.id === tournamentId ? { ...t, is_suspended: false, suspended_reason: null } : t
    ))
    setStats(prev => prev ? { ...prev, suspended: Math.max(0, (prev.suspended ?? 1) - 1) } : prev)
  }

  async function handleDeleteTournament(tournamentId) {
    const { error: err } = await supabase.rpc('admin_delete_tournament', {
      p_admin_id:      adminId,
      p_tournament_id: tournamentId,
    })
    if (err) throw new Error(err.message)
    setTournaments(prev => prev.filter(t => t.id !== tournamentId))
    setStats(prev => prev ? { ...prev, tournaments: Math.max(0, prev.tournaments - 1) } : prev)
    setDeleteTarget(null)
  }

  // Server-side search: debounce and reload from page 0
  useEffect(() => {
    const timer = setTimeout(() => {
      if (tab === 'users') { setUsersPage(0); loadUsers(0, search) }
      if (tab === 'tournaments') { setTournamentsPage(0); loadTournaments(0, search) }
    }, 300)
    return () => clearTimeout(timer)
  }, [search, tab])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <LoadingSpinner size="lg" text="Đang tải..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  const showSearch = tab === 'users' || tab === 'tournaments'

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
        </div>
        <p className="text-sm text-gray-500">Quản lý người dùng và giải đấu trên nền tảng</p>
      </div>

      {/* Stats row 1 */}
      {stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-3">
            <StatCard icon={Users}    label="Tổng users"      value={stats.total}       color="blue"    span={2} />
            <StatCard icon={Users}    label="Creator"          value={stats.creator}     color="purple" />
            <StatCard icon={Users}    label="VĐV"              value={stats.athlete}     color="green"  />
            <StatCard icon={Users}    label="Trọng tài"        value={stats.umpire}      color="cyan"   />
            <StatCard icon={Trophy}   label="Tổng giải"        value={stats.tournaments} color="orange" />
            <StatCard icon={Activity} label="Đang hoạt động"   value={stats.active}      color="emerald" />
            <StatCard icon={Ban}      label="Bị vô hiệu hóa"  value={stats.suspended ?? 0} color={stats.suspended > 0 ? 'red' : 'gray'} />
          </div>
          {/* Stats row 2 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <StatCard icon={Star}       label="Sub active"    value={stats.activeSubs}    color="purple"  />
            <StatCard icon={Activity}   label="Sắp hết hạn"  value={stats.expiringSoon}  color="yellow"  />
            <StatCard icon={CreditCard} label="Đơn chờ duyệt" value={stats.waitingOrders} color={stats.waitingOrders > 0 ? 'red' : 'gray'} />
            <StatCard icon={Trophy}     label={`Doanh thu T${new Date().getMonth() + 1}`} value={formatRevenue(stats.monthRevenue)} color="emerald" isText />
          </div>
        </>
      )}

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5 items-start">
        {showSearch && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tab === 'users' ? 'Tìm tên, SĐT, CLB...' : 'Tìm giải đấu...'}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
        <div className="flex flex-wrap gap-1 sm:ml-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              className={cn(
                'relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                tab === t.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              <t.Icon className="w-3.5 h-3.5" />
              {t.label}
              {t.id === 'orders' && pendingOrderCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] leading-none font-bold">
                  {pendingOrderCount > 9 ? '9+' : pendingOrderCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Users table */}
      {tab === 'users' && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Tên', 'SĐT', 'Role', 'Gói', 'Ngày tạo', 'Hành động'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {profiles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-400 text-sm">
                      Không tìm thấy người dùng nào.
                    </td>
                  </tr>
                ) : (
                  profiles.map(p => (
                    <UserRow
                      key={p.id}
                      profile={p}
                      sub={subMap[p.id] ?? null}
                      adminId={adminId}
                      onRoleChange={handleRoleChange}
                      onDeactivate={handleDeactivateUser}
                      onActivate={handleActivateUser}
                      onResetPassword={() => setResetTarget({ id: p.id, name: p.name })}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-400">
            <span>{usersPage * PAGE_SIZE + 1}–{Math.min((usersPage + 1) * PAGE_SIZE, usersTotalCount)} / {usersTotalCount} users</span>
            <div className="flex gap-2">
              <button
                onClick={() => setUsersPage(p => Math.max(0, p - 1))}
                disabled={usersPage === 0}
                className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100"
              >
                ‹ Trước
              </button>
              <button
                onClick={() => setUsersPage(p => p + 1)}
                disabled={(usersPage + 1) * PAGE_SIZE >= usersTotalCount}
                className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100"
              >
                Sau ›
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tournaments table */}
      {tab === 'tournaments' && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Tên giải', 'Creator', 'Trạng thái', 'Nội dung', 'Ngày tạo', 'Hành động'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tournaments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-400 text-sm">
                      Không tìm thấy giải đấu nào.
                    </td>
                  </tr>
                ) : (
                  tournaments.map(t => (
                    <tr
                      key={t.id}
                      onClick={() => navigate(`/tournament/${t.id}`)}
                      className={cn(
                        'cursor-pointer transition-colors group',
                        t.is_suspended ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-gray-50',
                      )}
                    >
                      <td className="px-4 py-3">
                        <p className={cn(
                          'font-medium group-hover:text-blue-700 transition-colors',
                          t.is_suspended ? 'text-red-700' : 'text-gray-900',
                        )}>
                          {t.name}
                        </p>
                        {t.is_suspended && t.suspended_reason && (
                          <p className="text-xs text-red-400 truncate max-w-[180px]" title={t.suspended_reason}>
                            {t.suspended_reason}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {t.profiles?.name ?? <span className="italic text-gray-300">–</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <Badge variant={TOURNAMENT_STATUS_BADGE[t.status] ?? 'default'}>
                            {STATUS_LABELS[t.status] ?? t.status}
                          </Badge>
                          {t.is_suspended && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">
                              <Ban className="w-2.5 h-2.5" />
                              Vô hiệu
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{t.events?.length ?? 0}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(t.created_at).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          {t.is_suspended ? (
                            <button
                              onClick={() => handleUnsuspendTournament(t.id)}
                              className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium hover:underline"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Kích hoạt
                            </button>
                          ) : (
                            <button
                              onClick={() => setSuspendTarget({ id: t.id, name: t.name })}
                              className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 font-medium hover:underline"
                            >
                              <Ban className="w-3 h-3" />
                              Vô hiệu hóa
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteTarget({ id: t.id, name: t.name })}
                            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium hover:underline"
                          >
                            <Trash2 className="w-3 h-3" />
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-400">
            <span>{tournamentsPage * PAGE_SIZE + 1}–{Math.min((tournamentsPage + 1) * PAGE_SIZE, tournamentsTotalCount)} / {tournamentsTotalCount} giải đấu</span>
            <div className="flex gap-2">
              <button
                onClick={() => setTournamentsPage(p => Math.max(0, p - 1))}
                disabled={tournamentsPage === 0}
                className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100"
              >
                ‹ Trước
              </button>
              <button
                onClick={() => setTournamentsPage(p => p + 1)}
                disabled={(tournamentsPage + 1) * PAGE_SIZE >= tournamentsTotalCount}
                className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100"
              >
                Sau ›
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lazy-mounted tab components */}
      {visited.current.has('orders') && (
        <div className={cn(tab !== 'orders' && 'hidden')}>
          <OrdersTab adminId={adminId} />
        </div>
      )}
      {visited.current.has('plans') && (
        <div className={cn(tab !== 'plans' && 'hidden')}>
          <PlansTab adminId={adminId} />
        </div>
      )}
      {visited.current.has('subscriptions') && (
        <div className={cn(tab !== 'subscriptions' && 'hidden')}>
          <SubscriptionsTab adminId={adminId} />
        </div>
      )}
      {visited.current.has('settings') && (
        <div className={cn(tab !== 'settings' && 'hidden')}>
          <SettingsTab adminId={adminId} />
        </div>
      )}
      {visited.current.has('audit') && (
        <div className={cn(tab !== 'audit' && 'hidden')}>
          <AuditLogTab adminId={adminId} />
        </div>
      )}

      {resetTarget && (
        <ResetPasswordModal
          target={resetTarget}
          adminId={adminId}
          onClose={() => setResetTarget(null)}
          onConfirm={handleResetPassword}
        />
      )}

      {suspendTarget && (
        <SuspendTournamentModal
          target={suspendTarget}
          onClose={() => setSuspendTarget(null)}
          onConfirm={handleSuspendTournament}
        />
      )}

      {deleteTarget && (
        <DeleteTournamentModal
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteTournament}
        />
      )}
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

const COLOR_MAP = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    icon: 'text-blue-400'    },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-600',  icon: 'text-purple-400'  },
  green:   { bg: 'bg-green-50',   text: 'text-green-600',   icon: 'text-green-400'   },
  cyan:    { bg: 'bg-cyan-50',    text: 'text-cyan-600',    icon: 'text-cyan-400'    },
  orange:  { bg: 'bg-orange-50',  text: 'text-orange-600',  icon: 'text-orange-400'  },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'text-emerald-400' },
  yellow:  { bg: 'bg-yellow-50',  text: 'text-yellow-600',  icon: 'text-yellow-400'  },
  red:     { bg: 'bg-red-50',     text: 'text-red-600',     icon: 'text-red-400'     },
  gray:    { bg: 'bg-gray-50',    text: 'text-gray-500',    icon: 'text-gray-400'    },
}

function StatCard({ icon, label, value, color = 'blue', span, isText }) {
  const Icon = icon
  const c = COLOR_MAP[color] ?? COLOR_MAP.blue
  return (
    <div className={cn(
      'bg-white border border-gray-200 rounded-xl p-4',
      span === 2 ? 'col-span-2' : ''
    )}>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', c.bg)}>
          <Icon className={cn('w-3.5 h-3.5', c.icon)} />
        </div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
      </div>
      <p className={cn('text-2xl font-bold', c.text)}>{isText ? value : (value ?? 0)}</p>
    </div>
  )
}

// ── User row ──────────────────────────────────────────────────────────────────

function UserRow({ profile, sub, adminId, onRoleChange, onDeactivate, onActivate, onResetPassword }) {
  const [editing, setEditing] = useState(false)
  const [newRole, setNewRole] = useState(profile.role)
  const [saving, setSaving]   = useState(false)

  async function confirmChange() {
    if (newRole === profile.role) { setEditing(false); return }
    setSaving(true)
    await onRoleChange(profile.id, newRole)
    setSaving(false)
    setEditing(false)
  }

  function cancel() { setNewRole(profile.role); setEditing(false) }

  async function handleToggleActive() {
    const action = profile.is_active ? 'vô hiệu hóa' : 'kích hoạt lại'
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} tài khoản ${profile.name}?`)) return
    if (profile.is_active) {
      await onDeactivate(profile.id)
    } else {
      await onActivate(profile.id)
    }
  }

  const cfg = ROLE_CONFIG[profile.role] ?? { label: profile.role, badge: 'default' }
  const isSelf = profile.id === adminId

  // Subscription badge for creator
  let subBadge = null
  if (profile.role === 'creator') {
    if (sub) {
      const d = daysLeft(sub.expires_at)
      const isExpiringSoon = d !== null && d >= 0 && d <= 7
      subBadge = (
        <span className={cn(
          'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
          isExpiringSoon
            ? 'bg-yellow-100 text-yellow-700'
            : 'bg-green-100 text-green-700'
        )}>
          {sub.plan?.name ?? 'Sub'}
          {d !== null && <> · {d}n</>}
        </span>
      )
    } else {
      subBadge = (
        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
          Free
        </span>
      )
    }
  }

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-gray-900">{profile.name ?? <span className="italic text-gray-300">–</span>}</p>
          {profile.is_active === false && (
            <span className="text-[10px] bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded-full">Vô hiệu</span>
          )}
        </div>
        {profile.club && <p className="text-xs text-gray-400">{profile.club}</p>}
      </td>
      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{profile.phone}</td>
      <td className="px-4 py-3">
        {editing ? (
          <select
            value={newRole}
            onChange={e => setNewRole(e.target.value)}
            autoFocus
            className="text-xs border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ROLES.map(r => (
              <option key={r} value={r}>{ROLE_CONFIG[r]?.label ?? r}</option>
            ))}
          </select>
        ) : (
          <Badge variant={cfg.badge}>{cfg.label}</Badge>
        )}
      </td>
      <td className="px-4 py-3">{subBadge ?? <span className="text-gray-300 text-sm">—</span>}</td>
      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
        {new Date(profile.created_at).toLocaleDateString('vi-VN')}
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={confirmChange}
              disabled={saving}
              className="flex items-center gap-1 text-xs text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <Check className="w-3 h-3" />
              {saving ? '...' : 'Lưu'}
            </button>
            <button
              onClick={cancel}
              className="flex items-center gap-1 text-xs text-gray-600 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <X className="w-3 h-3" />
              Huỷ
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
            >
              Đổi role
            </button>
            <button
              onClick={onResetPassword}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium hover:underline"
            >
              <KeyRound className="w-3 h-3 inline mr-0.5" />
              Reset PW
            </button>
            {!isSelf && (
              <button
                onClick={handleToggleActive}
                className={cn(
                  'text-xs font-medium hover:underline',
                  profile.is_active === false ? 'text-green-600 hover:text-green-700' : 'text-red-500 hover:text-red-600',
                )}
              >
                {profile.is_active === false ? 'Kích hoạt' : 'Vô hiệu hóa'}
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

// ── Reset Password Modal ───────────────────────────────────────────────────────

function ResetPasswordModal({ target, onClose, onConfirm }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPw, setConfirmPw]     = useState('')
  const [saving, setSaving]           = useState(false)
  const [err, setErr]                 = useState(null)

  async function handleConfirm() {
    if (newPassword !== confirmPw) { setErr('Mật khẩu xác nhận không khớp.'); return }
    if (newPassword.length < 6) { setErr('Mật khẩu phải có ít nhất 6 ký tự.'); return }
    setSaving(true)
    try {
      await onConfirm(target.id, newPassword)
    } catch (e) {
      setErr(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-1">Reset mật khẩu</h3>
        <p className="text-sm text-gray-500 mb-5">{target.name}</p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mật khẩu mới</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setErr(null) }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tối thiểu 6 ký tự"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Xác nhận mật khẩu mới</label>
            <input
              type="password"
              value={confirmPw}
              onChange={e => { setConfirmPw(e.target.value); setErr(null) }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>
        </div>

        {err && <p className="text-sm text-red-600 mt-3">{err}</p>}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Huỷ
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Đang reset...' : 'Xác nhận reset'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Suspend Tournament Modal ───────────────────────────────────────────────────

function SuspendTournamentModal({ target, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState(null)

  async function handleConfirm() {
    setSaving(true)
    try {
      await onConfirm(target.id, reason.trim())
    } catch (e) {
      setErr(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center gap-2 mb-1">
          <Ban className="w-5 h-5 text-orange-500" />
          <h3 className="font-semibold text-gray-900">Vô hiệu hóa giải đấu</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Giải đấu <span className="font-medium text-gray-800">{target.name}</span> sẽ bị khóa.
          Creator không thể tiếp tục xử lý cho đến khi admin kích hoạt lại.
        </p>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Lý do (hiển thị cho creator)</label>
          <textarea
            value={reason}
            onChange={e => { setReason(e.target.value); setErr(null) }}
            rows={3}
            autoFocus
            placeholder="VD: Vi phạm điều khoản sử dụng — nội dung không phù hợp..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          />
        </div>

        {err && <p className="text-sm text-red-600 mt-2">{err}</p>}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Huỷ
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 py-2.5 bg-orange-500 text-white font-semibold rounded-xl text-sm hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Đang xử lý...' : 'Vô hiệu hóa'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Tournament Modal ────────────────────────────────────────────────────

function DeleteTournamentModal({ target, onClose, onConfirm }) {
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState(null)

  const isMatch = confirm.trim() === target.name

  async function handleConfirm() {
    if (!isMatch) return
    setSaving(true)
    try {
      await onConfirm(target.id)
    } catch (e) {
      setErr(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center gap-2 mb-1">
          <Trash2 className="w-5 h-5 text-red-500" />
          <h3 className="font-semibold text-gray-900">Xóa giải đấu</h3>
        </div>
        <p className="text-sm text-gray-500 mb-1">
          Hành động này <span className="font-semibold text-red-600">không thể hoàn tác</span>.
          Tất cả dữ liệu (nội dung, VĐV, kết quả, trận đấu) sẽ bị xóa vĩnh viễn.
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Nhập tên giải đấu để xác nhận:
          <span className="block font-mono font-semibold text-gray-800 mt-1 bg-gray-100 px-2 py-1 rounded text-xs">
            {target.name}
          </span>
        </p>

        <input
          type="text"
          value={confirm}
          onChange={e => { setConfirm(e.target.value); setErr(null) }}
          autoFocus
          placeholder="Nhập tên giải đấu..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />

        {err && <p className="text-sm text-red-600 mt-2">{err}</p>}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Huỷ
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || !isMatch}
            className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-xl text-sm hover:bg-red-700 transition-colors disabled:opacity-40"
          >
            {saving ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
          </button>
        </div>
      </div>
    </div>
  )
}
