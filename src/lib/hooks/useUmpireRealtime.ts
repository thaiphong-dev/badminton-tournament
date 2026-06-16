import { useEffect, useLayoutEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import useCallStore from '@/lib/stores/callStore'

const STAGE_LABELS = {
  group: 'Vòng bảng', round_of_64: '1/32', round_of_32: '1/16',
  round_of_16: '1/8', quarter: 'Tứ kết', semi: 'Bán kết',
  final: 'Chung kết', third_place: 'Hạng 3',
}

/**
 * Subscribe Supabase Realtime cho tất cả matches được assign cho umpire.
 * Mount tại UmpirePage sau khi profile đã load.
 *
 * @param {string}   umpireId   - profile.id của umpire đang đăng nhập
 * @param {Array}    matches    - state matches[] hiện tại của UmpirePage
 * @param {Object}   playerMap  - { [playerId]: { id, name } } của UmpirePage
 * @param {Function} setMatches - setter để cập nhật matches state khi có realtime update
 */
export function useUmpireRealtime(umpireId, matches, playerMap, setMatches) {
  const { setIncomingCall, clearIncomingCall } = useCallStore()

  // Box latest values vào ref để tránh stale closure trong subscription callback.
  // useEffect chỉ chạy lại khi umpireId thay đổi — nếu đọc matches/playerMap trực tiếp
  // trong closure sẽ bị stale. Ref luôn giữ giá trị render mới nhất.
  const latestRef = useRef({ matches, playerMap })
  useLayoutEffect(() => { latestRef.current = { matches, playerMap } })

  useEffect(() => {
    if (!umpireId) return

    const channel = supabase
      .channel(`umpire-${umpireId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'matches',
          filter: `umpire_id=eq.${umpireId}`,
        },
        async (payload) => {
          const updated = payload.new

          // 1. Cập nhật local matches state ngay lập tức
          setMatches((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
          )

          // 2. Xử lý incoming call
          if (updated.status === 'calling') {
            const { matches: latestMatches, playerMap: latestPlayerMap } = latestRef.current
            const existingMatch = latestMatches.find((m) => m.id === updated.id)
console.log(updated);
console.log(existingMatch);
console.log(latestPlayerMap);

            const p1Id = updated.player1_id ?? existingMatch?.player1_id
            const p2Id = updated.player2_id ?? existingMatch?.player2_id
            const stage = updated.stage ?? existingMatch?.stage ?? ''
            const num   = updated.match_number ?? existingMatch?.match_number ?? ''

            let p1Name = latestPlayerMap[p1Id]?.name
            let p2Name = latestPlayerMap[p2Id]?.name

            // Nếu thiếu tên (umpire chưa mở tournament đó), fetch từ DB
            if ((!p1Name || !p2Name) && (p1Id || p2Id)) {
              const ids = [p1Id, p2Id].filter(Boolean)
              const { data: players } = await supabase.from('players').select('id, name').in('id', ids)
              const pMap = Object.fromEntries((players ?? []).map(p => [p.id, p.name]))
              p1Name = p1Name ?? pMap[p1Id] ?? 'Player 1'
              p2Name = p2Name ?? pMap[p2Id] ?? 'Player 2'
            } else {
              p1Name = p1Name ?? 'Player 1'
              p2Name = p2Name ?? 'Player 2'
            }

            setIncomingCall({
              matchId:     updated.id,
              matchLabel:  STAGE_LABELS[stage] ?? stage,
              matchNumber: num ? `Trận ${num}` : '',
              player1Name: p1Name,
              player2Name: p2Name,
              calledAt:    updated.call_started_at,
            })
          }

          // 3. Clear overlay khi: (a) umpire accept → 'active',
          //    hoặc (b) BTC huỷ gọi → 'pending' + call_ended_at set
          // Khi umpire tự từ chối, clearIncomingCall() đã được gọi cục bộ
          // trong IncomingCallOverlay trước — lần gọi này là no-op, an toàn.
          if (updated.status === 'active' || (updated.status === 'pending' && updated.call_ended_at)) {
            clearIncomingCall()
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[useUmpireRealtime] Subscription error — sẽ tự retry')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [umpireId]) // eslint-disable-line react-hooks/exhaustive-deps
  // Chỉ re-subscribe khi umpireId thay đổi.
  // matches/playerMap đọc qua latestRef.current nên không cần trong deps.
}
