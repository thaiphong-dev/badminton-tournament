import { supabase } from '@/lib/supabase'

/**
 * Send a push notification to a user's registered devices.
 * Silently no-ops if the user has no push subscriptions or VAPID is not configured.
 *
 * @param {string} targetUserId  - profile ID of the recipient
 * @param {string} title
 * @param {string} body
 * @param {string} [url='/']    - URL opened when user taps the notification
 */
export async function sendPush(targetUserId, title, body, url = '/') {
  if (!targetUserId) return
  try {
    const { data, error } = await supabase.functions.invoke('send-push', {
      body: { target_user_id: targetUserId, title, body, url },
    })
    console.log('[sendPush]', { targetUserId, title, data, error })
  } catch (err) {
    console.error('[sendPush] exception:', err)
  }
}
