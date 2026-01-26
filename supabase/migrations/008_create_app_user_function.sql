-- Migration 008: Create atomic function for app user creation
--
-- Problem: RLS chicken-and-egg during initial user setup
-- - INSERT into users table needs .select('id') to get the new ID
-- - SELECT policy checks app_user_mappings for authorization
-- - But app_user_mappings can't be created until we have the user ID
--
-- Solution: Use a SECURITY DEFINER function that bypasses RLS
-- This function atomically creates both records and returns the user_id

-- ============================================================
-- Step 1: Create the atomic user creation function
-- ============================================================

CREATE OR REPLACE FUNCTION create_app_user(
  p_auth_user_id UUID,
  p_email TEXT,
  p_app_type TEXT DEFAULT 'entertainment'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_existing_user_id UUID;
BEGIN
  -- First, check if mapping already exists (idempotent)
  SELECT user_id INTO v_existing_user_id
  FROM app_user_mappings
  WHERE auth_user_id = p_auth_user_id
    AND app_type = p_app_type;

  IF v_existing_user_id IS NOT NULL THEN
    RETURN v_existing_user_id;
  END IF;

  -- Create the user record
  INSERT INTO users (email, app_type)
  VALUES (
    CASE WHEN p_email IS NOT NULL THEN p_email || '_' || p_app_type ELSE NULL END,
    p_app_type
  )
  RETURNING id INTO v_user_id;

  -- Create the mapping
  INSERT INTO app_user_mappings (auth_user_id, app_type, user_id)
  VALUES (p_auth_user_id, p_app_type, v_user_id);

  RETURN v_user_id;
END;
$$;

-- ============================================================
-- Step 2: Grant execute permission to authenticated users
-- ============================================================

GRANT EXECUTE ON FUNCTION create_app_user(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================
-- Step 3: Add comment for documentation
-- ============================================================

COMMENT ON FUNCTION create_app_user IS
'Atomically creates a user record and app_user_mapping for a new app user.
This function uses SECURITY DEFINER to bypass RLS during the creation process.
It is idempotent - calling it multiple times with the same parameters returns the existing user_id.';
