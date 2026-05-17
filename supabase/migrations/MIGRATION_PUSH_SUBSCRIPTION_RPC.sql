-- Fix: push_subscriptions upsert/delete via SECURITY DEFINER RPC
-- Direct table INSERT fails with anon key because auth.uid() = null (custom auth pattern).
-- RPCs bypass RLS and run as postgres role, same pattern as other sensitive operations.

CREATE OR REPLACE FUNCTION upsert_push_subscription(
  p_user_id  UUID,
  p_endpoint TEXT,
  p_p256dh   TEXT,
  p_auth     TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, updated_at)
  VALUES (p_user_id, p_endpoint, p_p256dh, p_auth, now())
  ON CONFLICT (user_id, endpoint)
  DO UPDATE SET
    p256dh     = EXCLUDED.p256dh,
    auth       = EXCLUDED.auth,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION delete_push_subscription(
  p_user_id  UUID,
  p_endpoint TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM push_subscriptions
  WHERE user_id = p_user_id AND endpoint = p_endpoint;
END;
$$;
