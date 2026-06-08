import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Trophy, Loader2, AlertCircle, ChevronLeft, Eye, EyeOff } from 'lucide-react'
import { useAuth, registerWithPhone, defaultPathForRole } from '@/lib/hooks/useAuth'
import { sanitizeAndTrim } from '@/lib/utils/sanitize'

const ROLES = [
  { key: 'creator', emoji: '🏆', title: 'Creator',        desc: 'Tổ chức và quản lý giải đấu' },
  { key: 'athlete', emoji: '🏸', title: 'Vận động viên',  desc: 'Đăng ký thi đấu tại các giải' },
  { key: 'umpire',  emoji: '🦺', title: 'Trọng tài',      desc: 'Điều hành và ghi nhận kết quả trận đấu' },
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [step, setStep]           = useState('role')  // 'role' | 'form'
  const [selectedRole, setRole]   = useState(null)
  const [name, setName]           = useState('')
  const [phone, setPhone]         = useState('')
  const [password, setPassword]   = useState('')
  const [club, setClub]           = useState('')
  const [gender, setGender]       = useState('')
  const [dob, setDob]             = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  useEffect(() => {
    if (profile) navigate(defaultPathForRole(profile.role), { replace: true })
  }, [profile])

  async function handleSubmit(e) {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 9) { setError('Số điện thoại không hợp lệ (ít nhất 9 chữ số).'); return }
    if (password.length < 8) { setError('Mật khẩu tối thiểu 8 ký tự.'); return }
    if (selectedRole === 'athlete') {
      if (!gender) { setError('Vui lòng chọn giới tính.'); return }
      if (!dob) { setError('Vui lòng nhập ngày tháng năm sinh.'); return }
      const dobDate = new Date(dob)
      if (isNaN(dobDate.getTime()) || dobDate >= new Date()) {
        setError('Ngày sinh không hợp lệ.')
        return
      }
    }

    setError('')
    setLoading(true)
    try {
      const safeName = sanitizeAndTrim(name.trim(), 100)
      const safeClub = (selectedRole === 'athlete' && club.trim())
        ? sanitizeAndTrim(club.trim(), 100)
        : null
      const prof = await registerWithPhone(
        phone.trim(), password, safeName, selectedRole, safeClub,
        selectedRole === 'athlete' ? gender : null,
        selectedRole === 'athlete' ? dob    : null,
      )
      navigate(defaultPathForRole(prof.role), { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (profile) return null

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-3">
            <Trophy className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Tạo tài khoản</h1>
        </div>

        {/* ── Bước 1: Chọn vai trò ── */}
        {step === 'role' && (
          <div className="space-y-3">
            <p className="text-center text-gray-600 text-sm mb-4">Bạn tham gia với tư cách?</p>

            {ROLES.map(r => (
              <button
                key={r.key}
                onClick={() => { setRole(r.key); setStep('form') }}
                className="w-full flex items-center gap-4 p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
              >
                <span className="text-2xl">{r.emoji}</span>
                <div>
                  <p className="font-semibold text-gray-900">{r.title}</p>
                  <p className="text-xs text-gray-500">{r.desc}</p>
                </div>
              </button>
            ))}

            <p className="text-center text-sm text-gray-500 pt-2">
              Đã có tài khoản?{' '}
              <Link to="/login" className="text-blue-600 font-medium hover:underline">
                Đăng nhập
              </Link>
            </p>
          </div>
        )}

        {/* ── Bước 2: Điền thông tin ── */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">

            {/* Back + role badge */}
            <div className="flex items-center gap-3 -mt-1 mb-1">
              <button
                type="button"
                onClick={() => { setStep('role'); setError('') }}
                className="text-gray-400 hover:text-gray-600"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-medium text-blue-700 bg-blue-50 rounded-lg px-3 py-1">
                {ROLES.find(r => r.key === selectedRole)?.emoji}{' '}
                {ROLES.find(r => r.key === selectedRole)?.title}
              </span>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Họ và tên *</label>
              <input
                type="text"
                required
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Số điện thoại *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={e => { setPhone(e.target.value); setError('') }}
                placeholder="0901 234 567"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu * (≥ 8 ký tự)</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {selectedRole === 'athlete' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Giới tính <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={gender}
                    onChange={e => { setGender(e.target.value); setError('') }}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">-- Chọn giới tính --</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Ngày sinh <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={dob}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => { setDob(e.target.value); setError('') }}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Dùng để xét nhóm tuổi và xác nhận nội dung đơn/đôi.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Tên CLB / Đội <span className="text-gray-400 font-normal">(tuỳ chọn)</span>
                  </label>
                  <input
                    type="text"
                    value={club}
                    onChange={e => setClub(e.target.value)}
                    placeholder="CLB Cầu Lông XYZ"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Tạo tài khoản
            </button>

            <p className="text-center text-xs text-gray-400 mt-3">
              Khi đăng ký, bạn đồng ý với{' '}
              <Link to="/terms" className="text-blue-500 hover:underline">Điều khoản sử dụng</Link>
              {' '}và{' '}
              <Link to="/privacy" className="text-blue-500 hover:underline">Chính sách bảo mật</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
