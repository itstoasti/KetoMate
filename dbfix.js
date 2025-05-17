// Run this script with: node dbfix.js
// This will show what the actual database error is

const { createClient } = require('@supabase/supabase-js');

// Replace these with your actual values from your app environment
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // Get from .env or app config
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Get from .env or app config

async function main() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    console.log('Checking table...');
    
    // Try a direct select which will fail if the table doesn't exist
    const { data, error } = await supabase
      .from('custom_foods')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error('Error details:');
      console.error(JSON.stringify(error, null, 2));
      
      // Try to directly fix the issue by creating the table
      console.log('\nAttempting to create table...');
      
      const { error: createError } = await supabase
        .rpc('create_custom_foods_table');
        
      if (createError) {
        console.error('Cannot create table via RPC, error:');
        console.error(JSON.stringify(createError, null, 2));
        console.log('\nPlease use the SQL Editor in Supabase Dashboard to run the SQL script.');
      } else {
        console.log('Successfully created table!');
      }
    } else {
      console.log('Table exists and query successful!');
      console.log('Data:', data);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

main(); 