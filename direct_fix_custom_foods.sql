-- Direct Fix for Custom Foods Table
-- This script drops the table if it exists and recreates it completely

-- First, drop existing table if it's causing problems
DROP TABLE IF EXISTS public.custom_foods CASCADE;

-- Drop function if it exists
DROP FUNCTION IF EXISTS public.update_modified_column CASCADE;

-- Create function for updated_at trigger
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the table from scratch
CREATE TABLE public.custom_foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE INDEX custom_foods_user_id_idx ON public.custom_foods(user_id);
CREATE INDEX custom_foods_name_idx ON public.custom_foods(name);

-- Setup RLS (Row Level Security)
ALTER TABLE public.custom_foods ENABLE ROW LEVEL SECURITY;

-- Create policies 
CREATE POLICY "Allow users to view their own custom foods" 
    ON public.custom_foods FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Allow users to insert their own custom foods" 
    ON public.custom_foods FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own custom foods" 
    ON public.custom_foods FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Allow users to delete their own custom foods" 
    ON public.custom_foods FOR DELETE
    USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_custom_foods_modtime
BEFORE UPDATE ON public.custom_foods
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column(); 