-- MF-4: Creator Analytics Dashboard
-- Adds get_creator_analytics() SECURITY DEFINER function.
-- Returns tournament summary, monthly activity (6 months), match completion rate,
-- total unique players managed, and 5 most recent tournaments.

CREATE OR REPLACE FUNCTION get_creator_analytics(p_creator_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total_tournaments     INT;
  v_completed_tournaments INT;
  v_total_players         INT;
  v_total_matches         INT;
  v_completed_matches     INT;
  v_match_completion_rate NUMERIC;
  v_monthly               JSON;
  v_recent                JSON;
BEGIN
  -- Guard: p_creator_id must be a valid creator or admin profile
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_creator_id 
      AND role IN ('creator', 'admin') 
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Tournament counts
  SELECT
    COUNT(*)                                               INTO v_total_tournaments
  FROM tournaments
  WHERE creator_id = p_creator_id;

  SELECT
    COUNT(*)                                               INTO v_completed_tournaments
  FROM tournaments
  WHERE creator_id = p_creator_id AND status = 'completed';

  -- Unique players across all events of creator's tournaments
  SELECT COUNT(DISTINCT tr.athlete_id)                    INTO v_total_players
  FROM tournament_registrations tr
  JOIN tournaments t ON t.id = tr.tournament_id
  WHERE t.creator_id = p_creator_id
    AND tr.status = 'approved';

  -- Match stats
  SELECT
    COUNT(*)                                               INTO v_total_matches
  FROM matches m
  JOIN tournaments t ON t.id = m.tournament_id
  WHERE t.creator_id = p_creator_id;

  SELECT
    COUNT(*)                                               INTO v_completed_matches
  FROM matches m
  JOIN tournaments t ON t.id = m.tournament_id
  WHERE t.creator_id = p_creator_id AND m.status = 'completed';

  v_match_completion_rate := CASE
    WHEN v_total_matches = 0 THEN 0
    ELSE ROUND(100.0 * v_completed_matches / v_total_matches, 1)
  END;

  -- Monthly tournament count — last 6 months
  SELECT json_agg(row_order)
  INTO v_monthly
  FROM (
    SELECT
      TO_CHAR(DATE_TRUNC('month', gs.month), 'MM/YY') AS month,
      COALESCE(COUNT(t.id), 0)::INT                   AS count
    FROM generate_series(
      DATE_TRUNC('month', NOW()) - INTERVAL '5 months',
      DATE_TRUNC('month', NOW()),
      INTERVAL '1 month'
    ) AS gs(month)
    LEFT JOIN tournaments t
      ON DATE_TRUNC('month', t.created_at) = gs.month
      AND t.creator_id = p_creator_id
    GROUP BY gs.month
    ORDER BY gs.month
  ) row_order;

  -- 5 most recent tournaments
  SELECT json_agg(row_order)
  INTO v_recent
  FROM (
    SELECT id, name, status, created_at
    FROM tournaments
    WHERE creator_id = p_creator_id
    ORDER BY created_at DESC
    LIMIT 5
  ) row_order;

  RETURN json_build_object(
    'total_tournaments',      v_total_tournaments,
    'completed_tournaments',  v_completed_tournaments,
    'total_players',          v_total_players,
    'match_completion_rate',  v_match_completion_rate,
    'monthly_tournaments',    COALESCE(v_monthly, '[]'::JSON),
    'recent_tournaments',     COALESCE(v_recent,  '[]'::JSON)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_creator_analytics(UUID) TO anon, authenticated;
