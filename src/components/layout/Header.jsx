import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Trophy, ChevronDown, LogOut, Shield, User } from 'lucide-react'
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

  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleLogout() {
    setOpen(false)
    await signOut()
    navigate('/login')
  }

  const navLinks = [{ to: '/', label: t('nav.home') }]

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

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      {showExpireWarning && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs text-center py-1.5 px-4">
          {t('session.expiresWarning', { days: sessionDaysLeft })}
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link
            to={defaultPathForRole(role)}
            className="flex items-center gap-2 text-blue-600 font-bold text-lg hover:text-blue-700 transition-colors"
          >
            <Trophy className="w-6 h-6" />
            <span>Badminton Tournament</span>
          </Link>

          {/* Nav + User */}
          <div className="flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  location.pathname === link.to
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
                )}
              >
                {link.label}
              </Link>
            ))}

            {/* Creator plan links */}
            {role === 'creator' && (
              <>
                <Link
                  to="/creator/subscription"
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    location.pathname === '/creator/subscription'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
                  )}
                >
                  {t('nav.myPlan')}
                </Link>
                <Link
                  to="/addon-shop"
                  className={cn(
                    'px-3 py-2 rounded-lg text-xs transition-colors',
                    location.pathname === '/addon-shop'
                      ? 'text-blue-600'
                      : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  {t('nav.buyMore')}
                </Link>
                <Link
                  to="/plans"
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    location.pathname === '/plans'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
                  )}
                >
                  {t('nav.plans')}
                </Link>
              </>
            )}
            {!profile && (
              <Link
                to="/plans"
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  location.pathname === '/plans'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
                )}
              >
                {t('nav.pricing')}
              </Link>
            )}

            {/* Language switcher */}
            <div className="ml-1 mr-1">
              <LanguageSwitcher />
            </div>

            {/* Notification bell */}
            {(role === 'creator' || role === 'admin' || role === 'athlete') && profile && (
              <NotificationBell userId={profile.id} role={role} />
            )}

            {/* Creator/Admin: create tournament button */}
            {(role === 'creator' || role === 'admin') && (
              <Link
                to="/tournament/create"
                className="ml-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('nav.createTournament')}
              </Link>
            )}

            {/* User section */}
            {profile ? (
              <div className="relative ml-3" ref={dropdownRef}>
                <button
                  onClick={() => setOpen(v => !v)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                    ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-600',
                  )}>
                    {initials}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-gray-900 leading-tight max-w-[120px] truncate">
                      {profile.name}
                    </p>
                    <p className="text-xs text-gray-500">{t(`role.${role}`) || role}</p>
                  </div>
                  <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', open && 'rotate-180')} />
                </button>

                {open && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-xs font-medium text-gray-900 truncate">{profile.name}</p>
                      <p className="text-xs text-gray-500 truncate">{profile.phone}</p>
                    </div>
                    {role === 'admin' && (
                      <Link
                        to="/admin"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Shield className="w-4 h-4 text-gray-400" />
                        {t('nav.adminPanel')}
                      </Link>
                    )}
                    <Link
                      to="/profile"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <User className="w-4 h-4 text-gray-400" />
                      {t('nav.profile')}
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-gray-400" />
                      {t('nav.logout')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="ml-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
              >
                {t('nav.login')}
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
