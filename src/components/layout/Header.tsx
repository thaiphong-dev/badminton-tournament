import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Trophy, ChevronDown, LogOut, Shield, User, TrendingUp, Menu, X, Plus } from 'lucide-react'
import { useAuth, defaultPathForRole } from '@/lib/hooks/useAuth'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils/cn'
import NotificationBell from '@/components/ui/NotificationBell'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'

const ROLE_COLORS = {
  admin:   'bg-red-100 text-red-700',
  creator: 'bg-blue-100 text-blue-700',
  athlete: 'bg-green-100 text-green-700',
  umpire:  'bg-yellow-100 text-yellow-700',
}

export default function Header() {
  const location = useLocation()
  const navigate  = useNavigate()
  const { profile, role, signOut } = useAuth()
  const { t } = useI18n()

  const [userOpen,   setUserOpen]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setUserOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile menu on navigation
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  async function handleLogout() {
    setUserOpen(false)
    setMobileOpen(false)
    await signOut()
    navigate('/login')
  }

  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()
    : '?'

  const sessionDaysLeft = (() => {
    try {
      const s = JSON.parse(localStorage.getItem('bt_session') || 'null')
      if (!s?.expiresAt) return null
      return Math.ceil((new Date(s.expiresAt) - Date.now()) / (1000 * 60 * 60 * 24))
    } catch { return null }
  })()
  const showExpireWarning = profile && sessionDaysLeft !== null && sessionDaysLeft <= 3 && sessionDaysLeft > 0

  // Nav links per role
  const creatorLinks = [
    { to: '/',                    label: t('nav.home') },
    { to: '/creator/subscription', label: t('nav.myPlan') },
    { to: '/creator/analytics',   label: 'Thống kê', icon: TrendingUp },
    { to: '/addon-shop',          label: t('nav.buyMore') },
    { to: '/plans',               label: t('nav.plans') },
  ]
  const publicLinks = [
    { to: '/',      label: t('nav.home') },
    { to: '/plans', label: t('nav.pricing') },
  ]
  const navLinks = role === 'creator' ? creatorLinks : publicLinks

  function NavLink({ to, label, icon: Icon, onClick }) {
    const active = location.pathname === to
    return (
      <Link
        to={to}
        onClick={onClick}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          active ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
        )}
      >
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
        {label}
      </Link>
    )
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      {showExpireWarning && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs text-center py-1.5 px-4">
          {t('session.expiresWarning', { days: sessionDaysLeft })}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 md:h-16 gap-2">

          {/* ── Logo ── */}
          <Link
            to={defaultPathForRole(role)}
            className="flex items-center gap-2 text-blue-600 font-bold text-base md:text-lg hover:text-blue-700 transition-colors shrink-0"
          >
            <Trophy className="w-5 h-5 md:w-6 md:h-6" />
            <span className="hidden xs:inline sm:inline">Badminton</span>
            <span className="hidden md:inline">Tournament</span>
          </Link>

          {/* ── Desktop nav (lg+) ── */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1 mx-2">
            <NavLink to="/" label={t('nav.home')} />
            {role === 'creator' && (
              <>
                <NavLink to="/creator/subscription" label={t('nav.myPlan')} />
                <NavLink to="/creator/analytics"    label="Thống kê" icon={TrendingUp} />
                <NavLink to="/addon-shop"           label={t('nav.buyMore')} />
                <NavLink to="/plans"                label={t('nav.plans')} />
              </>
            )}
            {!profile && <NavLink to="/plans" label={t('nav.pricing')} />}
          </nav>

          {/* ── Right side ── */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Language switcher — desktop only */}
            <div className="hidden lg:block">
              <LanguageSwitcher />
            </div>

            {/* Notification bell */}
            {(role === 'creator' || role === 'admin' || role === 'athlete') && profile && (
              <NotificationBell userId={profile.id} role={role} />
            )}

            {/* Create tournament: icon on mobile, full button on desktop */}
            {(role === 'creator' || role === 'admin') && (
              <Link
                to="/tournament/create"
                className="flex items-center gap-1.5 px-2.5 py-1.5 lg:px-4 lg:py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="hidden lg:inline">{t('nav.createTournament')}</span>
              </Link>
            )}

            {/* User avatar / login */}
            {profile ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setUserOpen(v => !v)}
                  className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                    ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-600',
                  )}>
                    {initials}
                  </div>
                  <div className="hidden lg:block text-left">
                    <p className="text-xs font-medium text-gray-900 leading-tight max-w-[96px] truncate">
                      {profile.name}
                    </p>
                    <p className="text-xs text-gray-400">{t(`role.${role}`) || role}</p>
                  </div>
                  <ChevronDown className={cn('hidden lg:block w-3.5 h-3.5 text-gray-400 transition-transform', userOpen && 'rotate-180')} />
                </button>

                {userOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-xs font-medium text-gray-900 truncate">{profile.name}</p>
                      <p className="text-xs text-gray-500 truncate">{profile.phone}</p>
                    </div>
                    {role === 'admin' && (
                      <Link to="/admin" onClick={() => setUserOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <Shield className="w-4 h-4 text-gray-400" />
                        {t('nav.adminPanel')}
                      </Link>
                    )}
                    <Link to="/profile" onClick={() => setUserOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <User className="w-4 h-4 text-gray-400" />
                      {t('nav.profile')}
                    </Link>
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <LogOut className="w-4 h-4 text-gray-400" />
                      {t('nav.logout')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login"
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
                {t('nav.login')}
              </Link>
            )}

            {/* Hamburger — below lg */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5 text-gray-600" /> : <Menu className="w-5 h-5 text-gray-600" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile drawer (below lg) ── */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-gray-100 bg-white px-4 pb-4 pt-2 space-y-1 shadow-lg">
          <NavLink to="/" label={t('nav.home')} onClick={() => setMobileOpen(false)} />
          {role === 'creator' && (
            <>
              <NavLink to="/creator/subscription" label={t('nav.myPlan')}   onClick={() => setMobileOpen(false)} />
              <NavLink to="/creator/analytics"    label="Thống kê" icon={TrendingUp} onClick={() => setMobileOpen(false)} />
              <NavLink to="/addon-shop"           label={t('nav.buyMore')}  onClick={() => setMobileOpen(false)} />
              <NavLink to="/plans"                label={t('nav.plans')}    onClick={() => setMobileOpen(false)} />
            </>
          )}
          {!profile && (
            <NavLink to="/plans" label={t('nav.pricing')} onClick={() => setMobileOpen(false)} />
          )}
          {role === 'admin' && (
            <NavLink to="/admin" label={t('nav.adminPanel')} icon={Shield} onClick={() => setMobileOpen(false)} />
          )}
          {/* Language switcher in mobile menu */}
          <div className="pt-2 border-t border-gray-100">
            <LanguageSwitcher />
          </div>
        </div>
      )}
    </header>
  )
}
