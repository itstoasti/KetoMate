import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAppContext } from '@/context/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARDING_COMPLETE_KEY } from '@/app/_layout';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Simple loading screen to prevent flashes
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

export default function OnboardingLayout() {
  const router = useRouter();
  const { userProfile, session, isLoading } = useAppContext();
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    if (isLoading) return; // Wait for app context to load
    
    const checkOnboardingStatus = async () => {
      // If no session, redirect to login
      if (!session) {
        console.log('[Onboarding Layout] No session detected, going to login');
        router.replace('/(auth)/login');
        return;
      }
      
      try {
        // Check if this user is new (account created in the last 5 minutes)
        const createdAt = session.user?.created_at ? new Date(session.user.created_at) : null;
        const now = new Date();
        const accountAgeMinutes = createdAt ? (now.getTime() - createdAt.getTime()) / (1000 * 60) : 9999;
        const isNewAccount = accountAgeMinutes < 5;
        
        console.log(`[Onboarding Layout] Account age: ${accountAgeMinutes.toFixed(2)} minutes, isNewAccount: ${isNewAccount}`);
        
        // Check storage status
        const status = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        console.log(`[Onboarding Layout] Onboarding status: ${status || 'NOT SET'}`);
        
        // Check profile completeness
        const hasRequiredFields = !!(
          userProfile && 
          userProfile.name && 
          userProfile.goal && 
          userProfile.weight && 
          userProfile.height
        );
        
        // Redirect existing accounts to dashboard
        if (!isNewAccount && (status !== 'false' || hasRequiredFields)) {
          console.log('[Onboarding Layout] Existing account detected, redirecting to dashboard');
          
          // Mark as complete for next time
          await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
          
          // Go to dashboard
          router.replace('/(tabs)');
          return;
        }
        
        // Only stay on onboarding if this is a new account with explicit false status
        // or a new account without a status
        if (status === 'false' || (isNewAccount && !status)) {
          console.log('[Onboarding Layout] New account needs onboarding, showing setup screens');
          setIsReady(true);
        } else {
          console.log('[Onboarding Layout] Onboarding complete, going to dashboard');
          router.replace('/(tabs)');
        }
      } catch (error) {
        console.error('[Onboarding Layout] Error:', error);
        // On error, default to showing onboarding
        setIsReady(true);
      }
    };
    
    // Add a slight delay to ensure proper order
    const timeout = setTimeout(() => {
      checkOnboardingStatus();
    }, 100);
    
    return () => clearTimeout(timeout);
  }, [session, isLoading, router, userProfile]);
  
  // Show loading screen while checking
  if (isLoading || !isReady) {
    return <LoadingScreen />;
  }
  
  // Only reached if we should show onboarding
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        animation: "none" // Disable animations to prevent flicker
      }}
      initialRouteName="index"
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="goals-setup" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 