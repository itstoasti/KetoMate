# Custom Foods Table Setup

Your nutrition label scanning is working correctly, but the custom foods database table needs to be set up to save these entries for future searches.

## Quick Setup (Recommended)

1. Log in to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your KetoMate project
3. Go to the "SQL Editor" section from the left sidebar
4. Click "New Query"
5. Copy and paste the SQL below
6. Click "Run" to execute the SQL script

```sql
-- Custom Foods Table for KetoMate app
CREATE TABLE IF NOT EXISTS public.custom_foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    brand TEXT,
    serving_size TEXT,
    calories INTEGER DEFAULT 0,
    carbs DECIMAL(10, 2) DEFAULT 0,
    protein DECIMAL(10, 2) DEFAULT 0,
    fat DECIMAL(10, 2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS custom_foods_user_id_idx ON public.custom_foods(user_id);
CREATE INDEX IF NOT EXISTS custom_foods_name_idx ON public.custom_foods(name);

-- Setup RLS (Row Level Security)
ALTER TABLE public.custom_foods ENABLE ROW LEVEL SECURITY;

-- Create policies for secure access
CREATE POLICY "Users can view their own foods" 
    ON public.custom_foods FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own foods" 
    ON public.custom_foods FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own foods" 
    ON public.custom_foods FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own foods" 
    ON public.custom_foods FOR DELETE
    USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_custom_foods_modtime
BEFORE UPDATE ON public.custom_foods
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();
```

## After Setup

Once you've run the SQL script:

1. Return to the KetoMate app
2. Scan a nutrition label again
3. The detected food should now save correctly to your database
4. You'll be able to search for this food in future searches 