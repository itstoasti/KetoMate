// Debug script for custom_foods table issues
// Run this with: node debug_custom_foods.js

// Load .env.local file if it exists
require('dotenv').config({ path: '.env.local' });

// Get Supabase URL and Key from environment or provide them here
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_KEY';

// Initialize Supabase client
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debugCustomFoods() {
  console.log('===== Custom Foods Table Debug Tool =====');
  
  try {
    // Check what tables exist in public schema
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_tables_in_schema', { schema_name: 'public' });
      
    if (tablesError) {
      console.error('Error getting tables:', tablesError);
      
      // Try direct SQL query as fallback
      console.log('Trying direct SQL query...');
      const { data: tablesSQL, error: tablesSQLError } = await supabase
        .from('_postgres_debug')
        .select('*')
        .rpc('list_tables');
        
      if (tablesSQLError) {
        console.error('Error with SQL fallback:', tablesSQLError);
      } else {
        console.log('Tables from SQL fallback:', tablesSQL);
      }
    } else {
      console.log('Tables in public schema:', tables);
      
      const hasCustomFoods = tables.some(t => t.table_name === 'custom_foods');
      console.log('custom_foods table exists:', hasCustomFoods);
    }
    
    // Try directly querying custom_foods
    console.log('\nTrying to query custom_foods table...');
    const { data: customFoods, error: customFoodsError } = await supabase
      .from('custom_foods')
      .select('count(*)', { count: 'exact', head: true });
      
    if (customFoodsError) {
      console.error('Error querying custom_foods:', customFoodsError);
    } else {
      console.log('Successfully queried custom_foods. Count:', customFoods);
    }
    
    // Test inserting a record
    console.log('\nTrying to insert a test record...');
    const testData = {
      user_id: '00000000-0000-0000-0000-000000000000', // This will likely fail due to foreign key constraint
      name: 'Test Food',
      brand: 'Test Brand',
      serving_size: 'Test Serving',
      calories: 100,
      carbs: 10,
      protein: 5,
      fat: 5,
      description: 'Test description'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('custom_foods')
      .insert(testData)
      .select();
      
    if (insertError) {
      console.error('Error inserting test record:', insertError);
      
      // Analyze error message
      if (insertError.message) {
        if (insertError.message.includes('relation "custom_foods" does not exist')) {
          console.log('DIAGNOSIS: The custom_foods table does not exist at all.');
        } else if (insertError.message.includes('foreign key constraint')) {
          console.log('DIAGNOSIS: The table exists but has foreign key constraints (expected).');
        } else if (insertError.message.includes('permission denied')) {
          console.log('DIAGNOSIS: Permission issues with the table.');
        } else {
          console.log('DIAGNOSIS: Unknown error with the table.');
        }
      }
    } else {
      console.log('Successfully inserted test record:', insertData);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the debug function
debugCustomFoods(); 