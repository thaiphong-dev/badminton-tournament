// Edge Function: send-push
// Sends a Web Push notification to one or more users' registered devices.
//
// ── Security model ────────────────────────────────────────────────────────────
//   External callers (browser): must supply a JWT of a 'creator' or 'admin'
//     profile via Authorization: Bearer <token>.
//   Internal callers (DB triggers): supply the pre-shared TRIGGER_SECRET in the
//     x-trigger-secret header to bypass JWT auth.  This avoids storing the
//     service_role key in client-side code or sending user JWTs from triggers.
//
// ── Required Supabase secrets ─────────────────────────────────────────────────
//   VAPID_PUBLIC_KEY   — npx web-push generate-vapid-keys
//   VAPID_PRIVATE_KEY  — npx web-push generate-vapid-keys
//   VAPID_EMAIL        — any email you own, e.g. admin@yourdomain.com
//   TRIGGER_SECRET     — any random string; also stored in DB via:
//                          INSERT INTO app_config VALUES ('trigger_secret', '...');
//
// ── Invocation ────────────────────────────────────────────────────────────────
//   From browser (creator/admin):
//     supabase.functions.invoke('send-push', { body: { target_user_id, title, body, url } })
//   From DB trigger (pg_net):
//     net.http_post(url, headers('x-trigger-secret', secret), body(target_user_id OR target_user_ids[]))

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY     = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY    = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_EMAIL          = Deno.env.get('VAPID_EMAIL')!
const TRIGGER_SECRET       = Deno.env.get('TRIGGER_SECRET') ?? ''
const ALLOWED_ORIGIN       = Deno.env.get('ALLOWED_ORIGIN') ?? '*'

webpush.setVapidDetails(
  `mailto:${VAPID_EMAIL}`,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
)

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const CORS = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-trigger-secret',
  'Vary': 'Origin',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  // ── Auth: internal trigger OR external JWT ────────────────────────────────
  const triggerHeader = req.headers.get('x-trigger-secret') ?? ''
  const isInternalCall = TRIGGER_SECRET.length > 0 && triggerHeader === TRIGGER_SECRET

  if (!isInternalCall) {
    // External call: require JWT from a creator or admin profile
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthenticated' }, 401)

    const callerToken = authHeader.slice(7)
    const { data: { user: caller }, error: authErr } =
      await serviceClient.auth.getUser(callerToken)

    if (authErr || !caller) return json({ error: 'Unauthenticated' }, 401)

    const { data: callerProfile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (!['creator', 'admin'].includes(callerProfile?.role ?? '')) {
      return json({ error: 'Forbidden: only creators and admins can send push notifications' }, 403)
    }
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    target_user_id?:  string
    target_user_ids?: string[]
    title?:  string
    body?:   string
    url?:    string
  }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const { target_user_id, target_user_ids, title, body: msgBody, url = '/' } = body
  // Support both single and bulk user IDs
  const userIds: string[] = target_user_ids ?? (target_user_id ? [target_user_id] : [])

  if (!userIds.length || !title) {
    return json({ error: 'target_user_id / target_user_ids and title required' }, 400)
  }

  // ── Fetch subscriptions for all target users ──────────────────────────────
  const { data: subs, error: subErr } = await serviceClient
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  if (subErr) return json({ error: subErr.message }, 500)
  if (!subs?.length) return json({ sent: 0, total: 0 })

  const payload = JSON.stringify({
    title,
    body:  msgBody ?? '',
    url,
    icon:  '/pwa-192.svg',
    badge: '/pwa-192.svg',
  })

  // ── Send to each subscription ─────────────────────────────────────────────
  let sent = 0
  const stale: { user_id: string; endpoint: string }[] = []

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
      sent++
    } catch (err: unknown) {
      const code = (err as { statusCode?: number }).statusCode
      if (code === 410 || code === 404) {
        stale.push({ user_id: sub.user_id, endpoint: sub.endpoint })
      }
    }
  }

  // Clean up expired subscriptions in bulk
  if (stale.length) {
    await serviceClient
      .from('push_subscriptions')
      .delete()
      .in('endpoint', stale.map(s => s.endpoint))
  }

  return json({ sent, total: subs.length })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
