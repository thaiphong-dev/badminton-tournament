ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS looking_for_partner BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS partner_note TEXT;

COMMENT ON COLUMN tournament_registrations.looking_for_partner IS 'True if athlete is looking for a doubles partner for this event.';
COMMENT ON COLUMN tournament_registrations.partner_note IS 'Optional message shown to potential partners (max 100 chars).';
