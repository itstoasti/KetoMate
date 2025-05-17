import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { useAppContext } from '@/context/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARDING_COMPLETE_KEY } from '@/app/_layout';

export default function GoalsSetup() {
  const router = useRouter();
  const { updateUserProfile, user, userProfile } = useAppContext();
  
  const [goal, setGoal] = useState<'weight_loss' | 'maintenance' | 'muscle_gain'>('weight_loss');
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'>('moderate');
  const [goalWeight, setGoalWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('lb');
  const [isLoading, setIsLoading] = useState(false);
  
  const goals = [
    { value: 'weight_loss', label: 'Weight Loss', description: 'Reduce body fat while maintaining muscle' },
    { value: 'maintenance', label: 'Maintenance', description: 'Maintain current weight and improve health' },
    { value: 'muscle_gain', label: 'Muscle Gain', description: 'Build muscle mass while staying in ketosis' },
  ];
  
  const activityLevels = [
    { value: 'sedentary', label: 'Sedentary', description: 'Little or no exercise' },
    { value: 'light', label: 'Light', description: 'Light exercise 1-3 days/week' },
    { value: 'moderate', label: 'Moderate', description: 'Moderate exercise 3-5 days/week' },
    { value: 'active', label: 'Active', description: 'Hard exercise 6-7 days/week' },
    { value: 'very_active', label: 'Very Active', description: 'Very hard exercise & physical job or training twice a day' },
  ];
  
  const handleComplete = async () => {
    setIsLoading(true);
    
    try {
      console.log(`Saving goals: goal=${goal}, activityLevel=${activityLevel}`);
      
      // Only update the goal-related fields, don't overwrite other profile data
      // First get the current profile to preserve existing data
      const currentProfile = userProfile || {};
      
      // Process goal weight if provided (for weight_loss goal)
      let goalWeightInKg;
      if (goal === 'weight_loss' && goalWeight) {
        const goalWeightNum = parseFloat(goalWeight);
        if (!isNaN(goalWeightNum)) {
          // Convert to kg if in lb for storage
          goalWeightInKg = weightUnit === 'lb' ? goalWeightNum * 0.453592 : goalWeightNum;
        }
      }
      
      // Create a sanitized copy to prevent double-conversion issues
      const profileData = {
        // Preserve existing profile data exactly as is (without any conversions)
        name: currentProfile.name,
        weight: currentProfile.weight,
        height: currentProfile.height,
        weightUnit: currentProfile.weightUnit,
        heightUnit: currentProfile.heightUnit,
        
        // Add the new goal information
        goal: goal as 'weight_loss' | 'maintenance' | 'muscle_gain',
        // Use activityLevel (camelCase) for the profile, which will be mapped to activity_level (snake_case) in the database
        activityLevel: activityLevel as 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active',
        // Add goal weight if available
        ...(goalWeightInKg ? { goalWeight: goalWeightInKg } : {}),
        // Set default macros based on the selected goal
        dailyMacroLimit: {
          carbs: 20, // Low carb for keto
          protein: goal === 'muscle_gain' ? 150 : 120,
          fat: 150,
          calories: goal === 'weight_loss' ? 1600 : (goal === 'maintenance' ? 1800 : 2000)
        },
        dailyCalorieLimit: goal === 'weight_loss' ? 1600 : (goal === 'maintenance' ? 1800 : 2000)
      };
      
      // Log the exact data we're sending to update
      console.log("Preserving profile data:", JSON.stringify({
        name: profileData.name,
        weight: profileData.weight,
        height: profileData.height,
        weightUnit: profileData.weightUnit,
        heightUnit: profileData.heightUnit
      }));
      
      // Update profile with the sanitized data
      await updateUserProfile(profileData);
      
      // Mark onboarding as complete with the new global key
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
      console.log(`[Goals] Onboarding completed and saved with key: ${ONBOARDING_COMPLETE_KEY}`);
      
      // Important: Wait for profile to be saved properly
      console.log("Profile updated, waiting before navigation...");
      // Wait longer to ensure data is fully saved and synced
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log("Navigating to tabs after onboarding");
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error saving goals data:', error);
      alert('There was an error saving your goals. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Set Your Goals</Text>
        <Text style={styles.subtitle}>Let's customize your keto journey</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What's your primary goal?</Text>
          <View style={styles.goalContainer}>
            {goals.map(goalItem => (
              <TouchableOpacity
                key={goalItem.value}
                style={[
                  styles.goalCard,
                  goal === goalItem.value && styles.goalCardSelected
                ]}
                onPress={() => setGoal(goalItem.value)}
              >
                <Text style={[
                  styles.goalLabel,
                  goal === goalItem.value && styles.goalLabelSelected
                ]}>
                  {goalItem.label}
                </Text>
                <Text style={[
                  styles.goalDescription,
                  goal === goalItem.value && styles.goalDescriptionSelected
                ]}>
                  {goalItem.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {goal === 'weight_loss' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What's your goal weight?</Text>
            <View style={styles.weightInputContainer}>
              <TextInput
                style={styles.weightInput}
                value={goalWeight}
                onChangeText={setGoalWeight}
                placeholder="Enter weight"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
              />
              <View style={styles.unitSelector}>
                <Picker
                  selectedValue={weightUnit}
                  onValueChange={(itemValue) => setWeightUnit(itemValue as 'kg' | 'lb')}
                  style={styles.unitPicker}
                >
                  <Picker.Item label="lb" value="lb" />
                  <Picker.Item label="kg" value="kg" />
                </Picker>
              </View>
            </View>
          </View>
        )}
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How active are you?</Text>
          <View style={styles.activityContainer}>
            {activityLevels.map(level => (
              <TouchableOpacity
                key={level.value}
                style={[
                  styles.activityCard,
                  activityLevel === level.value && styles.activityCardSelected
                ]}
                onPress={() => setActivityLevel(level.value)}
              >
                <Text style={[
                  styles.activityLabel,
                  activityLevel === level.value && styles.activityLabelSelected
                ]}>
                  {level.label}
                </Text>
                <Text style={[
                  styles.activityDescription,
                  activityLevel === level.value && styles.activityDescriptionSelected
                ]}>
                  {level.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, isLoading && styles.buttonDisabled]} 
            onPress={handleComplete}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Let's Start!</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 40,
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
    marginBottom: 30,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 15,
    color: '#333',
  },
  goalContainer: {
    gap: 12,
  },
  goalCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#EEE',
  },
  goalCardSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#F1F8E9',
  },
  goalLabel: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
    color: '#333',
  },
  goalLabelSelected: {
    color: '#2E7D32',
  },
  goalDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#666',
  },
  goalDescriptionSelected: {
    color: '#558B2F',
  },
  weightInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weightInput: {
    flex: 1,
    backgroundColor: '#FFF',
    height: 50,
    borderRadius: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  unitSelector: {
    width: 80,
    marginLeft: 10,
    height: 50,
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  unitPicker: {
    height: 50,
  },
  activityContainer: {
    gap: 10,
  },
  activityCard: {
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#EEE',
  },
  activityCardSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#F1F8E9',
  },
  activityLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 2,
    color: '#333',
  },
  activityLabelSelected: {
    color: '#2E7D32',
  },
  activityDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#666',
  },
  activityDescriptionSelected: {
    color: '#558B2F',
  },
  buttonContainer: {
    marginTop: 20,
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#a5d6a7',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
}); 