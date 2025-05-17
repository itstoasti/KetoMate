#!/bin/bash

# Rebuild and publish the KetoMate app with the permission fixes
# This script assumes you have expo-cli installed

echo "🔄 Rebuilding and publishing KetoMate app with permission fixes..."

# Clear metro bundler cache
echo "🧹 Clearing Metro bundler cache..."
npx expo start --clear

# Build the app again
echo "🏗️ Building the app for Android..."
npx eas build --platform android --profile preview

echo "🏗️ Building the app for iOS..."
npx eas build --platform ios --profile preview

echo "✅ Build commands submitted!"
echo "Check the EAS dashboard for build progress."
echo ""
echo "After builds are complete, you can update on devices using:"
echo "npx expo-updates publish --release-channel production" 