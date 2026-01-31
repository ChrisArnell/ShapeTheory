-- Taste Buds migration
-- Adds bud_bio field to user_profiles and function to get all taste buds with match percentages

-- Add bud_bio column to user_profiles for "Bud Bio" feature
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bud_bio TEXT;

-- Function to calculate shape similarity as a percentage
-- Uses Euclidean distance, converts to 0-100% scale
-- For 10 dimensions each 1-10, max distance = sqrt(10 * 81) ≈ 28.46
CREATE OR REPLACE FUNCTION shape_similarity_percent(shape1 JSONB, shape2 JSONB, domain TEXT DEFAULT 'music')
RETURNS FLOAT AS $$
DECLARE
  dim RECORD;
  sum_sq FLOAT := 0;
  v1 FLOAT;
  v2 FLOAT;
  dim_count INT := 0;
  distance FLOAT;
  max_distance FLOAT;
BEGIN
  -- Get dimensions for the specified domain
  FOR dim IN SELECT name FROM dimensions WHERE dimensions.domain = shape_similarity_percent.domain
  LOOP
    v1 := COALESCE((shape1 ->> dim.name)::FLOAT, 5.0);
    v2 := COALESCE((shape2 ->> dim.name)::FLOAT, 5.0);
    sum_sq := sum_sq + POWER(v1 - v2, 2);
    dim_count := dim_count + 1;
  END LOOP;

  IF dim_count = 0 THEN
    RETURN 0;
  END IF;

  distance := SQRT(sum_sq);
  -- Max possible distance: sqrt(dim_count * 81) since each dim can differ by 9 (1 to 10)
  max_distance := SQRT(dim_count * 81);

  -- Convert to percentage (100% = identical, 0% = maximally different)
  RETURN GREATEST(0, 100 * (1 - distance / max_distance));
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get all taste buds (other users) with their match percentages
-- Returns user_id hash, match %, and bud_bio for all users in the app
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
) AS $$
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

-- Allow users to read other users' bud_bio (for the taste buds feature)
-- We need a policy that allows viewing bud_bio of other users
CREATE POLICY "Users can view all bud bios" ON user_profiles
  FOR SELECT
  USING (true);

-- Drop the old restrictive policy if it exists (it may conflict)
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
