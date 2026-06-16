import { Loader2 } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/hooks/useAuth'

function NotFound() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-24 text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
      <p className="text-gray-500">Trang không tìm thấy</p>
    </div>
  )
}

/**
 * Bảo vệ route theo role. Unauthorized → 404 (không redirect).
 * strictVerify=true: chờ server verify token xong mới render — dùng cho /admin.
 */
export default function ProtectedRoute({ allowedRoles, children, strictVerify = false }) {
  const { profile, role, verified, verifyFailed } = useAuth()
  const location = useLocation()

  // Admin routes: fail-closed khi verify gặp lỗi mạng
  if (strictVerify && verifyFailed) return <NotFound />

  // Wait for session check before deciding — prevents flash redirect in production
  if (!verified) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  // Chưa đăng nhập → redirect về /login với returnTo để quay lại sau khi login
  if (!profile) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} replace />
  }

  // Đã đăng nhập nhưng sai role → 404
  if (allowedRoles && !allowedRoles.includes(role)) return <NotFound />

  return children
}
