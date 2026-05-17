-- Migration: Add bilingual fields to subscription_plans
-- Admin can enter English name + descriptions for international users

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS name_en        TEXT,
  ADD COLUMN IF NOT EXISTS description_vi TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

COMMENT ON COLUMN subscription_plans.name_en        IS 'English plan name shown to EN users';
COMMENT ON COLUMN subscription_plans.description_vi IS 'Plan description in Vietnamese';
COMMENT ON COLUMN subscription_plans.description_en IS 'Plan description in English';
