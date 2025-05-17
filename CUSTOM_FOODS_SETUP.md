# Setting Up the Custom Foods Database Table

This guide explains how to set up the `custom_foods` table in your Supabase database for KetoMate app. This table is required for saving and searching custom food entries.

## Method 1: Using the Supabase Dashboard (Recommended for Beginners)

1. Log in to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your KetoMate project
3. Go to the "SQL Editor" section from the left sidebar
4. Click "New Query"
5. Copy and paste the contents of the `setup_custom_foods.sql` file
6. Click "Run" to execute the SQL script
7. Verify the table was created by checking the "Table Editor" section

## Method 2: Using the Supabase CLI (Advanced)

If you have the Supabase CLI installed and set up locally:

1. Make sure the migration file `supabase/migrations/20240516_custom_foods.sql` exists
2. Open a terminal in the project directory
3. Run the migration with:
   ```bash
   supabase db reset
   ```
   Or use our helper script:
   ```bash
   ./setup_custom_foods_table.sh
   ```
4. This will apply the migration and create the table

## Method 3: Manual Database Setup

If neither of the above methods work, you can manually create the table structure:

1. Log in to your Supabase Dashboard
2. Go to "Database" > "Tables" section
3. Click "Create a new table"
4. Configure it with these settings:
   - Name: `custom_foods`
   - Enable Row Level Security: Yes
   - Columns:
     - `id` (UUID, primary key, default: `gen_random_uuid()`)
     - `user_id` (UUID, not null, references `auth.users(id)`)
     - `name` (TEXT, not null)
     - `brand` (TEXT)
     - `serving_size` (TEXT)
     - `calories` (INTEGER, default: 0)
     - `carbs` (DECIMAL(10,2), default: 0)
     - `protein` (DECIMAL(10,2), default: 0)
     - `fat` (DECIMAL(10,2), default: 0)
     - `description` (TEXT)
     - `created_at` (TIMESTAMPTZ, default: NOW())
     - `updated_at` (TIMESTAMPTZ, default: NOW())
5. Create RLS policies to allow users to only access their own food entries

## Verifying Setup

To verify the table is set up correctly:

1. In the Supabase Dashboard, go to "Table Editor"
2. You should see `custom_foods` in the list of tables
3. Try adding a custom food in the KetoMate app
4. Check the table to see if the entry was saved

## Troubleshooting

If you encounter issues:

- Check the error message in the app logs
- Ensure your Supabase database is accessible
- Verify that Row Level Security policies are configured correctly
- Make sure the user has permission to insert data into the table

For additional help, please contact the KetoMate support team. 