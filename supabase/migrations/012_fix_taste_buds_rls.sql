-- Fix taste buds function to bypass RLS
-- The get_taste_buds function needs to read ALL users' shapes, not just the current user's
-- Using SECURITY DEFINER allows the function to run with the privileges of the function owner
-- (typically the superuser who created it), bypassing RLS policies

-- Recreate the function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION get_taste_buds(
  current_user_id UUID,
  current_shape JSONB,
  app_type_filter TEXT DEFAULT 'music'
)
RETURNS TABLE (
  user_id_hash TEXT,
  match_percent FLOAT,
  bud_bio TEXT,
  actual_user_id UUID
)
SECURITY DEFINER  -- This allows the function to bypass RLS
SET search_path = public  -- Security best practice when using SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_shapes_agg AS (
    -- Aggregate each user's shape into a single JSONB object
    SELECT
      us.user_id,
      jsonb_object_agg(d.name, us.value) as shape
    FROM user_shapes us
    JOIN dimensions d ON us.dimension_id = d.id
    WHERE us.app_type = app_type_filter
      AND us.user_id != current_user_id
    GROUP BY us.user_id
  )
  SELECT
    -- Create a deterministic but anonymized hash of user_id
    encode(sha256(usa.user_id::text::bytea), 'hex')::TEXT as user_id_hash,
    ROUND(shape_similarity_percent(current_shape, usa.shape,
      CASE WHEN app_type_filter = 'music' THEN 'music' ELSE 'entertainment' END)::numeric, 1)::FLOAT as match_percent,
    up.bud_bio,
    usa.user_id as actual_user_id
  FROM user_shapes_agg usa
  LEFT JOIN user_profiles up ON up.user_id = usa.user_id AND up.app_type = app_type_filter
  ORDER BY match_percent DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_taste_buds(UUID, JSONB, TEXT) TO authenticated;
