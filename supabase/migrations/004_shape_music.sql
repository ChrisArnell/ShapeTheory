-- Shape Music migration
-- Adds app_type support for multiple Shape Theory apps (Music, Health, Dating, etc.)
-- Run this in Supabase SQL Editor

-- Add app_type column to users table
-- Default 'entertainment' for existing records (archived)
ALTER TABLE users ADD COLUMN IF NOT EXISTS app_type TEXT NOT NULL DEFAULT 'entertainment';

-- Add app_type to user_shapes (links shape to specific app)
ALTER TABLE user_shapes ADD COLUMN IF NOT EXISTS app_type TEXT NOT NULL DEFAULT 'entertainment';

-- Add app_type to predictions (so predictions are app-scoped)
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS app_type TEXT NOT NULL DEFAULT 'entertainment';

-- Add app_type to content (content can be shared across apps but tagged)
ALTER TABLE content ADD COLUMN IF NOT EXISTS app_type TEXT NOT NULL DEFAULT 'entertainment';

-- Add app_type to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS app_type TEXT NOT NULL DEFAULT 'entertainment';

-- Update unique constraint on user_profiles to be per-app
-- First drop existing constraint if it exists
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_user_id_key;

-- Add new unique constraint: one profile per user per app
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_app_unique UNIQUE (user_id, app_type);

-- Update unique constraint on user_shapes to be per-app
-- (user_id, dimension_id) should be unique within an app_type
DROP INDEX IF EXISTS user_shapes_user_id_dimension_id_key;
ALTER TABLE user_shapes DROP CONSTRAINT IF EXISTS user_shapes_user_id_dimension_id_key;
ALTER TABLE user_shapes ADD CONSTRAINT user_shapes_user_app_dimension_unique UNIQUE (user_id, dimension_id, app_type);

-- Create indexes for efficient app_type filtering
CREATE INDEX IF NOT EXISTS idx_users_app_type ON users(app_type);
CREATE INDEX IF NOT EXISTS idx_user_shapes_app_type ON user_shapes(app_type);
CREATE INDEX IF NOT EXISTS idx_predictions_app_type ON predictions(app_type);
CREATE INDEX IF NOT EXISTS idx_content_app_type ON content(app_type);
CREATE INDEX IF NOT EXISTS idx_user_profiles_app_type ON user_profiles(app_type);

-- Create a lookup table for app users (maps auth.users to app-specific user records)
-- This allows the same Supabase auth user to have separate profiles per app
CREATE TABLE IF NOT EXISTS app_user_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_type TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(auth_user_id, app_type)
);

-- Enable RLS on app_user_mappings
ALTER TABLE app_user_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies for app_user_mappings
CREATE POLICY "Users can view own app mappings" ON app_user_mappings
  FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can insert own app mappings" ON app_user_mappings
  FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

-- Index for quick auth user lookup
CREATE INDEX IF NOT EXISTS idx_app_user_mappings_auth_user ON app_user_mappings(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_app_user_mappings_app_type ON app_user_mappings(auth_user_id, app_type);

-- Placeholder for music dimensions (will be replaced when user provides actual dimensions)
-- These are just examples - the user will define the real music dimensions
INSERT INTO dimensions (name, domain, description) VALUES
  ('energy', 'music', 'Preference for high energy vs calm/ambient music'),
  ('complexity', 'music', 'Appreciation for musical complexity and technical skill'),
  ('lyrical_depth', 'music', 'Importance of meaningful/poetic lyrics vs instrumental/vibe'),
  ('nostalgia', 'music', 'Preference for familiar sounds vs contemporary production'),
  ('rawness', 'music', 'Appreciation for raw/unpolished vs polished production'),
  ('emotional_intensity', 'music', 'Preference for emotionally intense vs subtle music'),
  ('groove', 'music', 'Importance of rhythm and danceability'),
  ('experimentation', 'music', 'Openness to experimental/avant-garde sounds'),
  ('authenticity', 'music', 'Value placed on perceived artist authenticity'),
  ('atmosphere', 'music', 'Preference for atmospheric/immersive soundscapes')
ON CONFLICT (name) DO NOTHING;

-- Update the shape_distance function to accept a domain parameter
-- This allows calculating distances using domain-specific dimensions
CREATE OR REPLACE FUNCTION shape_distance_for_domain(shape1 JSONB, shape2 JSONB, domain TEXT)
RETURNS FLOAT AS $$
DECLARE
  dim RECORD;
  sum_sq FLOAT := 0;
  v1 FLOAT;
  v2 FLOAT;
  dim_count INT := 0;
BEGIN
  -- Get dimensions for the specified domain
  FOR dim IN SELECT name FROM dimensions WHERE dimensions.domain = shape_distance_for_domain.domain
  LOOP
    v1 := COALESCE((shape1 ->> dim.name)::FLOAT, 5.0);
    v2 := COALESCE((shape2 ->> dim.name)::FLOAT, 5.0);
    sum_sq := sum_sq + POWER(v1 - v2, 2);
    dim_count := dim_count + 1;
  END LOOP;

  IF dim_count = 0 THEN
    RETURN 0;
  END IF;

  RETURN SQRT(sum_sq);
END;
$$ LANGUAGE plpgsql STABLE;

-- Update get_weighted_predictions to support app_type filtering
CREATE OR REPLACE FUNCTION get_weighted_predictions_for_app(
  target_shape JSONB,
  target_content_id UUID DEFAULT NULL,
  app_type_filter TEXT DEFAULT 'entertainment',
  sigma FLOAT DEFAULT 8.0,
  min_weight FLOAT DEFAULT 0.1
)
RETURNS TABLE (
  content_id UUID,
  content_title TEXT,
  content_type TEXT,
  weighted_avg_enjoyment FLOAT,
  total_weight FLOAT,
  rating_count BIGINT,
  sample_raters JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH weighted_ratings AS (
    SELECT
      p.content_id,
      p.actual_enjoyment,
      p.user_shape_snapshot,
      shape_distance_for_domain(target_shape, p.user_shape_snapshot,
        CASE WHEN app_type_filter = 'music' THEN 'music' ELSE 'entertainment' END) as dist,
      shape_weight(shape_distance_for_domain(target_shape, p.user_shape_snapshot,
        CASE WHEN app_type_filter = 'music' THEN 'music' ELSE 'entertainment' END), sigma) as weight
    FROM predictions p
    WHERE p.actual_enjoyment IS NOT NULL
      AND p.user_shape_snapshot IS NOT NULL
      AND p.user_shape_snapshot != '{}'::jsonb
      AND p.app_type = app_type_filter
      AND (target_content_id IS NULL OR p.content_id = target_content_id)
  )
  SELECT
    wr.content_id,
    c.title as content_title,
    c.content_type,
    SUM(wr.actual_enjoyment * wr.weight) / NULLIF(SUM(wr.weight), 0) as weighted_avg_enjoyment,
    SUM(wr.weight) as total_weight,
    COUNT(*) as rating_count,
    jsonb_agg(jsonb_build_object('distance', ROUND(wr.dist::numeric, 2), 'rating', wr.actual_enjoyment))
      FILTER (WHERE wr.weight >= min_weight) as sample_raters
  FROM weighted_ratings wr
  JOIN content c ON c.id = wr.content_id
  WHERE wr.weight >= min_weight
  GROUP BY wr.content_id, c.title, c.content_type
  HAVING SUM(wr.weight) >= 0.5
  ORDER BY SUM(wr.weight) DESC;
END;
$$ LANGUAGE plpgsql;
