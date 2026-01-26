-- Migration 009: Fix race condition in create_app_user function
--
-- Problem: Multiple concurrent calls to create_app_user (e.g., from getSession + onAuthStateChange)
-- can race and cause:
-- - Duplicate user records
-- - Unique constraint violations on app_user_mappings
-- - Timeouts due to blocked transactions
--
-- Solution: Use advisory lock to serialize access per (auth_user_id, app_type)

-- ============================================================
-- Replace the function with race-condition-safe version
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
  v_lock_key BIGINT;
BEGIN
  -- Generate a unique lock key for this (auth_user_id, app_type) combination
  -- This serializes concurrent calls for the same user/app
  v_lock_key := hashtext(p_auth_user_id::text || '::' || p_app_type);

  -- Acquire advisory lock (released automatically at transaction end)
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Now safe to check if mapping exists (no race possible)
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

  -- Create the mapping (this will succeed because we hold the lock)
  INSERT INTO app_user_mappings (auth_user_id, app_type, user_id)
  VALUES (p_auth_user_id, p_app_type, v_user_id);

  RETURN v_user_id;
END;
$$;

-- ============================================================
-- Update comment
-- ============================================================

COMMENT ON FUNCTION create_app_user IS
'Atomically creates a user record and app_user_mapping for a new app user.
Uses SECURITY DEFINER to bypass RLS and advisory locks to handle concurrent access.
Safe to call concurrently - only one call will create records, others will return existing user_id.';
