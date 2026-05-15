import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Clock, AlertCircle, AlertTriangle, CheckCircle, CreditCard, Loader2, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils/cn'

function relativeTime(isoStr) {
  const diffMs = Date.now() - new Date(isoStr).getTime()
  const mins   = Math.floor(diffMs / 60000)
  if (mins < 60)  return `${Math.max(1, mins)} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  return new Date(isoStr).toLocaleDateString('vi-VN')
}

function NotifIcon({ type }) {
  if (type === 'sub_expiring_7' || type === 'sub_expiring_3' || type === 'sub_expiring_1') {
    return (
      <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
        <Clock className="w-4 h-4 text-yellow-600" />
      </div>
    )
  }
  if (type === 'sub_expired') {
    return (
      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
        <AlertCircle className="w-4 h-4 text-red-600" />
      </div>
    )
  }
  if (type === 'quota_warning') {
    return (
      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-4 h-4 text-orange-600" />
      </div>
    )
  }
  if (type === 'payment_confirmed') {
    return (
      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
        <CheckCircle className="w-4 h-4 text-green-600" />
      </div>
    )
  }
  if (type === 'new_payment_order' || type === 'new_addon_order') {
    return (
      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
        <CreditCard className="w-4 h-4 text-blue-600" />
      </div>
    )
  }
  if (type === 'payment_rejected') {
    return (
      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
        <XCircle className="w-4 h-4 text-red-600" />
      </div>
    )
  }
  return (
    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
      <Bell className="w-4 h-4 text-gray-500" />
    </div>
  )
}

export default function NotificationBell({ userId, role }) {
  const navigate = useNavigate()
  const dropdownRef = useRef(null)

  const [data, setData]     = useState({ unread_count: 0, notifications: [] })
  const [open, setOpen]     = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data: res } = await supabase.rpc('get_my_notifications', { p_user_id: userId })
    setData(res ?? { unread_count: 0, notifications: [] })
    setLoading(false)
  }

  useEffect(() => {
    if (!userId) return
    load()

    const channel = supabase.channel(`notifs-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'user_notifications',
        filter: `user_id=eq.${userId}`,
      }, () => load())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [userId])

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleMarkAllRead() {
    await supabase.rpc('mark_notifications_read', { p_user_id: userId, p_notif_ids: null })
    setData(prev => ({
      ...prev,
      unread_count: 0,
      notifications: prev.notifications.map(n => ({ ...n, is_read: true })),
    }))
  }

  async function handleClickNotif(notif) {
    if (!notif.is_read) {
      await supabase.rpc('mark_notifications_read', {
        p_user_id:    userId,
        p_notif_ids:  [notif.id],
      })
      setData(prev => ({
        ...prev,
        unread_count: Math.max(0, prev.unread_count - 1),
        notifications: prev.notifications.map(n =>
          n.id === notif.id ? { ...n, is_read: true } : n
        ),
      }))
    }
    setOpen(false)
    if (notif.cta_url) navigate(notif.cta_url)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Thông báo"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {data.unread_count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center leading-none">
            {data.unread_count > 9 ? '9+' : data.unread_count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-80 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-sm text-gray-900">Thông báo</span>
            {data.unread_count > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 hover:underline"
              >
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : data.notifications.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Không có thông báo nào</p>
            ) : data.notifications.map(notif => (
              <div
                key={notif.id}
                onClick={() => handleClickNotif(notif)}
                className={cn(
                  'px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors flex items-start gap-3',
                  !notif.is_read && 'bg-blue-50/40',
                )}
              >
                <NotifIcon type={notif.type} />
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm text-gray-900 leading-snug',
                    !notif.is_read ? 'font-semibold' : 'font-medium',
                  )}>
                    {notif.title}
                  </p>
                  <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{notif.body}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{relativeTime(notif.created_at)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-100 text-center">
            <button
              onClick={() => { setOpen(false); navigate(role === 'admin' ? '/admin?tab=orders' : '/creator/subscription') }}
              className="text-xs text-blue-600 hover:underline"
            >
              {role === 'admin' ? 'Xem tab Đơn hàng →' : 'Xem trang quản lý gói →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
