-- Shape Theory Database Schema
-- Run this in Supabase SQL Editor

-- Dimensions table (the axes we measure)
CREATE TABLE dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL DEFAULT 'entertainment',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed entertainment dimensions
INSERT INTO dimensions (name, domain, description) VALUES
  ('darkness', 'entertainment', 'Tolerance for dark themes, moral ambiguity, tragedy'),
  ('intellectual_engagement', 'entertainment', 'Need for complexity, puzzles, thinking'),
  ('sentimentality', 'entertainment', 'Appreciation for emotional manipulation, tearjerkers'),
  ('absurdism', 'entertainment', 'Enjoyment of surreal, nonsensical, or absurd humor'),
  ('craft_obsession', 'entertainment', 'Appreciation for technical excellence and mastery'),
  ('pandering_tolerance', 'entertainment', 'Tolerance for obvious audience-pleasing moves'),
  ('emotional_directness', 'entertainment', 'Preference for explicit vs subtle emotional expression'),
  ('vulnerability_appreciation', 'entertainment', 'Value placed on authentic vulnerability'),
  ('novelty_seeking', 'entertainment', 'Preference for new/experimental vs familiar'),
  ('working_class_authenticity', 'entertainment', 'Appreciation for blue-collar perspectives and authenticity');

-- Content table (movies, shows, music, etc.)
CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL, -- 'movie', 'show', 'album', 'artist', 'comedian', etc.
  title TEXT NOT NULL,
  metadata JSONB DEFAULT '{}', -- year, creator, genre tags, external IDs
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content shapes (dimensional ratings for content)
CREATE TABLE content_shapes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  dimension_id UUID REFERENCES dimensions(id) ON DELETE CASCADE,
  value SMALLINT CHECK (value >= 1 AND value <= 10),
  source TEXT DEFAULT 'llm', -- 'llm', 'crowd', 'expert'
  confidence REAL DEFAULT 0.7,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(content_id, dimension_id)
);

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User shapes (inferred dimensional preferences)
CREATE TABLE user_shapes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  dimension_id UUID REFERENCES dimensions(id) ON DELETE CASCADE,
  value REAL CHECK (value >= 1 AND value <= 10),
  confidence REAL DEFAULT 0.5,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, dimension_id)
);

-- User ratings of content (dimensional, not binary)
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  dimension_id UUID REFERENCES dimensions(id) ON DELETE CASCADE,
  value SMALLINT CHECK (value >= 1 AND value <= 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_id, dimension_id)
);

-- Predictions and outcomes (for learning)
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  predicted_enjoyment REAL,
  predicted_mood_shift JSONB, -- {"from": "burnt_out", "to": "energized", "confidence": 0.7}
  mood_before TEXT,
  mood_desired TEXT,
  predicted_at TIMESTAMPTZ DEFAULT NOW(),
  actual_enjoyment REAL,
  mood_after TEXT,
  completed_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX idx_content_shapes_content ON content_shapes(content_id);
CREATE INDEX idx_user_shapes_user ON user_shapes(user_id);
CREATE INDEX idx_ratings_user ON ratings(user_id);
CREATE INDEX idx_predictions_user ON predictions(user_id);
CREATE INDEX idx_predictions_incomplete ON predictions(user_id) WHERE completed_at IS NULL;

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_shapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see their own data)
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can view own shapes" ON user_shapes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shapes" ON user_shapes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shapes" ON user_shapes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view own ratings" ON ratings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ratings" ON ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own predictions" ON predictions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own predictions" ON predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own predictions" ON predictions FOR UPDATE USING (auth.uid() = user_id);

-- Public read access to dimensions and content
CREATE POLICY "Anyone can view dimensions" ON dimensions FOR SELECT USING (true);
CREATE POLICY "Anyone can view content" ON content FOR SELECT USING (true);
CREATE POLICY "Anyone can view content shapes" ON content_shapes FOR SELECT USING (true);
