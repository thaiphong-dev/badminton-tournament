// Edge Function: scheduled-cleanup
// Alternative to pg_cron for Supabase free-tier projects.
// Invoke via a GitHub Actions cron, an external cron service, or Supabase's
// built-in scheduled Edge Function trigger (Dashboard → Edge Functions → Schedule).
//
// Runs: cleanup_old_notifications, cleanup_old_auth_attempts,
//       generate_subscription_notifications
//
// Auth: requires Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL            = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req: Request) => {
  // Allow Supabase internal scheduler (no auth header) or explicit service key
  const authHeader = req.headers.get('Authorization')
  const isInternal = req.headers.get('x-supabase-internal') === '1'
  if (!isInternal) {
    const token = authHeader?.replace('Bearer ', '')
    if (token !== SUPABASE_SERVICE_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const results: Record<string, { success: boolean; error?: string }> = {}

  const jobs = [
    'cleanup_old_notifications',
    'cleanup_old_auth_attempts',
    'generate_subscription_notifications',
  ] as const

  for (const job of jobs) {
    const { error } = await supabase.rpc(job as string)
    results[job] = error ? { success: false, error: error.message } : { success: true }
  }

  const allOk = Object.values(results).every(r => r.success)

  return new Response(JSON.stringify({ ok: allOk, results, ran_at: new Date().toISOString() }), {
    status: allOk ? 200 : 207,
    headers: { 'Content-Type': 'application/json' },
  })
})
