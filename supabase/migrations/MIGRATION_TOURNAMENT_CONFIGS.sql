-- Migration: Move Player Code and Attendance Configs to Tournament Level
-- Add require_player_code and attendance_enabled columns to tournaments table
-- Sync existing data from events table

-- 1. Add columns to tournaments table
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS require_player_code BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS attendance_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Backfill existing tournaments based on their events configuration
-- If any event in a tournament has require_player_code = true, the tournament gets require_player_code = true
-- If any event in a tournament has attendance_enabled = true, the tournament gets attendance_enabled = true
UPDATE tournaments t
SET require_player_code = COALESCE((
  SELECT bool_or(require_player_code)
  FROM events e
  WHERE e.tournament_id = t.id
), FALSE),
attendance_enabled = COALESCE((
  SELECT bool_or(attendance_enabled)
  FROM events e
  WHERE e.tournament_id = t.id
), FALSE);
