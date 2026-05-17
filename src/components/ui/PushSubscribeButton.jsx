import { Bell, BellOff, BellRing } from 'lucide-react'
import { usePushSubscription } from '@/lib/hooks/usePushSubscription'
import { cn } from '@/lib/utils/cn'

export default function PushSubscribeButton({ userId, className }) {
  const { supported, permission, subscribed, subscribing, subscribe, unsubscribe } = usePushSubscription(userId)

  if (!supported) return null

  if (permission === 'denied') {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-gray-400', className)}>
        <BellOff className="w-3.5 h-3.5" />
        Thông báo bị chặn
      </div>
    )
  }

  if (subscribed) {
    return (
      <button
        onClick={unsubscribe}
        className={cn(
          'flex items-center gap-1.5 text-xs text-green-600 hover:text-red-500 transition-colors',
          className,
        )}
        title="Nhấn để tắt thông báo đẩy"
      >
        <BellRing className="w-3.5 h-3.5" />
        Thông báo bật
      </button>
    )
  }

  return (
    <button
      onClick={subscribe}
      disabled={subscribing}
      className={cn(
        'flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50',
        className,
      )}
      title="Nhận thông báo khi có trận mới"
    >
      <Bell className="w-3.5 h-3.5" />
      {subscribing ? 'Đang đăng ký…' : 'Bật thông báo'}
    </button>
  )
}
