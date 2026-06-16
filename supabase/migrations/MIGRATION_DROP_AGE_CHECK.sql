-- Migration: Drop age category check constraint
-- This migration drops the check constraint on age_category in the events table
-- to allow custom numeric values (like 'u18to30', 'u15', 'u40plus') instead of fixed options.

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_age_category_check;
