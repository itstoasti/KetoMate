-- Check if the custom_foods table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name = 'custom_foods'
) AS "table_exists";

-- If the table exists, check its structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name = 'custom_foods'
ORDER BY 
    ordinal_position;

-- Check if RLS is enabled
SELECT 
    tablename, 
    rowsecurity
FROM 
    pg_tables
WHERE 
    schemaname = 'public'
    AND tablename = 'custom_foods';

-- Check existing policies
SELECT
    policyname,
    permissive,
    cmd,
    qual
FROM
    pg_policies
WHERE
    tablename = 'custom_foods'
    AND schemaname = 'public';
    
-- Check indices
SELECT
    indexname,
    indexdef
FROM
    pg_indexes
WHERE
    tablename = 'custom_foods'
    AND schemaname = 'public'; 