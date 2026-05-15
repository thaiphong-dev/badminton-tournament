import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { cn } from '@/lib/utils/cn'
import { sanitizeAndTrim } from '@/lib/utils/sanitize'

const ROLE_LABELS = {
  admin:   'Admin',
  creator: 'Creator',
  athlete: 'Vận động viên',
  umpire:  'Trọng tài',
}

const ROLE_COLORS = {
  admin:   'bg-red-100 text-red-700',
  creator: 'bg-blue-100 text-blue-700',
  athlete: 'bg-green-100 text-green-700',
  umpire:  'bg-yellow-100 text-yellow-700',
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { profile, role } = useAuth()

  const [name, setName]                   = useState(profile?.name ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg]       = useState(null)

  const [oldPw, setOldPw]       = useState('')
  const [newPw, setNewPw]       = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg, setPwMsg]       = useState(null)

  useEffect(() => {
    if (!profile) navigate('/login')
  }, [profile])

  function updateProfileInStorage(newName) {
    const stored = JSON.parse(localStorage.getItem('bt_session') || 'null')
    if (stored) {
      stored.name = newName
      localStorage.setItem('bt_session', JSON.stringify(stored))
      window.dispatchEvent(new Event('auth-change'))
    }
  }

  async function handleSaveProfile() {
    if (name.trim().length < 2) {
      setProfileMsg({ ok: false, text: 'Tên phải có ít nhất 2 ký tự.' })
      return
    }
    const safeName = sanitizeAndTrim(name, 100)
    setSavingProfile(true)
    const { error } = await supabase.rpc('update_my_profile', {
      p_user_id: profile.id,
      p_name: safeName,
    })
    setSavingProfile(false)
    if (error) {
      setProfileMsg({ ok: false, text: error.message })
      return
    }
    updateProfileInStorage(safeName)
    setProfileMsg({ ok: true, text: 'Đã cập nhật tên.' })
    setTimeout(() => setProfileMsg(null), 3000)
  }

  async function handleChangePassword() {
    if (newPw !== confirmPw) {
      setPwMsg({ ok: false, text: 'Mật khẩu xác nhận không khớp.' })
      return
    }
    if (newPw.length < 6) {
      setPwMsg({ ok: false, text: 'Mật khẩu mới phải có ít nhất 6 ký tự.' })
      return
    }
    setSavingPw(true)
    const { error } = await supabase.rpc('change_my_password', {
      p_user_id:      profile.id,
      p_old_password: oldPw,
      p_new_password: newPw,
    })
    setSavingPw(false)
    if (error) {
      if (error.message.includes('wrong_password')) {
        setPwMsg({ ok: false, text: 'Mật khẩu hiện tại không đúng.' })
      } else if (error.message.includes('too_many_password_changes')) {
        setPwMsg({ ok: false, text: 'Bạn đổi mật khẩu quá nhiều lần. Vui lòng thử lại sau 10 phút.' })
      } else {
        setPwMsg({ ok: false, text: error.message })
      }
      return
    }
    setOldPw('')
    setNewPw('')
    setConfirmPw('')
    setPwMsg({ ok: true, text: 'Đổi mật khẩu thành công!' })
    setTimeout(() => setPwMsg(null), 3000)
  }

  if (!profile) return null

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Trang chủ
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Hồ sơ cá nhân</h1>

      {/* Card 1 — Profile info */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Thông tin cá nhân</h2>

        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Số điện thoại</p>
            <p className="font-mono text-sm text-gray-500">{profile.phone}</p>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Vai trò</p>
            <span className={cn(
              'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold',
              ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-600',
            )}>
              {ROLE_LABELS[role] ?? role}
            </span>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Tên hiển thị</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setProfileMsg(null) }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập tên của bạn"
            />
          </div>

          {profileMsg && (
            <p className={cn('text-sm', profileMsg.ok ? 'text-green-600' : 'text-red-600')}>
              {profileMsg.text}
            </p>
          )}

          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
          >
            {savingProfile ? 'Đang lưu...' : 'Lưu tên'}
          </button>
        </div>
      </div>

      {/* Card 2 — Password */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Đổi mật khẩu</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mật khẩu hiện tại</label>
            <input
              type="password"
              value={oldPw}
              onChange={e => { setOldPw(e.target.value); setPwMsg(null) }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Mật khẩu mới</label>
            <input
              type="password"
              value={newPw}
              onChange={e => { setNewPw(e.target.value); setPwMsg(null) }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tối thiểu 6 ký tự"
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Xác nhận mật khẩu mới</label>
            <input
              type="password"
              value={confirmPw}
              onChange={e => { setConfirmPw(e.target.value); setPwMsg(null) }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          {pwMsg && (
            <p className={cn('text-sm', pwMsg.ok ? 'text-green-600' : 'text-red-600')}>
              {pwMsg.text}
            </p>
          )}

          <button
            onClick={handleChangePassword}
            disabled={savingPw || !oldPw || !newPw || !confirmPw}
            className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
          >
            {savingPw ? 'Đang đổi...' : 'Đổi mật khẩu'}
          </button>
        </div>
      </div>
    </div>
  )
}
