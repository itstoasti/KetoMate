#!/usr/bin/env node
// Script to check table permissions for the custom_foods table
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get Supabase credentials from .env file
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please check .env file.');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to check table permissions
async function checkTablePermissions() {
  try {
    console.log('Getting current user...');
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('Auth error:', userError);
      return;
    }
    
    if (!userData?.user?.id) {
      console.error('No authenticated user found. Please sign in first.');
      return;
    }
    
    const userId = userData.user.id;
    console.log(`Authenticated as user: ${userId}`);
    
    console.log('\nChecking if custom_foods table exists...');
    const { data: tables, error: tableError } = await supabase
      .rpc('check_table_exists', { table_name: 'custom_foods' });
      
    if (tableError) {
      console.error('Error checking if table exists:', tableError);
      
      // Try an alternative approach
      console.log('Trying alternative method to check table...');
      const { data: altCheck, error: altError } = await supabase
        .from('custom_foods')
        .select('count(*)', { count: 'exact', head: true });
        
      if (altError) {
        console.error('Alternative check failed:', altError);
        console.log('The custom_foods table might not exist or you do not have permissions.');
        
        // Try a simple test insert
        console.log('\nTrying a test insert to see permissions...');
        const testData = {
          user_id: userId,
          name: 'Test Food',
          serving_size: '100g',
          calories: 100,
          carbs: 10,
          protein: 10,
          fat: 10
        };
        
        const { data: insertTest, error: insertError } = await supabase
          .from('custom_foods')
          .insert(testData);
          
        if (insertError) {
          console.error('Insert test failed:', insertError);
          console.error('Error details:', insertError.details);
          console.error('Error hint:', insertError.hint);
          console.error('Error message:', insertError.message);
          
          if (insertError.code === '42P01') {
            console.log('\n⚠️ DIAGNOSIS: The custom_foods table does not exist.');
            console.log('Run the setup_custom_foods_table.sql script in the Supabase SQL Editor.');
          } else if (insertError.code === '42501') {
            console.log('\n⚠️ DIAGNOSIS: Permission denied. Row Level Security might be blocking access.');
            console.log('Make sure the RLS policies are set up correctly.');
          } else {
            console.log('\n⚠️ DIAGNOSIS: Unknown error. Check the error details above.');
          }
        } else {
          console.log('✓ Insert test successful! You have permission to insert records.');
        }
      } else {
        console.log('✓ Table exists and you have permission to query it.');
        console.log(`Table contains ${altCheck.count} records.`);
      }
    } else {
      console.log('✓ Table exists:', tables);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the check
console.log('==== Custom Foods Table Permission Check ====');
checkTablePermissions()
  .then(() => console.log('\nCheck completed.'))
  .catch(err => console.error('\nCheck failed:', err)); 