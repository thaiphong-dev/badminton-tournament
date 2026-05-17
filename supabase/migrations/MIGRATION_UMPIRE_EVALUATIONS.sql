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

COMMENT ON TABLE umpire_evaluations IS 'BTC rates umpire quality after each match. One evaluation per match.';
