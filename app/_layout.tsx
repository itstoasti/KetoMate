import 'react-native-get-random-values';

import React, { useEffect, useState } from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { AppProvider, useAppContext } from '@/context/AppContext';
import { SplashScreen } from 'expo-router';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Export RootLayout component wrapped in AppProvider
export default function ProvidedRootLayout() {
    return (
        <AppProvider>
            <RootLayout />
        </AppProvider>
    );
}

function RootLayout() {
  // Get session and loading state from context
  const { session, isLoading: isAppContextLoading, userProfile } = useAppContext();
  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    'Montserrat-Regular': Montserrat_400Regular,
    'Montserrat-Medium': Montserrat_500Medium,
    'Montserrat-SemiBold': Montserrat_600SemiBold,
    'Montserrat-Bold': Montserrat_700Bold,
  });
  
  // State to track if this is a new user who needs onboarding
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  
  const router = useRouter();
  const segments = useSegments();
  
  // Use framework ready hook (if still needed for other reasons)
  useFrameworkReady();
  
  // App is ready visually once fonts are loaded/failed
  const isFontReady = fontsLoaded || fontError;

  useEffect(() => {
    // Log the state *before* checking conditions
    console.log(`[RootLayout] Effect Run: isFontReady=${isFontReady}, isAppContextLoading=${isAppContextLoading}, session=${!!session}, segments=${JSON.stringify(segments)}`);

    // Wait until fonts are ready AND context loading is finished before redirecting
    if (!isFontReady || isAppContextLoading) {
        console.log("[RootLayout] Effect Exit: Fonts or App Context not ready yet for navigation.");
        return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const inOnboardingGroup = segments[0] === '(onboarding)';

    // Check if user needs onboarding (has account but profile is new/incomplete)
    const isProfileIncomplete = session && userProfile && 
      (!userProfile.name || userProfile.name === 'User' || !userProfile.goal);
    
    setNeedsOnboarding(isProfileIncomplete);

    console.log(`[RootLayout] Effect Check: isFontReady=${isFontReady}, isAppContextLoading=${isAppContextLoading}, session=${!!session}, segments=${JSON.stringify(segments)}, inAuthGroup=${inAuthGroup}, inTabsGroup=${inTabsGroup}, needsOnboarding=${isProfileIncomplete}`);

    // Handle navigation based on session and onboarding status
    if (!session && !inAuthGroup) {
      console.log("[RootLayout] Redirecting to /login (inside auth group)...");
      router.replace('/(auth)/login');
    } else if (session && isProfileIncomplete && !inOnboardingGroup) {
      console.log("[RootLayout] New user detected, redirecting to onboarding...");
      router.replace('/(onboarding)');
    } else if (session && !isProfileIncomplete && !inTabsGroup) {
      console.log("[RootLayout] Redirecting to / (inside tabs group)...");
      router.replace('/');
    } else {
      console.log("[RootLayout] No redirection needed.");
    }

  }, [session, userProfile, isFontReady, isAppContextLoading, segments, router]);

  useEffect(() => {
    // Hide splash screen as soon as fonts are ready
    if (isFontReady) {
      SplashScreen.hideAsync();
      console.log("[RootLayout] Fonts ready, hiding splash screen.");
    }
  }, [isFontReady]);
  
  // Return null only if fonts are not ready
  if (!isFontReady) {
    console.log("[RootLayout] Fonts not ready, returning null (showing splash).");
    return null;
  }

  // If fonts are ready, but context is still loading, show loading indicator
  if (isAppContextLoading) {
    console.log("[RootLayout] Fonts ready, context loading, showing ActivityIndicator.");
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <StatusBar style="dark" />
      </View>
    );
  }

  // If fonts are ready AND context is loaded, render the main app
  console.log("[RootLayout] Fonts and context ready, rendering Stack navigator.");
  return (
    <>
      <Stack screenOptions={{ 
        headerShown: false,
        animation: Platform.OS === 'android' ? 'fade_from_bottom' : 'default',
        contentStyle: { backgroundColor: '#FAFAFA' } 
      }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}