import 'react-native-get-random-values';

import React, { useEffect } from 'react';
import { Platform } from 'react-native';
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
  const { session, isLoading: isAppContextLoading } = useAppContext();
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
  
  const router = useRouter();
  const segments = useSegments();
  
  // Use framework ready hook (if still needed for other reasons)
  useFrameworkReady();
  
  const isAppReady = (fontsLoaded || fontError) && !isAppContextLoading;

  useEffect(() => {
    if (!isAppReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';

    console.log(`[RootLayout] Effect Check: isAppReady=${isAppReady}, session=${!!session}, segments=${JSON.stringify(segments)}, inAuthGroup=${inAuthGroup}, inTabsGroup=${inTabsGroup}`);

    if (session && !inTabsGroup) {
      console.log("[RootLayout] Session exists, not in tabs. Redirecting to / ...");
      router.replace('/');
    } else if (!session && !inAuthGroup) {
      console.log("[RootLayout] No session, not in auth. Redirecting to login...");
      router.replace('/(auth)/login');
    }

  }, [session, isAppReady, segments, router]);

  useEffect(() => {
    if (isAppReady) {
      SplashScreen.hideAsync();
    }
  }, [isAppReady]);
  
  // Keep showing splash screen while loading
  if (!isAppReady) {
    return null;
  }

  // Render the Stack unconditionally now, the useEffect handles redirection
  return (
    <>
      <Stack screenOptions={{ 
        headerShown: false,
        animation: Platform.OS === 'android' ? 'fade_from_bottom' : 'default',
        contentStyle: { backgroundColor: '#FAFAFA' } 
      }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}