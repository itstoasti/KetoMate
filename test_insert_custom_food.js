// Test script to insert a record into custom_foods table
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get Supabase credentials from .env file or use directly if testing
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please check .env file.');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to test insertion
async function testInsertCustomFood() {
  try {
    console.log('Getting current user...');
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('Auth error:', userError);
      return;
    }
    
    if (!userData?.user?.id) {
      console.error('No authenticated user found. Please run this script after logging in.');
      return;
    }
    
    const userId = userData.user.id;
    console.log(`User ID: ${userId}`);
    
    // Test data
    const testFood = {
      user_id: userId,
      name: 'Test Food Item',
      brand: 'Test Brand',
      serving_size: '100g',
      calories: 200,
      carbs: 10,
      protein: 20,
      fat: 15,
      description: 'Test food entry from script'
    };
    
    console.log('Attempting to insert test food:', testFood);
    
    // Check if custom_foods table exists
    console.log('Checking if custom_foods table exists...');
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'custom_foods');
      
    if (tableError) {
      console.error('Error checking tables:', tableError);
    } else {
      console.log('Tables check result:', tables);
    }
    
    // Try to insert the food
    console.log('Inserting test food...');
    const { data, error } = await supabase
      .from('custom_foods')
      .insert(testFood)
      .select();
    
    if (error) {
      console.error('Error inserting test food:');
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      console.error('Error hint:', error.hint);
    } else {
      console.log('Test food inserted successfully:', data);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the test
console.log('Running custom foods table test...');
testInsertCustomFood()
  .then(() => console.log('Test completed'))
  .catch(err => console.error('Test failed:', err)); 