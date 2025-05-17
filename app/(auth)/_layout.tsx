import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import React, { useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';

// Loading screen to prevent flashes
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

export default function AuthLayout() {
  const { session, isLoading } = useAppContext();
  
  // If session is being loaded, show loading screen
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  // If there's a session, this layout shouldn't be shown, but just in case
  if (session) {
    console.log('[Auth Layout] Session detected in auth layout - this should not happen');
  } else {
    console.log('[Auth Layout] No session, showing login screen');
  }
  
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        animation: "none" // Disable animations to prevent flicker
      }}
      initialRouteName="login"
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
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