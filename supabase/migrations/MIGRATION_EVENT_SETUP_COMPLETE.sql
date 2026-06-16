-- Migration: Track setup completion for events
-- Run this in Supabase SQL Editor.
ALTER TABLE events ADD COLUMN IF NOT EXISTS setup_complete BOOLEAN NOT NULL DEFAULT FALSE;
