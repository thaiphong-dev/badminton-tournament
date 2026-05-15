import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'

/**
 * Bảo vệ route theo role.
 * strictVerify=true: chờ server verify token xong mới render — dùng cho /admin.
 * Nếu verify_session gặp lỗi mạng và strictVerify=true → fail-closed (redirect login).
 */
export default function ProtectedRoute({ allowedRoles, children, strictVerify = false }) {
  const { profile, role, verified, verifyFailed } = useAuth()

  // Admin routes: fail-closed khi verify gặp lỗi mạng (không dùng cache role)
  if (strictVerify && verifyFailed) {
    return <Navigate to="/login" replace />
  }

  // Chờ server verify xong mới render (ngăn localStorage spoofing)
  if (strictVerify && !verified) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!profile) return <Navigate to="/login" replace />

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}
