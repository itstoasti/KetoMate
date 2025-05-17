import 'react-native-get-random-values';

import React, { useEffect, useState, useCallback } from 'react';
import { Platform, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { AppProvider, useAppContext } from '@/context/AppContext';
import { SplashScreen } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabaseClient';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Global key for onboarding status
export const ONBOARDING_COMPLETE_KEY = 'onboarding_complete_v3';

// FORCE LOGIN FLAG - set this to false to allow session persistence
export const FORCE_LOGIN = false;

// Simple loading screen to prevent flashes
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

// Export RootLayout component wrapped in AppProvider
export default function ProvidedRootLayout() {
  // Clear any existing sessions on app start to force login
  useEffect(() => {
    const clearExistingSession = async () => {
      if (FORCE_LOGIN) {
        console.log('[Root Layout] FORCE_LOGIN is true, signing out any existing session');
        await supabase.auth.signOut();
      }
    };
    
    clearExistingSession();
  }, []);
  
  return (
    <AppProvider>
      <RootLayoutWithFonts />
    </AppProvider>
  );
}

// Separate component to handle font loading
function RootLayoutWithFonts() {
  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    'Montserrat-Regular': Montserrat_400Regular,
    'Montserrat-Medium': Montserrat_500Medium,
    'Montserrat-SemiBold': Montserrat_600SemiBold,
    'Montserrat-Bold': Montserrat_700Bold,
  });

  useEffect(() => {
    // Hide splash screen once fonts are loaded
    if (fontsLoaded) {
      // Small delay to ensure fonts are properly registered
      setTimeout(() => {
        SplashScreen.hideAsync().catch(e => {
          console.warn('Error hiding splash screen:', e);
        });
      }, 100);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <LoadingScreen />;
  }

  // Fonts loaded, render the actual layout
  return <RootLayout />;
}

function RootLayout() {
  // Get session and loading state from context
  const { session, isLoading: isAppContextLoading, userProfile } = useAppContext();
  
  // Use a single state object to avoid hook order issues
  const [routeState, setRouteState] = useState({
    initialRoute: '(auth)/login', // Always default to login
    isReady: false
  });
  
  // Function to check if profile is complete
  const isProfileComplete = useCallback(() => {
    return !!(
      userProfile &&
      userProfile.name &&
      userProfile.goal &&
      userProfile.weight &&
      userProfile.height
    );
  }, [userProfile]);

  // Single effect to determine the route
  useEffect(() => {
    // Don't run until app context is ready
    if (isAppContextLoading) return;
    
    const determineInitialRoute = async () => {
      // Always start at login if FORCE_LOGIN is true and no session
      if (FORCE_LOGIN && !session) {
        console.log('[Layout] FORCE_LOGIN enabled and no session, going to login screen');
        setRouteState({ initialRoute: '(auth)/login', isReady: true });
        return;
      }
      
      try {
        // If no session, always go to login
        if (!session) {
          console.log('[Layout] No session, using (auth)/login as initial route');
          setRouteState({ initialRoute: '(auth)/login', isReady: true });
          return;
        }
        
        // Check if this user is new (account created in the last 5 minutes)
        const createdAt = session.user?.created_at ? new Date(session.user.created_at) : null;
        const now = new Date();
        const accountAgeMinutes = createdAt ? (now.getTime() - createdAt.getTime()) / (1000 * 60) : 9999;
        const isNewAccount = accountAgeMinutes < 5;
        
        console.log(`[Layout] Account age: ${accountAgeMinutes.toFixed(2)} minutes, isNewAccount: ${isNewAccount}`);
        
        // Check if this account has explicitly set onboarding status
        const onboardingStatus = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        console.log(`[Layout] Onboarding status from storage: ${onboardingStatus || 'NOT SET'}`);
        
        // Check profile completeness
        const profileComplete = isProfileComplete();
        console.log(`[Layout] Profile completeness: ${profileComplete}`);
        
        // DECISION TREE:
        // 1. If onboarding is explicitly marked false, go to onboarding
        if (onboardingStatus === 'false' && isNewAccount) {
          console.log('[Layout] New account with onboarding explicitly marked incomplete, showing onboarding');
          setRouteState({ initialRoute: '(onboarding)', isReady: true });
        }
        // 2. If onboarding is explicitly marked true or profile is complete, go to dashboard
        else if (onboardingStatus === 'true' || profileComplete) {
          console.log('[Layout] Existing account or complete profile, going to dashboard');
          
          // Ensure onboarding is marked as complete for next time
          if (onboardingStatus !== 'true' && profileComplete) {
            await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
            console.log('[Layout] Updated onboarding status to complete based on profile');
          }
          
          setRouteState({ initialRoute: '(tabs)', isReady: true });
        }
        // 3. No explicit marking, but new account - go to onboarding
        else if (isNewAccount) {
          console.log('[Layout] New account without explicit onboarding status, showing onboarding');
          await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'false');
          setRouteState({ initialRoute: '(onboarding)', isReady: true });
        }
        // 4. No explicit marking, not a new account - assume dashboard (legacy accounts)
        else {
          console.log('[Layout] Existing account with no explicit onboarding status, assuming complete');
          await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
          setRouteState({ initialRoute: '(tabs)', isReady: true });
        }
      } catch (error) {
        console.log('[Layout] Error checking navigation state:', error);
        // Fallback to login on error
        setRouteState({ initialRoute: '(auth)/login', isReady: true });
      }
    };
    
    determineInitialRoute();
  }, [session, isAppContextLoading, isProfileComplete, userProfile]);
  
  // Wait for everything to be ready
  if (isAppContextLoading || !routeState.isReady) {
    return <LoadingScreen />;
  }

  // Render the stack with the determined route
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "none",
          contentStyle: { backgroundColor: '#FAFAFA' },
        }}
        initialRouteName={routeState.initialRoute}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
      </Stack>
      <StatusBar style="dark" />
    </>
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