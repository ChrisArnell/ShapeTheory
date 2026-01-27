-- Add missing DELETE policy for predictions table
-- The previous migrations only added SELECT, INSERT, UPDATE policies
-- Without a DELETE policy, Supabase RLS blocks deletion attempts silently

-- Drop if exists to make this migration idempotent
DROP POLICY IF EXISTS "Users can delete own predictions via mapping" ON predictions;

-- Allow users to DELETE their own predictions via app_user_mappings
CREATE POLICY "Users can delete own predictions via mapping" ON predictions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM app_user_mappings
      WHERE app_user_mappings.user_id = predictions.user_id
        AND app_user_mappings.auth_user_id = auth.uid()
    )
  );
