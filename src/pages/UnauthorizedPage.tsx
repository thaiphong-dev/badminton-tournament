import { useNavigate } from 'react-router-dom'
import { ShieldOff, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { defaultPathForRole } from '@/lib/hooks/useAuth'

export default function UnauthorizedPage() {
  const navigate = useNavigate()
  const { role, signOut } = useAuth()

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <ShieldOff className="w-16 h-16 text-gray-300 mb-4" />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Không có quyền truy cập</h1>
      <p className="text-gray-500 mb-8">Tài khoản của bạn không có quyền xem trang này.</p>
      <div className="flex gap-3">
        <button
          onClick={() => navigate(defaultPathForRole(role))}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Về trang chủ
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Đăng xuất
        </button>
      </div>
    </div>
  )
}
