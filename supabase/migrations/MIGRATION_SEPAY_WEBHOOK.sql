-- SePay Webhook Auto-Confirm
-- Creates a SECURITY DEFINER RPC callable only by service_role (Edge Function).
-- On a matching incoming transfer:
--   1. Validates transfer_content + amount against a pending payment_order
--   2. Marks the order confirmed
--   3. Activates the linked subscription or addon
--
-- Deploy alongside Edge Function: supabase/functions/sepay-webhook/index.ts
-- Required Supabase secret: SEPAY_WEBHOOK_SECRET

-- ── webhook_auto_confirm_order ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION webhook_auto_confirm_order(
  p_transfer_content TEXT,
  p_amount           BIGINT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order    payment_orders%ROWTYPE;
  v_is_addon BOOLEAN;
BEGIN
  -- ── 1. Find matching pending order (case-insensitive, trim whitespace) ─────
  SELECT * INTO v_order
  FROM payment_orders
  WHERE LOWER(TRIM(transfer_content)) = LOWER(TRIM(p_transfer_content))
    AND status = 'waiting'
  LIMIT 1;

  IF NOT FOUND THEN
    -- Could be for a different system, already confirmed, or a typo in reference
    RETURN json_build_object('ok', false, 'reason', 'no_matching_order');
  END IF;

  -- ── 2. Validate amount (±1000 VND tolerance for minor bank fee rounding) ───
  IF ABS(v_order.amount - p_amount) > 1000 THEN
    RETURN json_build_object(
      'ok',       false,
      'reason',   'amount_mismatch',
      'expected', v_order.amount,
      'received', p_amount
    );
  END IF;

  v_is_addon := (v_order.addon_id IS NOT NULL);

  -- ── 3. Confirm the payment order ──────────────────────────────────────────
  UPDATE payment_orders
  SET
    status       = 'confirmed',
    confirmed_at = now()
  WHERE id = v_order.id;

  -- ── 4. Activate subscription or addon ────────────────────────────────────
  IF v_is_addon THEN
    -- Activate the add-on (e.g. extra tournament slots)
    UPDATE subscription_addons
    SET
      status       = 'active',
      activated_at = now()
    WHERE id = v_order.addon_id;

  ELSE
    -- Activate the subscription.
    -- If the subscription is already active (re-purchase / renewal),
    -- extend expires_at from the later of now() or current expiry.
    -- Duration: 30 days for monthly plans (adjust per plan if plan has duration_days).
    UPDATE subscriptions
    SET
      status     = 'active',
      started_at = COALESCE(started_at, now()),
      expires_at = GREATEST(COALESCE(expires_at, now()), now()) + INTERVAL '30 days'
    WHERE id = v_order.subscription_id;
  END IF;

  RETURN json_build_object('ok', true, 'order_id', v_order.id);

EXCEPTION WHEN OTHERS THEN
  -- Roll back any partial updates and surface error to Edge Function
  RAISE;
END;
$$;

-- ── Permission hardening ──────────────────────────────────────────────────────
-- This function must only be callable by the Edge Function (service_role key).
-- Authenticated users and anonymous callers must never invoke it directly.
REVOKE EXECUTE ON FUNCTION webhook_auto_confirm_order(TEXT, BIGINT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION webhook_auto_confirm_order(TEXT, BIGINT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION webhook_auto_confirm_order(TEXT, BIGINT) FROM anon;
GRANT  EXECUTE ON FUNCTION webhook_auto_confirm_order(TEXT, BIGINT) TO service_role;
