-- MIGRATION_ATHLETE_MATCH_PUSH.sql
-- Sprint B1: DB-level push notification khi trận được gọi (status → 'calling')
--
-- STATUS: Optional — realtime toast notifications already work via the
--         Supabase Realtime subscription in AthleteDashboard.jsx.
--         This trigger adds out-of-app push notifications (requires device
--         push tokens stored in push_subscriptions table and send-push Edge Function).
--
-- Prerequisites:
--   1. push_subscriptions table with (user_id, endpoint, p256dh, auth) columns
--   2. send-push Edge Function deployed at /functions/v1/send-push
--   3. pg_net extension enabled on the Supabase project
--
-- Run AFTER verifying prerequisites above.
-- Rollback: DROP TRIGGER IF EXISTS trg_match_calling_push ON matches;

-- Function: notifies both players when match.status transitions to 'calling'
CREATE OR REPLACE FUNCTION notify_match_calling()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_player1_athlete_id uuid;
  v_player2_athlete_id uuid;
  v_tournament_name    text;
  v_court              text;
  v_payload            jsonb;
BEGIN
  -- Only fire on status transition → 'calling'
  IF NEW.status <> 'calling' OR OLD.status = 'calling' THEN
    RETURN NEW;
  END IF;

  -- Resolve athlete IDs from player records
  SELECT athlete_id INTO v_player1_athlete_id FROM players WHERE id = NEW.player1_id;
  SELECT athlete_id INTO v_player2_athlete_id FROM players WHERE id = NEW.player2_id;

  -- Tournament name for notification body
  SELECT name INTO v_tournament_name FROM tournaments WHERE id = NEW.tournament_id;

  v_court := COALESCE('Sân ' || NEW.court_number::text, 'sân thi đấu');

  -- Build push payload
  v_payload := jsonb_build_object(
    'title', '📞 Trận đấu sắp bắt đầu!',
    'body',  format('Vui lòng vào %s ngay — %s', v_court, COALESCE(v_tournament_name, '')),
    'url',   '/athlete'
  );

  -- Send to player 1's push subscriptions (if any)
  IF v_player1_athlete_id IS NOT NULL THEN
    PERFORM net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := jsonb_build_object('userId', v_player1_athlete_id, 'payload', v_payload)
    );
  END IF;

  -- Send to player 2's push subscriptions (if any)
  IF v_player2_athlete_id IS NOT NULL AND v_player2_athlete_id <> v_player1_athlete_id THEN
    PERFORM net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := jsonb_build_object('userId', v_player2_athlete_id, 'payload', v_payload)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger: fires AFTER UPDATE on matches
DROP TRIGGER IF EXISTS trg_match_calling_push ON matches;
CREATE TRIGGER trg_match_calling_push
  AFTER UPDATE OF status ON matches
  FOR EACH ROW
  EXECUTE FUNCTION notify_match_calling();
