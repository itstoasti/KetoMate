-- Create the custom_foods table in your Supabase SQL Editor with this script:

-- Check if table exists first to avoid duplicate error
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'custom_foods'
    ) THEN
        -- Create the table only if it doesn't exist
        CREATE TABLE custom_foods (
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

        -- Create index for faster lookups by user_id
        CREATE INDEX custom_foods_user_id_idx ON custom_foods(user_id);

        -- Create index for faster text search
        CREATE INDEX custom_foods_name_idx ON custom_foods(name text_pattern_ops);

        -- Add RLS policies to ensure users can only access their own food entries
        ALTER TABLE custom_foods ENABLE ROW LEVEL SECURITY;

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
          
        RAISE NOTICE 'Created custom_foods table and security policies';
    ELSE
        RAISE NOTICE 'custom_foods table already exists, skipping creation';
    END IF;
END
$$; 