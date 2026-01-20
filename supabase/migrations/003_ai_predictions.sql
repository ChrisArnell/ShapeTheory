-- Add AI prediction tracking to predictions table
-- Run this in Supabase SQL Editor

-- When user makes their own prediction, we also track Abre's prediction
-- predicted_enjoyment = primary prediction (user's if user_initiated, AI's otherwise)
-- ai_predicted_enjoyment = Abre's prediction when user provides their own
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS ai_predicted_enjoyment INTEGER;

-- Index for analyzing calibration differences between user and AI predictions
CREATE INDEX IF NOT EXISTS idx_predictions_dual ON predictions(predicted_enjoyment, ai_predicted_enjoyment)
WHERE ai_predicted_enjoyment IS NOT NULL;
