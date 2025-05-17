import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAppContext } from '@/context/AppContext';

export default function OnboardingWelcome() {
  const router = useRouter();
  const { session } = useAppContext();

  // Check if user is logged in when the component mounts - removed the alert here
  // as it was unnecessarily showing even when the user is already headed to login
  useEffect(() => {
    if (!session) {
      // We're already on the onboarding page, so just let the user
      // click the buttons rather than showing an alert immediately
      console.log("User not logged in on onboarding page");
    }
  }, [session, router]);

  const handleGetStarted = () => {
    if (!session) {
      Alert.alert(
        "Login Required",
        "Please log in first to set up your profile.",
        [
          {
            text: "Go to Login",
            onPress: () => router.replace('/(auth)/login')
          }
        ]
      );
    } else {
      router.push('/(onboarding)/profile-setup');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to KetoMate!</Text>
        <Text style={styles.subtitle}>Your personalized keto diet assistant</Text>
      </View>
      
      <View style={styles.imageContainer}>
        <View style={styles.imageReplacement}>
          <Text style={styles.imageIcon}>🥑</Text>
          <Text style={styles.welcomeText}>Your Keto Journey Begins</Text>
        </View>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.description}>
          Let's set up your profile to personalize your keto journey and help you achieve your goals!
        </Text>
        
        <TouchableOpacity style={styles.button} onPress={handleGetStarted}>
          <Text style={styles.buttonText}>Create My Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Montserrat-Bold',
    color: '#4CAF50',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#666',
    textAlign: 'center',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  imageReplacement: {
    width: '90%',
    height: '70%',
    backgroundColor: '#F1F8E9',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8F5E9',
    padding: 20,
  },
  imageIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 22,
    fontFamily: 'Montserrat-SemiBold',
    color: '#2E7D32',
    textAlign: 'center',
  },
  content: {
    alignItems: 'center',
    marginBottom: 40,
  },
  description: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#555',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
}); 