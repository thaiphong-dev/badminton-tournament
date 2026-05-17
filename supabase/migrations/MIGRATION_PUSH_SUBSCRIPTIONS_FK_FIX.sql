-- Fix: push_subscriptions.user_id foreign key was referencing auth.users(id)
-- App uses custom auth — profile IDs are not Supabase auth UIDs.
-- Re-reference to profiles(id) instead.

ALTER TABLE push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_fkey;

ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
