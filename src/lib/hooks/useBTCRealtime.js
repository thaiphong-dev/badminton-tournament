import { useEffect, useLayoutEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Subscribe Supabase Realtime tất cả matches và match_stats của một tournament.
 * Mount tại trang BTC quản lý tournament (Court Board / GroupStagePage).
 *
 * @param {string}        tournamentId   - UUID của tournament đang xem
 * @param {Function}      onMatchUpdate  - callback(updatedMatch) — gọi khi match thay đổi
 * @param {Function|null} onStatsUpdate  - callback(updatedStats) — gọi khi match_stats thay đổi (optional)
 * @param {string}        channelSuffix  - suffix để tránh xung đột channel name khi mount nhiều lần
 * @param {Function|null} onStatusChange - callback(status: 'SUBSCRIBED'|'CHANNEL_ERROR'|'CLOSED') — expose connection state
 */
export function useBTCRealtime(tournamentId, onMatchUpdate, onStatsUpdate = null, channelSuffix = '', onStatusChange = null) {
  const callbackRef       = useRef(onMatchUpdate)
  const statsCallbackRef  = useRef(onStatsUpdate)
  const statusCallbackRef = useRef(onStatusChange)
  useLayoutEffect(() => {
    callbackRef.current       = onMatchUpdate
    statsCallbackRef.current  = onStatsUpdate
    statusCallbackRef.current = onStatusChange
  })

  useEffect(() => {
    if (!tournamentId) return

    let channel = supabase
      .channel(`btc-${tournamentId}${channelSuffix}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'matches',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          callbackRef.current?.(payload.new)
        }
      )

    if (onStatsUpdate) {
      channel = channel.on(
        'postgres_changes',
        {
          event:  '*',          // INSERT (tạo lần đầu) hoặc UPDATE (ghi thêm)
          schema: 'public',
          table:  'match_stats',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          statsCallbackRef.current?.(payload.new)
        }
      )
    }

    channel.subscribe((status) => {
      statusCallbackRef.current?.(status)
      if (status === 'CHANNEL_ERROR') {
        console.error('[useBTCRealtime] Subscription error — sẽ tự retry')
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournamentId, channelSuffix, !!onStatsUpdate]) // eslint-disable-line react-hooks/exhaustive-deps
  // Callbacks đọc qua ref nên không cần trong deps.
  // Re-subscribe nếu onStatsUpdate thay đổi từ null → function (hoặc ngược lại).
}
