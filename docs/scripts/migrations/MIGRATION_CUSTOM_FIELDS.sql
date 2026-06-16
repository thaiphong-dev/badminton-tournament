-- MIGRATION_CUSTOM_FIELDS.sql
-- Sprint C1: Thêm custom registration fields cho events

-- Column on events: stores field schema as JSONB array
-- Schema of each element:
-- {
--   "id":       "uuid-string",      -- stable ID for value lookup
--   "label":    "Size áo",          -- display label
--   "type":     "text"|"select"|"checkbox",
--   "required": true|false,
--   "options":  ["A","B","AB","O"]  -- only for type="select"
-- }
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS custom_fields jsonb
    NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN events.custom_fields IS
  'Array of custom registration field definitions (max 5). Schema: [{id, label, type, required, options?}]';

-- Column on tournament_registrations: stores collected values per field ID
-- Schema: { [fieldId]: value }
ALTER TABLE tournament_registrations
  ADD COLUMN IF NOT EXISTS custom_field_values jsonb
    NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN tournament_registrations.custom_field_values IS
  'Map of fieldId → collected value for this registration. Matches events.custom_fields[*].id keys.';

-- Rollback:
-- ALTER TABLE events              DROP COLUMN IF EXISTS custom_fields;
-- ALTER TABLE tournament_registrations DROP COLUMN IF EXISTS custom_field_values;
