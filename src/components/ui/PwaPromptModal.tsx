import { useState, useEffect } from 'react'
import { Bell, BellOff, X } from 'lucide-react'
import { usePushSubscription } from '@/lib/hooks/usePushSubscription'

const STORAGE_KEY = 'pwa_prompt_last_shown'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function hasShownToday() {
  return localStorage.getItem(STORAGE_KEY) === todayStr()
}

function markShownToday() {
  localStorage.setItem(STORAGE_KEY, todayStr())
}

export default function PwaPromptModal({ userId, role }) {
  const [visible, setVisible] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const { supported, permission, subscribed, subscribing, subscribe } = usePushSubscription(userId)

  useEffect(() => {
    if (!userId) return
    if (role === 'admin') return
    if (subscribed) return
    if (hasShownToday()) return

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
    setIsIOS(ios)
    setIsStandalone(standalone)

    const shouldShow = (ios && !standalone) || (supported && permission !== 'denied')
    if (!shouldShow) return

    // Delay slightly so the page finishes loading before the modal appears
    const timer = setTimeout(() => setVisible(true), 2000)
    return () => clearTimeout(timer)
  }, [userId, role, supported, permission, subscribed])

  function handleDismiss() {
    markShownToday()
    setVisible(false)
  }

  async function handleEnable() {
    await subscribe()
    markShownToday()
    setVisible(false)
  }

  if (!visible) return null

  const showIosInstructions = isIOS && !isStandalone

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[200] p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">
                {showIosInstructions ? 'Cài đặt Ứng dụng (PWA)' : 'Bật thông báo đẩy'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {showIosInstructions ? 'Nhận Push notification trên iOS' : 'Nhận thông báo kịp thời nhất'}
              </p>
            </div>
          </div>
          <button onClick={handleDismiss} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors -mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-2">
          {showIosInstructions ? (
            <div className="space-y-3 text-sm text-gray-600">
              <p className="leading-relaxed">
                Để nhận thông báo đẩy trên iPhone/iPad, bạn cần thêm ứng dụng vào Màn hình chính (Home Screen):
              </p>
              <ol className="list-decimal pl-5 space-y-2 text-xs text-gray-500">
                <li>
                  Nhấn vào biểu tượng <strong>Chia sẻ (Share)</strong> <span className="inline-block bg-gray-100 border px-1.5 py-0.5 rounded font-mono">↑</span> ở thanh dưới cùng Safari.
                </li>
                <li>
                  Cuộn xuống dưới và chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong>.
                </li>
                <li>
                  Mở ứng dụng từ Màn hình chính và đăng nhập để kích hoạt thông báo đẩy.
                </li>
              </ol>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 leading-relaxed">
                Sử dụng <strong>tính năng PWA</strong> để nhận thông báo ngay cả khi bạn đóng tab trình duyệt.
              </p>
              <ul className="mt-2 space-y-1">
                {[
                  'Kết quả trận đấu theo thời gian thực',
                  'Thông báo khi đăng ký được duyệt',
                  'Cập nhật mới nhất từ giải đấu',
                ].map(item => (
                  <li key={item} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 pt-4 flex gap-3">
          {showIosInstructions ? (
            <button
              onClick={handleDismiss}
              className="w-full py-2.5 text-sm text-center bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-semibold"
            >
              Đồng ý
            </button>
          ) : (
            <>
              <button
                onClick={handleDismiss}
                className="flex-1 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Để sau
              </button>
              <button
                onClick={handleEnable}
                disabled={subscribing}
                className="flex-1 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors font-semibold flex items-center justify-center gap-2"
              >
                {subscribing
                  ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Đang bật…</>
                  : <><Bell className="w-3.5 h-3.5" /> Bật thông báo</>
                }
              </button>
            </>
          )}
        </div>

        {/* Denied hint */}
        {!showIosInstructions && permission === 'denied' && (
          <div className="px-5 pb-4 flex items-center gap-1.5 text-xs text-gray-400">
            <BellOff className="w-3.5 h-3.5 shrink-0" />
            Thông báo bị chặn. Vào cài đặt trình duyệt để bật lại.
          </div>
        )}
      </div>
    </div>
  )
}
