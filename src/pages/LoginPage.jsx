import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Trophy, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useAuth, loginWithPhone, defaultPathForRole } from '@/lib/hooks/useAuth'

export default function LoginPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { profile } = useAuth()

  const [phone, setPhone]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const returnTo = new URLSearchParams(location.search).get('returnTo') || null

  // Đã đăng nhập → redirect ngay (tới returnTo nếu có, ngược lại tới dashboard)
  useEffect(() => {
    if (profile) navigate(returnTo ?? defaultPathForRole(profile.role), { replace: true })
  }, [profile])

  async function handleSubmit(e) {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 9) { setError('Số điện thoại không hợp lệ.'); return }

    setError('')
    setLoading(true)
    try {
      const prof = await loginWithPhone(phone, password)
      navigate(returnTo ?? defaultPathForRole(prof.role), { replace: true })
    } catch (err) {
      const msg = err.message ?? ''
      if (msg.includes('too_many_attempts')) {
        setError('Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.')
      } else if (msg.includes('account_deactivated')) {
        setError('Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ admin.')
      } else if (msg.includes('invalid_credentials') || msg.includes('Invalid')) {
        setError('Số điện thoại hoặc mật khẩu không đúng.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  if (profile) return null  // tránh flash form

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-3 hover:bg-blue-700 transition-colors">
            <Trophy className="w-7 h-7 text-white" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Badminton Tournament</h1>
          <p className="text-gray-500 text-sm mt-1">Đăng nhập để tiếp tục</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4"
        >
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Số điện thoại
            </label>
            <input
              type="tel"
              required
              autoFocus
              value={phone}
              onChange={e => { setPhone(e.target.value); setError('') }}
              placeholder="0901 234 567"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                required
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Đăng nhập
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="text-blue-600 font-medium hover:underline">
            Đăng ký
          </Link>
        </p>
      </div>
    </div>
  )
}
