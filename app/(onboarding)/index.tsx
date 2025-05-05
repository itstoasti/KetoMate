import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function OnboardingWelcome() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push('/(onboarding)/profile-setup');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to KetoMate!</Text>
        <Text style={styles.subtitle}>Your personalized keto diet assistant</Text>
      </View>
      
      <View style={styles.imageContainer}>
        <Image 
          source={require('@/assets/images/onboarding-welcome.png')} 
          style={styles.image}
          resizeMode="contain"
        />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.description}>
          Let's set up your profile to personalize your keto journey and help you achieve your goals!
        </Text>
        
        <TouchableOpacity style={styles.button} onPress={handleGetStarted}>
          <Text style={styles.buttonText}>Let's Get Started</Text>
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
  image: {
    width: '90%',
    height: '90%',
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
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
}); 