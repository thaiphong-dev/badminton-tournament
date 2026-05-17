-- Push subscriptions table for Web Push API
-- Run this migration before deploying push notification feature

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One subscription per (user, endpoint) pair — same user can have multiple devices
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_idx
  ON push_subscriptions(user_id, endpoint);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own subscriptions
CREATE POLICY "push_own_read"   ON push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "push_own_insert" ON push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_own_update" ON push_subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "push_own_delete" ON push_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- Service role can read all (for Edge Function sending)
CREATE POLICY "push_service_read" ON push_subscriptions
  FOR SELECT TO service_role USING (true);

COMMENT ON TABLE push_subscriptions IS
  'Web Push API subscriptions. Populated by client usePushSubscription hook. '
  'Read by send-push Edge Function using service_role key.';
