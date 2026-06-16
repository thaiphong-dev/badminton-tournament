-- Migration: Add 'round_robin' format option to events check constraint
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_format_check;
ALTER TABLE events ADD CONSTRAINT events_format_check CHECK (format IN ('group_then_knockout', 'knockout_only', 'round_robin'));
