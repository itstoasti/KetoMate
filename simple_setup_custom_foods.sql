-- Simple script to create the custom_foods table
CREATE TABLE IF NOT EXISTS custom_foods (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  serving_size TEXT,
  calories NUMERIC DEFAULT 0,
  carbs NUMERIC DEFAULT 0,
  protein NUMERIC DEFAULT 0,
  fat NUMERIC DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups by user_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'custom_foods_user_id_idx'
  ) THEN
    CREATE INDEX custom_foods_user_id_idx ON custom_foods(user_id);
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE custom_foods ENABLE ROW LEVEL SECURITY;

-- Create policies

-- Drop existing policies if they exist to avoid errors
DROP POLICY IF EXISTS "Users can view their own custom foods" ON custom_foods;
DROP POLICY IF EXISTS "Users can insert their own custom foods" ON custom_foods;
DROP POLICY IF EXISTS "Users can update their own custom foods" ON custom_foods;
DROP POLICY IF EXISTS "Users can delete their own custom foods" ON custom_foods;

-- Create new policies
CREATE POLICY "Users can view their own custom foods" 
  ON custom_foods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own custom foods" 
  ON custom_foods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom foods" 
  ON custom_foods FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom foods" 
  ON custom_foods FOR DELETE
  USING (auth.uid() = user_id); 