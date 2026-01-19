-- Add hierarchy and external ID support to content table
-- Run this in Supabase SQL Editor

-- Add new columns to content table
ALTER TABLE content ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES content(id) ON DELETE CASCADE;
ALTER TABLE content ADD COLUMN IF NOT EXISTS subtitle TEXT; -- "S2 E1", "Deluxe Edition", etc.
ALTER TABLE content ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE content ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE content ADD COLUMN IF NOT EXISTS external_source TEXT; -- 'tmdb', 'spotify', 'musicbrainz'
ALTER TABLE content ADD COLUMN IF NOT EXISTS consensus_shape JSONB DEFAULT '{}';
ALTER TABLE content ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

-- Add user_shape_snapshot to predictions if not exists
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS user_shape_snapshot JSONB DEFAULT '{}';

-- Index for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_content_parent ON content(parent_id);
CREATE INDEX IF NOT EXISTS idx_content_external ON content(external_source, external_id);
CREATE INDEX IF NOT EXISTS idx_content_type ON content(content_type);

-- Function to calculate Euclidean distance between two shapes
CREATE OR REPLACE FUNCTION shape_distance(shape1 JSONB, shape2 JSONB)
RETURNS FLOAT AS $$
DECLARE
  dim TEXT;
  dims TEXT[] := ARRAY['darkness', 'intellectual_engagement', 'sentimentality', 'absurdism',
                        'craft_obsession', 'pandering_tolerance', 'emotional_directness',
                        'vulnerability_appreciation', 'novelty_seeking', 'working_class_authenticity'];
  sum_sq FLOAT := 0;
  v1 FLOAT;
  v2 FLOAT;
BEGIN
  FOREACH dim IN ARRAY dims
  LOOP
    v1 := COALESCE((shape1 ->> dim)::FLOAT, 5.0);
    v2 := COALESCE((shape2 ->> dim)::FLOAT, 5.0);
    sum_sq := sum_sq + POWER(v1 - v2, 2);
  END LOOP;
  RETURN SQRT(sum_sq);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate Gaussian decay weight from distance
-- sigma controls neighborhood size (default 8 = moderate neighborhood)
CREATE OR REPLACE FUNCTION shape_weight(distance FLOAT, sigma FLOAT DEFAULT 8.0)
RETURNS FLOAT AS $$
BEGIN
  RETURN EXP(-POWER(distance, 2) / (2 * POWER(sigma, 2)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get weighted predictions for content based on shape similarity
CREATE OR REPLACE FUNCTION get_weighted_predictions(
  target_shape JSONB,
  target_content_id UUID DEFAULT NULL,
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
      shape_distance(target_shape, p.user_shape_snapshot) as dist,
      shape_weight(shape_distance(target_shape, p.user_shape_snapshot), sigma) as weight
    FROM predictions p
    WHERE p.actual_enjoyment IS NOT NULL
      AND p.user_shape_snapshot IS NOT NULL
      AND p.user_shape_snapshot != '{}'::jsonb
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
  HAVING SUM(wr.weight) >= 0.5  -- At least some meaningful weight
  ORDER BY SUM(wr.weight) DESC;
END;
$$ LANGUAGE plpgsql;
