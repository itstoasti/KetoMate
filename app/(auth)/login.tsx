import React, { useState } from 'react';
import { Alert, StyleSheet, View, TextInput, Button, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabaseClient';
import { Link, useRouter } from 'expo-router';
// Remove Supabase Auth UI imports
// import { Auth } from '@supabase/auth-ui-react';
// import { ThemeSupa } from '@supabase/auth-ui-shared';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); // Toggle between Sign In / Sign Up
  const router = useRouter();

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) Alert.alert('Sign In Error', error.message);
    setLoading(false);
    // onAuthStateChange in AppContext will handle navigation
  }

  async function signUpWithEmail() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (error) {
      Alert.alert('Sign Up Error', error.message);
      setLoading(false);
    } else {
      // User created successfully, redirect to onboarding
      if (data?.user) {
        Alert.alert('Account Created', 'Welcome to KetoMate! Let\'s set up your profile.');
        // The onboarding redirect will happen automatically via _layout.tsx
      } else {
        Alert.alert('Sign Up Success', 'Please check your email for verification!');
      }
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
        <View style={styles.header}>
            <Text style={styles.title}>KetoMate</Text>
            <Text style={styles.subtitle}>{isSignUp ? 'Create an account' : 'Sign in to your account'}</Text>
        </View>

        <View style={styles.verticallySpaced}>
            <TextInput
                style={styles.input}
                onChangeText={(text) => setEmail(text)}
                value={email}
                placeholder="email@address.com"
                autoCapitalize={'none'}
                keyboardType="email-address"
                textContentType="emailAddress"
            />
        </View>
        <View style={styles.verticallySpaced}>
            <TextInput
                style={styles.input}
                onChangeText={(text) => setPassword(text)}
                value={password}
                secureTextEntry={true}
                placeholder="Password"
                autoCapitalize={'none'}
                textContentType="password"
            />
        </View>

        <View style={[styles.verticallySpaced, styles.buttonContainer]}>
            <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                disabled={loading}
                onPress={isSignUp ? signUpWithEmail : signInWithEmail}
            >
                {loading ? (
                     <ActivityIndicator color="#fff" />
                 ) : (
                     <Text style={styles.buttonText}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>
                 )}
            </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.switchButton}>
             <Text style={styles.switchButtonText}>
                 {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
             </Text>
         </TouchableOpacity>

        {/* Remove the Supabase Auth UI Component */}
        {/* <View style={styles.authContainer}>
           ... Auth Component was here ...
        </View> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FAFAFA',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  subtitle: {
      fontSize: 16,
      fontFamily: 'Inter-Regular',
      color: '#666',
  },
  verticallySpaced: {
    paddingTop: 4,
    paddingBottom: 4,
    alignSelf: 'stretch',
    marginBottom: 10, // Add some margin between input fields
  },
  input: {
      height: 50,
      backgroundColor: '#fff',
      borderRadius: 8,
      paddingHorizontal: 15,
      borderWidth: 1,
      borderColor: '#ddd',
      fontFamily: 'Inter-Regular',
      fontSize: 16,
  },
  buttonContainer: {
      marginTop: 15,
  },
  button: {
      backgroundColor: '#4CAF50',
      paddingVertical: 15,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
  },
  buttonDisabled: {
      backgroundColor: '#a5d6a7',
  },
  buttonText: {
      color: '#fff',
      fontSize: 16,
      fontFamily: 'Inter-SemiBold',
  },
  switchButton: {
      marginTop: 15,
      alignItems: 'center',
  },
  switchButtonText: {
       color: '#4CAF50',
       fontFamily: 'Inter-Medium',
       fontSize: 14,
  }
}); 