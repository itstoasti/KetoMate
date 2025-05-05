import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAppContext } from '@/context/AppContext';
import { Picker } from '@react-native-picker/picker';

export default function ProfileSetup() {
  const router = useRouter();
  const { updateUserProfile } = useAppContext();
  
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [height, setHeight] = useState('');
  const [heightUnit, setHeightUnit] = useState('cm');
  const [isLoading, setIsLoading] = useState(false);
  
  const handleNext = async () => {
    if (!name || !weight || !height) {
      alert('Please fill in all required fields');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Update user profile with the collected data
      await updateUserProfile({
        name,
        weight: parseFloat(weight),
        height: parseFloat(height),
        weightUnit: weightUnit as 'kg' | 'lb',
        heightUnit: heightUnit as 'cm' | 'ft',
      });
      
      // Navigate to the next onboarding screen
      router.push('/(onboarding)/goals-setup');
    } catch (error) {
      console.error('Error saving profile data:', error);
      alert('There was an error saving your profile data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Tell us about yourself</Text>
          <Text style={styles.subtitle}>We'll use this to personalize your keto experience</Text>
          
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor="#999"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={setAge}
                placeholder="Your age"
                placeholderTextColor="#999"
                keyboardType="number-pad"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Gender</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={gender}
                  onValueChange={(itemValue) => setGender(itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item label="Select gender" value="" />
                  <Picker.Item label="Male" value="male" />
                  <Picker.Item label="Female" value="female" />
                  <Picker.Item label="Non-binary" value="non-binary" />
                  <Picker.Item label="Prefer not to say" value="not-specified" />
                </Picker>
              </View>
            </View>
            
            <View style={styles.row}>
              <View style={[styles.inputContainer, styles.rowItem]}>
                <Text style={styles.label}>Weight</Text>
                <View style={styles.unitInputContainer}>
                  <TextInput
                    style={[styles.input, styles.unitInput]}
                    value={weight}
                    onChangeText={setWeight}
                    placeholder="Weight"
                    placeholderTextColor="#999"
                    keyboardType="decimal-pad"
                  />
                  <View style={styles.unitSelectorSmall}>
                    <Picker
                      selectedValue={weightUnit}
                      onValueChange={(itemValue) => setWeightUnit(itemValue)}
                      style={styles.unitPicker}
                    >
                      <Picker.Item label="kg" value="kg" />
                      <Picker.Item label="lb" value="lb" />
                    </Picker>
                  </View>
                </View>
              </View>
              
              <View style={[styles.inputContainer, styles.rowItem]}>
                <Text style={styles.label}>Height</Text>
                <View style={styles.unitInputContainer}>
                  <TextInput
                    style={[styles.input, styles.unitInput]}
                    value={height}
                    onChangeText={setHeight}
                    placeholder="Height"
                    placeholderTextColor="#999"
                    keyboardType="decimal-pad"
                  />
                  <View style={styles.unitSelectorSmall}>
                    <Picker
                      selectedValue={heightUnit}
                      onValueChange={(itemValue) => setHeightUnit(itemValue)}
                      style={styles.unitPicker}
                    >
                      <Picker.Item label="cm" value="cm" />
                      <Picker.Item label="ft" value="ft" />
                    </Picker>
                  </View>
                </View>
              </View>
            </View>
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, isLoading && styles.buttonDisabled]} 
              onPress={handleNext}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  keyboardAvoid: {
    flex: 1,
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
  form: {
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#FFF',
    height: 50,
    borderRadius: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  pickerContainer: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowItem: {
    flex: 0.48,
  },
  unitInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unitInput: {
    flex: 1,
  },
  unitSelectorSmall: {
    width: 70,
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
  buttonContainer: {
    marginTop: 10,
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