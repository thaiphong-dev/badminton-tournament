import { useCallback } from 'react'

export function showToast(message, type = 'error') {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }))
}

export function useApiError() {
  const handleError = useCallback((error, context = '') => {
    console.error(`[API Error] ${context}:`, error)

    if (!navigator.onLine) {
      showToast('Mất kết nối mạng. Vui lòng kiểm tra internet.')
      return
    }

    const msg = error?.message || ''

    if (msg.includes('TOO_MANY_ATTEMPTS')) {
      showToast('Quá nhiều lần thử. Vui lòng đợi và thử lại sau.')
      return
    }

    if (msg.includes('JWT') || msg.includes('expired') || msg.includes('invalid token')) {
      showToast('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.')
      setTimeout(() => {
        localStorage.removeItem('bt_session')
        window.dispatchEvent(new Event('auth-change'))
      }, 1500)
      return
    }

    showToast(context ? `Lỗi: ${context}` : 'Đã có lỗi xảy ra. Vui lòng thử lại.')
  }, [])

  return { handleError }
}
