import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  TextInput, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView
} from 'react-native';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppContext } from '@/context/AppContext';
import { ONBOARDING_COMPLETE_KEY } from '@/app/_layout';

const { width, height } = Dimensions.get('window');

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { session } = useAppContext();
  
  // If we already have a session, redirect to main app or onboarding
  useEffect(() => {
    if (session) {
      console.log('[Login Screen] Session already exists, redirecting');
      checkAndRedirect();
    }
  }, [session]);
  
  // Helper function to determine where to go based on onboarding status
  const checkAndRedirect = async () => {
    try {
      const onboardingStatus = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
      console.log(`[Login Screen] Onboarding status: ${onboardingStatus}`);
      
      if (onboardingStatus === 'false') {
        console.log('[Login Screen] Redirecting to onboarding');
        router.replace('/(onboarding)');
      } else {
        console.log('[Login Screen] Redirecting to main app');
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('[Login Screen] Error checking onboarding status:', error);
      router.replace('/(tabs)');
    }
  };

  async function signInWithEmail() {
    if (!email || !password) {
      Alert.alert('Missing Fields', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        Alert.alert('Sign In Error', error.message);
      } else if (data?.session) {
        console.log('Login successful!');
        // This will trigger the useEffect above when session changes
      }
    } catch (err) {
      console.error('Unexpected error during sign in:', err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function signUpWithEmail() {
    if (!email || !password) {
      Alert.alert('Missing Fields', 'Please enter both email and password');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password should be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
      });

      if (error) {
        Alert.alert('Sign Up Error', error.message);
      } else if (data?.user) {
        // Explicitly mark onboarding as incomplete for new user
        try {
          await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'false');
          console.log('[Signup] Explicitly marked onboarding as incomplete for new user');
          
          // Now redirect to onboarding with a clear message
          Alert.alert(
            'Account Created', 
            'Welcome to KetoMate! Let\'s set up your profile.',
            [
              {
                text: 'Continue',
                onPress: () => {
                  console.log('[Signup] Directing new user to onboarding flow');
                  // Force redirect to onboarding - don't wait for session detection
                  router.replace('/(onboarding)');
                }
              }
            ]
          );
        } catch (e) {
          console.error('[Signup] Failed to set onboarding status:', e);
          router.replace('/(onboarding)');
        }
      } else {
        Alert.alert('Sign Up Success', 'Please check your email for verification!');
      }
    } catch (err) {
      console.error('Unexpected error during sign up:', err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setEmail('');
    setPassword('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Background */}
      <LinearGradient
        colors={['#1E293B', '#334155', '#475569']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Background circle */}
      <View style={styles.circle} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View style={styles.content}>
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['#84cc16', '#22c55e']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                borderRadius={50}
              />
              <Text style={styles.logoText}>🥑</Text>
            </View>
            <Text style={styles.appTitle}>KetoMate</Text>
            <Text style={styles.appTagline}>Your personal keto assistant</Text>
          </View>
          
          <Text style={styles.welcomeText}>
            {isSignUp ? 'Create your account' : 'Welcome'}
          </Text>
          
          {/* Form */}
          <View style={styles.form}>
            {/* Email Field */}
            <View style={styles.inputContainer}>
              <Ionicons 
                name="mail-outline" 
                size={22} 
                color="#84cc16" 
                style={styles.inputIcon} 
              />
              <TextInput
                style={styles.input}
                onChangeText={setEmail}
                value={email}
                placeholder="Email address"
                placeholderTextColor="rgba(255,255,255,0.5)"
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
              />
            </View>
            
            {/* Password Field */}
            <View style={styles.inputContainer}>
              <Ionicons 
                name="lock-closed-outline" 
                size={22} 
                color="#84cc16" 
                style={styles.inputIcon} 
              />
              <TextInput
                style={styles.input}
                onChangeText={setPassword}
                value={password}
                secureTextEntry={!showPassword}
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.5)"
                autoCapitalize="none"
                textContentType="password"
              />
              <TouchableOpacity 
                style={styles.passwordToggle}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons 
                  name={showPassword ? "eye-off-outline" : "eye-outline"} 
                  size={22} 
                  color="#84cc16" 
                />
              </TouchableOpacity>
            </View>

            {/* Action Button */}
            <TouchableOpacity
              style={styles.button}
              disabled={loading}
              onPress={isSignUp ? signUpWithEmail : signInWithEmail}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#84cc16', '#22c55e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {isSignUp ? 'Sign Up' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Toggle Sign Up/In */}
            <TouchableOpacity onPress={toggleMode} style={styles.toggleAccount}>
              <Text style={styles.toggleText}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={styles.toggleTextBold}>
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  circle: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    top: -width * 0.2,
    right: -width * 0.2,
    backgroundColor: 'rgba(59, 73, 102, 0.5)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingBottom: height * 0.05,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  logoText: {
    fontSize: 50,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  appTagline: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#FFFFFF',
  },
  passwordToggle: {
    padding: 8,
  },
  button: {
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    overflow: 'hidden',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  toggleAccount: {
    marginTop: 24,
    alignItems: 'center',
  },
  toggleText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 15,
  },
  toggleTextBold: {
    color: '#84cc16',
    fontWeight: '600',
  }
}); 