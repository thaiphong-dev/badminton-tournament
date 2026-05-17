-- Track whether the umpire's scoring app is still alive during an active match.
-- UmpireMatchPage pings this every 30 s alongside the live-score sync.
-- BTC's CourtBoard uses it to detect a dropped connection and show recovery options.

ALTER TABLE matches ADD COLUMN IF NOT EXISTS umpire_heartbeat_at TIMESTAMPTZ;
