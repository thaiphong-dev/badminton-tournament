-- ── Advanced tiebreaker ruleset per event ───────────────────────────────────
-- Options: 'bwf' (default) | 'sets_first' | 'h2h_score_first'
ALTER TABLE events ADD COLUMN IF NOT EXISTS tiebreaker_mode TEXT NOT NULL DEFAULT 'bwf'
  CHECK (tiebreaker_mode IN ('bwf', 'sets_first', 'h2h_score_first'));

COMMENT ON COLUMN events.tiebreaker_mode IS
  'Tiebreaker ruleset for group stage standings. '
  'bwf: H2H wins → H2H sets diff → H2H score diff → overall sets diff → overall score diff. '
  'sets_first: overall sets diff → overall score diff (bỏ qua H2H). '
  'h2h_score_first: H2H score first, then sets.';

-- ── Time-based scheduling: optional start time + wave duration per event ─────
ALTER TABLE events ADD COLUMN IF NOT EXISTS schedule_start_time  TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS wave_duration_minutes SMALLINT NOT NULL DEFAULT 45
  CHECK (wave_duration_minutes BETWEEN 10 AND 240);

COMMENT ON COLUMN events.schedule_start_time IS
  'Optional: ISO datetime for wave 1 start. If set, CourtBoard shows estimated time per wave.';
COMMENT ON COLUMN events.wave_duration_minutes IS
  'Estimated minutes per wave (default 45). Used to compute scheduled times.';

-- ── Doubles partner matching ─────────────────────────────────────────────────
-- (Actual table name used in codebase: tournament_registrations)
ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS looking_for_partner BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS partner_note TEXT;

COMMENT ON COLUMN tournament_registrations.looking_for_partner IS
  'True if athlete is looking for a doubles partner for this event.';
COMMENT ON COLUMN tournament_registrations.partner_note IS
  'Optional message shown to potential partners (max 100 chars).';

-- ── Referee evaluation ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS umpire_evaluations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  umpire_id    uuid NOT NULL,
  evaluated_by uuid NOT NULL,
  rating       smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS umpire_eval_match_idx ON umpire_evaluations(match_id);

ALTER TABLE umpire_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eval_creator_write" ON umpire_evaluations
  FOR INSERT WITH CHECK (auth.uid() = evaluated_by);
CREATE POLICY "eval_creator_read" ON umpire_evaluations
  FOR SELECT USING (auth.uid() = evaluated_by OR auth.uid() = umpire_id);

-- ── Push subscriptions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_idx
  ON push_subscriptions(user_id, endpoint);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_own_read"    ON push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "push_own_insert"  ON push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_own_update"  ON push_subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "push_own_delete"  ON push_subscriptions FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "push_service_read" ON push_subscriptions FOR SELECT TO service_role USING (true);

COMMENT ON TABLE push_subscriptions IS
  'Web Push API subscriptions. Read by send-push Edge Function via service_role.';
