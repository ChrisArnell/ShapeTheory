-- Migration 007: Comprehensive fix for users table INSERT policy
-- This migration ensures authenticated users can create new user records
--
-- Root cause: The original schema had no INSERT policy for users table,
-- and subsequent migrations may not have been applied correctly.
--
-- This migration is idempotent and safe to run multiple times.

-- ============================================================
-- Step 1: Drop ALL existing policies on users table
-- ============================================================
-- We drop ALL policies to ensure a clean slate

DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Drop all existing policies on the users table
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'users' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON users', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- Also explicitly drop known policy names (in case the above misses any)
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can view own data via mapping" ON users;
DROP POLICY IF EXISTS "Users can update own data via mapping" ON users;
DROP POLICY IF EXISTS "Users can delete own data via mapping" ON users;
DROP POLICY IF EXISTS "Authenticated users can create users" ON users;
DROP POLICY IF EXISTS "Authenticated users can insert users" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to insert" ON users;

-- ============================================================
-- Step 2: Ensure RLS is enabled
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Step 3: Create new policies using the USING/TO syntax
-- ============================================================

-- INSERT policy: Any authenticated user can create a user record
-- This is safe because:
--   1. The id is auto-generated (gen_random_uuid()), not user-controlled
--   2. The app_user_mappings table controls access to user records
--   3. Creating a user record alone grants no access - the mapping must also be created
CREATE POLICY "users_insert_policy" ON users
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- SELECT policy: Users can only view their own records via app_user_mappings
CREATE POLICY "users_select_policy" ON users
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM app_user_mappings
            WHERE app_user_mappings.user_id = users.id
              AND app_user_mappings.auth_user_id = auth.uid()
        )
    );

-- UPDATE policy: Users can only update their own records via app_user_mappings
CREATE POLICY "users_update_policy" ON users
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM app_user_mappings
            WHERE app_user_mappings.user_id = users.id
              AND app_user_mappings.auth_user_id = auth.uid()
        )
    );

-- DELETE policy: Users can only delete their own records via app_user_mappings
CREATE POLICY "users_delete_policy" ON users
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM app_user_mappings
            WHERE app_user_mappings.user_id = users.id
              AND app_user_mappings.auth_user_id = auth.uid()
        )
    );

-- ============================================================
-- Step 4: Verify app_user_mappings policies are correct
-- ============================================================

-- Drop and recreate app_user_mappings policies to ensure they work
DROP POLICY IF EXISTS "Users can view own app mappings" ON app_user_mappings;
DROP POLICY IF EXISTS "Users can insert own app mappings" ON app_user_mappings;
DROP POLICY IF EXISTS "app_user_mappings_select_policy" ON app_user_mappings;
DROP POLICY IF EXISTS "app_user_mappings_insert_policy" ON app_user_mappings;

-- Ensure RLS is enabled
ALTER TABLE app_user_mappings ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view their own mappings
CREATE POLICY "app_user_mappings_select_policy" ON app_user_mappings
    FOR SELECT
    TO authenticated
    USING (auth.uid() = auth_user_id);

-- INSERT: Users can create mappings for themselves
CREATE POLICY "app_user_mappings_insert_policy" ON app_user_mappings
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = auth_user_id);

-- ============================================================
-- Step 5: Grant necessary permissions
-- ============================================================

-- Ensure authenticated role has permissions on these tables
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;
GRANT SELECT, INSERT ON app_user_mappings TO authenticated;
