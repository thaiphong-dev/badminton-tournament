-- ── Scale Improvements Migration ─────────────────────────────────────────────
-- 1. cron_job_log — execution audit trail for pg_cron jobs
-- 2. Performance index on user_notifications
-- 3. cleanup_old_notifications — 90-day TTL for notification records
-- 4. Fix cleanup_old_auth_attempts — was targeting non-existent table auth_attempts,
--    actual table created by MIGRATION_RATE_LIMIT is login_attempts
-- 5. Updated generate_subscription_notifications — with error handling + execution logging
-- 6. get_cron_health — admin RPC to surface cron execution status in UI

-- ── 1. Cron job execution log ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cron_job_log (
  id           bigserial    PRIMARY KEY,
  job_name     text         NOT NULL,
  started_at   timestamptz  NOT NULL DEFAULT now(),
  duration_ms  integer,
  rows_affected integer,
  success      boolean      NOT NULL DEFAULT true,
  error_msg    text,
  CONSTRAINT cron_job_log_duration_positive CHECK (duration_ms IS NULL OR duration_ms >= 0)
);

CREATE INDEX IF NOT EXISTS idx_cron_job_log_job_started
  ON cron_job_log (job_name, started_at DESC);

ALTER TABLE cron_job_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cron_log_service_write" ON cron_job_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE cron_job_log IS
  'Execution log for pg_cron scheduled jobs. Populated by each job function.';

-- ── 2. Performance index on user_notifications ───────────────────────────────
-- Supports the ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC)
-- query used in generate_subscription_notifications to enforce 30-per-user TTL.

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
  ON user_notifications (user_id, created_at DESC);

-- ── 3. Notification TTL cleanup (90 days) ────────────────────────────────────

CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start       TIMESTAMPTZ := clock_timestamp();
  v_deleted     INTEGER;
BEGIN
  DELETE FROM user_notifications
  WHERE created_at < now() - INTERVAL '90 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  INSERT INTO cron_job_log (job_name, duration_ms, rows_affected, success)
  VALUES (
    'cleanup_old_notifications',
    EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::INTEGER,
    v_deleted,
    true
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO cron_job_log (job_name, duration_ms, rows_affected, success, error_msg)
  VALUES (
    'cleanup_old_notifications',
    EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::INTEGER,
    0,
    false,
    SQLERRM
  );
  RAISE;
END;
$$;

-- ── 4. Fix cleanup_old_auth_attempts ─────────────────────────────────────────
-- Previous version referenced table auth_attempts which does not exist.
-- Actual table (from MIGRATION_RATE_LIMIT) is login_attempts.
-- The authenticate() function also self-cleans per-call (entries older than 15 min
-- per phone), so this job only purges any stragglers missed by per-call cleanup.

CREATE OR REPLACE FUNCTION cleanup_old_auth_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start   TIMESTAMPTZ := clock_timestamp();
  v_deleted INTEGER;
BEGIN
  DELETE FROM login_attempts
  WHERE attempted_at < now() - INTERVAL '1 day';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  INSERT INTO cron_job_log (job_name, duration_ms, rows_affected, success)
  VALUES (
    'cleanup_old_auth_attempts',
    EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::INTEGER,
    v_deleted,
    true
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO cron_job_log (job_name, duration_ms, rows_affected, success, error_msg)
  VALUES (
    'cleanup_old_auth_attempts',
    EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::INTEGER,
    0,
    false,
    SQLERRM
  );
  RAISE;
END;
$$;

-- ── 5. Updated generate_subscription_notifications ───────────────────────────
-- Added: execution timing, rows_affected count, error handling, cron_job_log entry.
-- Existing 30-per-user cap logic retained unchanged.

CREATE OR REPLACE FUNCTION generate_subscription_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start    TIMESTAMPTZ := clock_timestamp();
  v_inserted INTEGER := 0;
  v_tmp      INTEGER;
BEGIN
  -- Notify creators whose active subscription expires within 7 days
  -- and who have not received this same notification today.
  INSERT INTO user_notifications (user_id, type, title, body, data)
  SELECT
    s.creator_id,
    'subscription_expiry',
    'Gói dịch vụ sắp hết hạn',
    'Gói ' || p.name || ' của bạn sẽ hết hạn vào ' ||
      TO_CHAR(s.expires_at, 'DD/MM/YYYY') || '. Gia hạn để không gián đoạn.',
    jsonb_build_object('subscription_id', s.id, 'plan_slug', p.slug)
  FROM subscriptions s
  JOIN subscription_plans p ON p.id = s.plan_id
  WHERE s.status = 'active'
    AND s.expires_at BETWEEN now() AND now() + INTERVAL '7 days'
    AND NOT EXISTS (
      SELECT 1 FROM user_notifications n
      WHERE n.user_id = s.creator_id
        AND n.type    = 'subscription_expiry'
        AND n.created_at >= now() - INTERVAL '20 hours'
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Enforce 30-notification cap per user (delete oldest beyond cap)
  DELETE FROM user_notifications
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
      FROM user_notifications
    ) ranked
    WHERE rn > 30
  );

  GET DIAGNOSTICS v_tmp = ROW_COUNT;

  INSERT INTO cron_job_log (job_name, duration_ms, rows_affected, success)
  VALUES (
    'generate_subscription_notifications',
    EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::INTEGER,
    v_inserted,
    true
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO cron_job_log (job_name, duration_ms, rows_affected, success, error_msg)
  VALUES (
    'generate_subscription_notifications',
    EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::INTEGER,
    0,
    false,
    SQLERRM
  );
  RAISE;
END;
$$;

-- ── 6. Admin RPC: get cron health ─────────────────────────────────────────────
-- Returns last execution record per job name so admin UI can surface status.

CREATE OR REPLACE FUNCTION get_cron_health(p_admin_id UUID)
RETURNS TABLE (
  job_name     text,
  last_run     timestamptz,
  duration_ms  integer,
  rows_affected integer,
  success      boolean,
  error_msg    text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (l.job_name)
    l.job_name,
    l.started_at  AS last_run,
    l.duration_ms,
    l.rows_affected,
    l.success,
    l.error_msg
  FROM cron_job_log l
  ORDER BY l.job_name, l.started_at DESC;
END;
$$;

-- ── 7. pg_cron schedules ──────────────────────────────────────────────────────
-- Requires pg_cron extension enabled in Supabase dashboard (Database → Extensions).
-- Free-tier alternative: deploy the scheduled-cleanup Edge Function with a cron trigger.

-- Notification expiry cleanup — daily at 02:00 UTC
SELECT cron.schedule(
  'cleanup-old-notifications',
  '0 2 * * *',
  $$SELECT cleanup_old_notifications()$$
) WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron');

-- Auth attempts cleanup — daily at 03:00 UTC
SELECT cron.schedule(
  'cleanup-auth-attempts',
  '0 3 * * *',
  $$SELECT cleanup_old_auth_attempts()$$
) WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron');

-- Subscription expiry notifications — every 6 hours
SELECT cron.schedule(
  'subscription-expiry-notifications',
  '0 */6 * * *',
  $$SELECT generate_subscription_notifications()$$
) WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron');
