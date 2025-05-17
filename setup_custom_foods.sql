-- Custom Foods Table for KetoMate app
-- This SQL script can be run directly through the Supabase dashboard SQL Editor

-- Create the table
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
-- Only allow users to view their own foods
CREATE POLICY "Users can view their own foods" 
    ON public.custom_foods FOR SELECT
    USING (auth.uid() = user_id);

-- Only allow users to insert their own foods
CREATE POLICY "Users can insert their own foods" 
    ON public.custom_foods FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Only allow users to update their own foods
CREATE POLICY "Users can update their own foods" 
    ON public.custom_foods FOR UPDATE
    USING (auth.uid() = user_id);

-- Only allow users to delete their own foods
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