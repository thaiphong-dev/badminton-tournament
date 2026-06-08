-- ── Feature V3: Athlete profile (gender + dob), tournament-edit window,
--               tournament-update notifications, creator registration notifications
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Athlete profile columns ───────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gender         text CHECK (gender IN ('male', 'female')),
  ADD COLUMN IF NOT EXISTS date_of_birth  date;

-- ── 2. Allow new notification types (add if your user_notifications.type
--       has a CHECK constraint; safe to run even if no constraint exists)
-- If there is a CHECK constraint on type, drop and recreate with new values:
-- ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_type_check;
-- (If you do have such a constraint, add your current + new type values here.)
-- New types added: 'tournament_updated', 'new_athlete_registration'

-- ── 3. set_athlete_profile_details ───────────────────────────────────────────
-- Called after athlete registration to store gender + date_of_birth.
-- SECURITY DEFINER so anon key can call it (custom auth pattern).
CREATE OR REPLACE FUNCTION set_athlete_profile_details(
  p_user_id       uuid,
  p_gender        text,
  p_date_of_birth date
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_gender NOT IN ('male', 'female') THEN
    RAISE EXCEPTION 'Invalid gender. Must be male or female.';
  END IF;
  IF p_date_of_birth IS NULL OR p_date_of_birth > CURRENT_DATE THEN
    RAISE EXCEPTION 'Invalid date_of_birth.';
  END IF;
  UPDATE profiles
  SET   gender        = p_gender,
        date_of_birth = p_date_of_birth
  WHERE id = p_user_id
    AND role = 'athlete';
END;
$$;

-- ── 4. notify_tournament_update ──────────────────────────────────────────────
-- Inserts bell notifications for all approved registered athletes of a tournament.
-- Returns the list of user_ids notified (for caller to send PWA push).
CREATE OR REPLACE FUNCTION notify_tournament_update(
  p_tournament_id uuid,
  p_title         text,
  p_body          text,
  p_cta_url       text DEFAULT NULL
)
RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_ids uuid[];
BEGIN
  -- Collect distinct approved athlete IDs across all events of the tournament
  SELECT ARRAY_AGG(DISTINCT tr.athlete_id)
  INTO v_user_ids
  FROM tournament_registrations tr
  JOIN events e ON e.id = tr.event_id
  WHERE e.tournament_id = p_tournament_id
    AND tr.status       = 'approved'
    AND tr.athlete_id   IS NOT NULL;

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) = 0 THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  -- Insert bell notifications
  INSERT INTO user_notifications (user_id, type, title, body, cta_url)
  SELECT uid, 'tournament_updated', p_title, p_body, p_cta_url
  FROM unnest(v_user_ids) AS uid;

  RETURN v_user_ids;
END;
$$;

-- ── 5. notify_creator_on_registration ────────────────────────────────────────
-- Inserts a bell notification for the tournament creator when an athlete
-- registers. Returns the creator's user_id for PWA push.
-- NOTE: Kept for manual/testing use; Feature 5 is now handled by the
--       handle_new_registration() DB trigger below (Phương án B).
CREATE OR REPLACE FUNCTION notify_creator_on_registration(
  p_event_id    uuid,
  p_athlete_name text,
  p_discipline  text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_creator_id    uuid;
  v_tournament_id uuid;
  v_tourney_name  text;
BEGIN
  SELECT t.creator_id, t.id, t.name
  INTO   v_creator_id, v_tournament_id, v_tourney_name
  FROM   events e
  JOIN   tournaments t ON t.id = e.tournament_id
  WHERE  e.id = p_event_id;

  IF v_creator_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO user_notifications (user_id, type, title, body, cta_url)
  VALUES (
    v_creator_id,
    'new_athlete_registration',
    'Có vận động viên mới đăng ký',
    p_athlete_name
      || ' vừa đăng ký'
      || CASE WHEN p_discipline IS NOT NULL THEN ' ' || p_discipline ELSE '' END
      || ' trong giải ' || v_tourney_name,
    '/tournament/' || v_tournament_id::text
  );

  RETURN v_creator_id;
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Phương án B — DB triggers call send-push Edge Function via pg_net
--
-- Setup (run once after this migration):
--   1. INSERT INTO app_config VALUES ('trigger_secret', '"<your-secret>"');
--      (value là jsonb — chuỗi phải có dấu nháy kép bên trong)
--   2. Add TRIGGER_SECRET=<your-secret> in Edge Function secrets
--      (Supabase Dashboard → Edge Functions → send-push → Secrets)
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 6. app_config: stores trigger secret readable only by SECURITY DEFINER fns
CREATE TABLE IF NOT EXISTS app_config (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);
-- Deny all access from normal roles; SECURITY DEFINER functions bypass RLS
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
-- No policies → no role can SELECT/INSERT/UPDATE directly

-- ── 7. info_updated_at column on tournaments ─────────────────────────────────
-- Set ONLY by TournamentEdit when the creator intentionally saves changes.
-- The trigger below fires when this column changes, not on every tournament update.
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS info_updated_at timestamptz;

-- ── 8. Trigger: athletes notified when tournament info is updated ─────────────
CREATE OR REPLACE FUNCTION handle_tournament_info_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_ids       uuid[];
  v_trigger_secret text;
  v_title          text;
  v_body_msg       text;
  v_cta_url        text;
BEGIN
  SELECT value #>> '{}' INTO v_trigger_secret FROM app_config WHERE key = 'trigger_secret';

  -- Collect approved athlete IDs across all events of this tournament
  SELECT ARRAY_AGG(DISTINCT tr.athlete_id)
  INTO v_user_ids
  FROM tournament_registrations tr
  JOIN events e ON e.id = tr.event_id
  WHERE e.tournament_id = NEW.id
    AND tr.status       = 'approved'
    AND tr.athlete_id   IS NOT NULL;

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;

  v_title    := 'Giải đấu vừa cập nhật thông tin';
  v_body_msg := 'Giải ' || NEW.name || ' vừa được cập nhật thông tin. Hãy kiểm tra lại lịch thi đấu.';
  v_cta_url  := '/tournament/' || NEW.id::text;

  -- Bell notifications for all approved athletes
  INSERT INTO user_notifications (user_id, type, title, body, cta_url)
  SELECT uid, 'tournament_updated', v_title, v_body_msg, v_cta_url
  FROM unnest(v_user_ids) AS uid;

  -- PWA push via Edge Function (fire-and-forget; errors must not abort the transaction)
  IF v_trigger_secret IS NOT NULL AND v_trigger_secret <> '' THEN
    BEGIN
      PERFORM net.http_post(
        url     := 'https://fmmxyccddyewxytsaiau.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type',     'application/json',
          'x-trigger-secret', v_trigger_secret
        ),
        body    := jsonb_build_object(
          'target_user_ids', (SELECT jsonb_agg(uid::text) FROM unnest(v_user_ids) uid),
          'title',           v_title,
          'body',            v_body_msg,
          'url',             v_cta_url
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_tournament_info_update ON tournaments;
CREATE TRIGGER on_tournament_info_update
  AFTER UPDATE ON tournaments
  FOR EACH ROW
  WHEN (OLD.info_updated_at IS DISTINCT FROM NEW.info_updated_at)
  EXECUTE FUNCTION handle_tournament_info_update();

-- ── 9. Trigger: creator notified when athlete registers ───────────────────────
CREATE OR REPLACE FUNCTION handle_new_registration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_creator_id     uuid;
  v_tournament_id  uuid;
  v_tourney_name   text;
  v_event_disc     text;
  v_athlete_name   text;
  v_trigger_secret text;
  v_notif_body     text;
  v_cta_url        text;
BEGIN
  -- Look up tournament creator + name via event
  SELECT t.creator_id, t.id, t.name, e.discipline
  INTO   v_creator_id, v_tournament_id, v_tourney_name, v_event_disc
  FROM   events e
  JOIN   tournaments t ON t.id = e.tournament_id
  WHERE  e.id = NEW.event_id;

  IF v_creator_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Look up athlete name
  SELECT name INTO v_athlete_name FROM profiles WHERE id = NEW.athlete_id;
  v_athlete_name := COALESCE(v_athlete_name, 'Vận động viên');

  v_notif_body := v_athlete_name
    || ' vừa đăng ký'
    || CASE WHEN v_event_disc IS NOT NULL THEN ' ' || v_event_disc ELSE '' END
    || ' trong giải ' || COALESCE(v_tourney_name, '');
  v_cta_url := '/tournament/' || v_tournament_id::text;

  -- Bell notification for creator
  INSERT INTO user_notifications (user_id, type, title, body, cta_url)
  VALUES (
    v_creator_id,
    'new_athlete_registration',
    'Có vận động viên mới đăng ký',
    v_notif_body,
    v_cta_url
  );

  -- PWA push via Edge Function (fire-and-forget)
  SELECT value #>> '{}' INTO v_trigger_secret FROM app_config WHERE key = 'trigger_secret';

  IF v_trigger_secret IS NOT NULL AND v_trigger_secret <> '' THEN
    BEGIN
      PERFORM net.http_post(
        url     := 'https://fmmxyccddyewxytsaiau.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type',     'application/json',
          'x-trigger-secret', v_trigger_secret
        ),
        body    := jsonb_build_object(
          'target_user_ids', jsonb_build_array(v_creator_id::text),
          'title',           'Có vận động viên mới đăng ký',
          'body',            v_notif_body,
          'url',             v_cta_url
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_registration ON tournament_registrations;
CREATE TRIGGER on_new_registration
  AFTER INSERT ON tournament_registrations
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_registration();
