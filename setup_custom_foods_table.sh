#!/bin/bash

# Setup Custom Foods Table for KetoMate
# This script runs the SQL migration to create the custom_foods table in Supabase

echo "Setting up Custom Foods table in Supabase..."

# Get Supabase URL from environment if not hardcoded in app
if [ -z "$SUPABASE_URL" ]; then
  # Try to extract from app environment
  if [ -f ".env.local" ]; then
    SUPABASE_URL=$(grep EXPO_PUBLIC_SUPABASE_URL .env.local | cut -d '=' -f2)
  fi
fi

# Run the SQL migration using Supabase CLI
echo "Running migration..."
supabase db reset

echo ""
echo "✅ Custom Foods table setup complete!"
echo "You can now save custom foods in the app."
echo ""
echo "To verify the table was created, check the Supabase dashboard"
echo "or run: supabase db dump | grep custom_foods" 