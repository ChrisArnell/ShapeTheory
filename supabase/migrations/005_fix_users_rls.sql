-- Fix RLS policies for all tables that use app-specific user IDs
-- The original policies checked auth.uid() = user_id, but user_id now references
-- users.id (a generated UUID), not auth.users.id. We need policies that work with
-- the app_user_mappings table which maps auth users to app-specific users.

-- ============================================================
-- USERS TABLE
-- ============================================================

-- Drop the broken existing policy
DROP POLICY IF EXISTS "Users can view own data" ON users;

-- Allow authenticated users to INSERT new user records
-- The app_user_mappings table (with its own RLS) ensures proper access control
CREATE POLICY "Authenticated users can create users" ON users
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow users to SELECT their own user records via app_user_mappings
CREATE POLICY "Users can view own data via mapping" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM app_user_mappings
      WHERE app_user_mappings.user_id = users.id
        AND app_user_mappings.auth_user_id = auth.uid()
    )
  );

-- Allow users to UPDATE their own user records via app_user_mappings
CREATE POLICY "Users can update own data via mapping" ON users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM app_user_mappings
      WHERE app_user_mappings.user_id = users.id
        AND app_user_mappings.auth_user_id = auth.uid()
    )
  );

-- Allow users to DELETE their own user records via app_user_mappings
CREATE POLICY "Users can delete own data via mapping" ON users
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM app_user_mappings
      WHERE app_user_mappings.user_id = users.id
        AND app_user_mappings.auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- USER_SHAPES TABLE
-- ============================================================

-- Drop existing broken policies
DROP POLICY IF EXISTS "Users can view own shapes" ON user_shapes;
DROP POLICY IF EXISTS "Users can insert own shapes" ON user_shapes;
DROP POLICY IF EXISTS "Users can update own shapes" ON user_shapes;

-- New policies that check ownership via app_user_mappings
CREATE POLICY "Users can view own shapes via mapping" ON user_shapes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM app_user_mappings
      WHERE app_user_mappings.user_id = user_shapes.user_id
        AND app_user_mappings.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own shapes via mapping" ON user_shapes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_user_mappings
      WHERE app_user_mappings.user_id = user_shapes.user_id
        AND app_user_mappings.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own shapes via mapping" ON user_shapes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM app_user_mappings
      WHERE app_user_mappings.user_id = user_shapes.user_id
        AND app_user_mappings.auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- RATINGS TABLE
-- ============================================================

-- Drop existing broken policies
DROP POLICY IF EXISTS "Users can view own ratings" ON ratings;
DROP POLICY IF EXISTS "Users can insert own ratings" ON ratings;

-- New policies that check ownership via app_user_mappings
CREATE POLICY "Users can view own ratings via mapping" ON ratings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM app_user_mappings
      WHERE app_user_mappings.user_id = ratings.user_id
        AND app_user_mappings.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own ratings via mapping" ON ratings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_user_mappings
      WHERE app_user_mappings.user_id = ratings.user_id
        AND app_user_mappings.auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- PREDICTIONS TABLE
-- ============================================================

-- Drop existing broken policies
DROP POLICY IF EXISTS "Users can view own predictions" ON predictions;
DROP POLICY IF EXISTS "Users can insert own predictions" ON predictions;
DROP POLICY IF EXISTS "Users can update own predictions" ON predictions;

-- New policies that check ownership via app_user_mappings
CREATE POLICY "Users can view own predictions via mapping" ON predictions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM app_user_mappings
      WHERE app_user_mappings.user_id = predictions.user_id
        AND app_user_mappings.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own predictions via mapping" ON predictions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_user_mappings
      WHERE app_user_mappings.user_id = predictions.user_id
        AND app_user_mappings.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own predictions via mapping" ON predictions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM app_user_mappings
      WHERE app_user_mappings.user_id = predictions.user_id
        AND app_user_mappings.auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- USER_PROFILES TABLE
-- ============================================================

-- The user_profiles table was originally created with user_id referencing auth.users(id)
-- but the app now stores users.id there. We need to fix the FK and RLS policies.

-- First, drop the existing FK constraint (if it exists)
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_user_id_fkey;

-- Add new FK referencing users table instead of auth.users
-- Note: This may fail if there's existing data with auth user IDs - in that case,
-- the data needs to be migrated first
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Drop existing broken policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- New policies that check ownership via app_user_mappings
CREATE POLICY "Users can view own profile via mapping" ON user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM app_user_mappings
      WHERE app_user_mappings.user_id = user_profiles.user_id
        AND app_user_mappings.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own profile via mapping" ON user_profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_user_mappings
      WHERE app_user_mappings.user_id = user_profiles.user_id
        AND app_user_mappings.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own profile via mapping" ON user_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM app_user_mappings
      WHERE app_user_mappings.user_id = user_profiles.user_id
        AND app_user_mappings.auth_user_id = auth.uid()
    )
  );
