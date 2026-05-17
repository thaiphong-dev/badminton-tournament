// Edge Function: send-push
// Sends a Web Push notification to a target user's registered devices.
//
// Security model:
//   Caller must be authenticated and hold role 'creator' or 'admin'.
//   Umpires and athletes cannot invoke this function — prevents spam/abuse.
//
// Required Supabase secrets:
//   VAPID_PUBLIC_KEY   — from: npx web-push generate-vapid-keys
//   VAPID_PRIVATE_KEY  — from: npx web-push generate-vapid-keys
//   VAPID_EMAIL        — any email you own, e.g. admin@yourdomain.com
//
// Called via: supabase.functions.invoke('send-push', { body: { target_user_id, title, body, url } })

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY     = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY    = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_EMAIL          = Deno.env.get('VAPID_EMAIL')!
// Set ALLOWED_ORIGIN in Supabase Dashboard → Edge Functions → Secrets.
// During development / before a custom domain: leave unset or set to '*'.
// After buying a domain: set to 'https://yourdomain.com' — no code change needed.
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
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Vary':                         'Origin',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  // ── Caller authentication + role check ────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthenticated' }, 401)

  // Verify JWT and extract caller identity using the service client
  const callerToken = authHeader.slice(7)
  const { data: { user: caller }, error: authErr } =
    await serviceClient.auth.getUser(callerToken)

  if (authErr || !caller) return json({ error: 'Unauthenticated' }, 401)

  // Only creator and admin roles are allowed to send push notifications
  const { data: callerProfile } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()

  if (!['creator', 'admin'].includes(callerProfile?.role ?? '')) {
    return json({ error: 'Forbidden: only creators and admins can send push notifications' }, 403)
  }

  let body: { target_user_id?: string; title?: string; body?: string; url?: string }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const { target_user_id, title, body: msgBody, url = '/' } = body
  if (!target_user_id || !title) return json({ error: 'target_user_id and title required' }, 400)

  // Fetch all push subscriptions for target user
  const { data: subs, error: subErr } = await serviceClient
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', target_user_id)

  if (subErr) return json({ error: subErr.message }, 500)
  if (!subs?.length) return json({ sent: 0, total: 0 })

  const payload = JSON.stringify({
    title,
    body:   msgBody ?? '',
    url,
    icon:   '/pwa-192.svg',
    badge:  '/pwa-192.svg',
  })

  let sent = 0
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
        // Subscription expired — clean up so we don't retry it
        await serviceClient
          .from('push_subscriptions')
          .delete()
          .eq('user_id', target_user_id)
          .eq('endpoint', sub.endpoint)
      }
      // Other errors (network, etc.) — silently continue to next subscription
    }
  }

  return json({ sent, total: subs.length })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
