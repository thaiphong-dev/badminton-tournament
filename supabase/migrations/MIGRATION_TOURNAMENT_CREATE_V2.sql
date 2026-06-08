-- Migration: TournamentCreate v2 — registration deadline, prize structure, file URLs, event max_teams
-- Run this in Supabase SQL Editor before using the new tournament creation flow.

-- New columns on tournaments
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS registration_deadline date,
  ADD COLUMN IF NOT EXISTS prize_structure       text,
  ADD COLUMN IF NOT EXISTS regulations_url       text,
  ADD COLUMN IF NOT EXISTS chat_qr_url           text;

-- New column on events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS max_teams int;

-- Storage bucket for tournament assets (run once)
-- In Supabase dashboard: Storage → New bucket → "tournament-assets", Public = true
-- Or via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('tournament-assets', 'tournament-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: allow authenticated users to upload
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'tournament-assets upload'
  ) THEN
    CREATE POLICY "tournament-assets upload"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'tournament-assets');
  END IF;
END $$;

-- RLS policy: allow public read
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'tournament-assets public read'
  ) THEN
    CREATE POLICY "tournament-assets public read"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'tournament-assets');
  END IF;
END $$;
