// Edge Function: sepay-webhook
// Receives incoming bank-transfer notifications from SePay and auto-confirms
// the matching payment_order, then activates the associated subscription or addon.
//
// Security:
//   SePay sends `Authorization: Bearer <API_TOKEN>` on every webhook call.
//   We compare this to SEPAY_WEBHOOK_SECRET stored in Supabase Edge Function secrets.
//   Requests with missing or wrong token are rejected with 401 before any DB access.
//
// Required Supabase secrets:
//   SEPAY_WEBHOOK_SECRET — the API token you configured in SePay dashboard
//
// SePay webhook payload (relevant fields):
//   code           — extracted transfer reference (matched against payment_orders.transfer_content)
//   content        — raw transfer description (fallback if code is empty)
//   transferAmount — amount in VND
//   transferType   — "in" | "out" (only process "in")
//
// Deploy: supabase functions deploy sepay-webhook --project-ref <ref>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SEPAY_WEBHOOK_SECRET = Deno.env.get('SEPAY_WEBHOOK_SECRET')

interface SepayPayload {
  id?:             number
  gateway?:        string
  transactionDate?: string
  accountNumber?:  string
  code?:           string      // extracted reference code — matches transfer_content
  content?:        string      // full raw description
  transferType?:   string      // "in" | "out"
  transferAmount?: number      // VND
  accumulated?:    number
  referenceCode?:  string
  subAccount?:     string | null
}

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // ── 1. Validate SePay auth token ──────────────────────────────────────────
  if (!SEPAY_WEBHOOK_SECRET) {
    // Secret not configured — refuse all requests rather than accepting blindly
    console.error('[sepay-webhook] SEPAY_WEBHOOK_SECRET is not set')
    return json({ error: 'Webhook not configured' }, 503)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : authHeader.trim()

  if (!token || token !== SEPAY_WEBHOOK_SECRET) {
    console.warn('[sepay-webhook] Rejected: invalid or missing token')
    return json({ error: 'Unauthorized' }, 401)
  }

  // ── 2. Parse payload ──────────────────────────────────────────────────────
  let payload: SepayPayload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const {
    transferType   = '',
    transferAmount = 0,
    code           = '',
    content        = '',
    id: sePayId,
  } = payload

  // Only process incoming transfers
  if (transferType.toLowerCase() !== 'in') {
    return json({ ok: true, skipped: true, reason: 'not_incoming' })
  }

  // Resolve transfer reference: SePay populates `code` with the extracted reference.
  // Fall back to scanning `content` for the reference if code is empty.
  const reference = (code || content || '').trim()
  if (!reference) {
    return json({ ok: false, reason: 'empty_reference' }, 400)
  }

  console.log(`[sepay-webhook] Processing tx #${sePayId} ref="${reference}" amount=${transferAmount}`)

  // ── 3. Call the secure RPC to match and confirm the order ─────────────────
  // webhook_auto_confirm_order is SECURITY DEFINER, callable only by service_role.
  // It handles: order lookup, amount validation, payment_orders update, and
  // subscription / addon activation in a single atomic transaction.
  const { data, error } = await serviceClient
    .rpc('webhook_confirm_payment', {
      p_transfer_content: reference,
      p_amount:           Math.round(transferAmount),
      p_sepay_tx_id:      String(sePayId || ''),
    })

  if (error) {
    console.error('[sepay-webhook] RPC error:', error.message)
    return json({ ok: false, error: error.message }, 500)
  }

  const result = data as { ok: boolean; reason?: string; order_id?: string; expected?: number; received?: number }

  if (!result.ok) {
    // Not an error — could be a transfer for a different system or already confirmed
    console.log(`[sepay-webhook] No action: ${result.reason}`, result)
    return json({ ok: false, ...result })
  }

  console.log(`[sepay-webhook] Confirmed order ${result.order_id} for tx #${sePayId}`)
  return json({ ok: true, order_id: result.order_id })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
