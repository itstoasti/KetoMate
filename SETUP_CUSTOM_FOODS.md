# Setting Up the Custom Foods Feature

This document explains how to set up the custom foods database table that allows users to search for their previously added food items.

## Problem: 
When manually adding foods, they currently aren't being saved for future searches.

## Solution:
You need to create a database table called `custom_foods` in your Supabase project.

## Steps to Set Up:

1. **Login to your Supabase Dashboard**
   - Go to https://app.supabase.com/ and sign in
   - Select your KetoMate project

2. **Open the SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the SQL Script**
   - Copy the entire contents of the `simple_setup_custom_foods.sql` file 
   - Paste it into the SQL Editor
   - Click "Run" to execute the script

4. **Verify the Table was Created**
   - Click "Table Editor" in the left sidebar
   - Look for the `custom_foods` table in the list of tables
   - If you see it, the setup was successful!

## Troubleshooting:

If you get errors when running the SQL script:

1. **Check if the table already exists**
   - In the SQL Editor, run: `SELECT * FROM custom_foods LIMIT 1;`
   - If you get results or no error, the table already exists

2. **Check permissions**
   - Make sure Row Level Security (RLS) is enabled for the table
   - Ensure appropriate policies exist that allow users to insert/select their own records

3. **Run the simplified script**
   - Try running just this part to create the table:
   ```sql
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
   ```

## Features Enabled After Setup:

Once the table is created, your app will:

1. Automatically save all manually entered foods
2. Allow searching your previously entered foods
3. Save time by reusing your custom foods with accurate nutritional information 