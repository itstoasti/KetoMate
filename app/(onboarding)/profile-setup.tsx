import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, ScrollView, Platform, KeyboardAvoidingView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAppContext } from '@/context/AppContext';
import { Picker } from '@react-native-picker/picker';

// Unit conversion utilities
const CM_TO_FT = 0.0328084;
const KG_TO_LB = 2.20462;

export default function ProfileSetup() {
  const router = useRouter();
  const { updateUserProfile } = useAppContext();
  
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('lb');
  const [height, setHeight] = useState('');
  const [inches, setInches] = useState('');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('ft');
  const [isLoading, setIsLoading] = useState(false);
  
  // Unit toggle handlers
  const toggleWeightUnit = () => {
    if (weightUnit === 'kg') {
      setWeightUnit('lb');
      // Convert kg to pounds if there's a value
      if (weight) {
        const weightNum = parseFloat(weight);
        if (!isNaN(weightNum)) {
          setWeight((weightNum * KG_TO_LB).toFixed(1));
        }
      }
    } else {
      setWeightUnit('kg');
      // Convert pounds to kg if there's a value
      if (weight) {
        const weightNum = parseFloat(weight);
        if (!isNaN(weightNum)) {
          setWeight((weightNum / KG_TO_LB).toFixed(1));
        }
      }
    }
  };
  
  const toggleHeightUnit = () => {
    if (heightUnit === 'cm') {
      // Switch from cm to ft/in
      if (height) {
        const heightNum = parseFloat(height);
        if (!isNaN(heightNum)) {
          // Convert cm to total inches, then split into feet and inches
          const totalInches = heightNum * 0.393701;
          const feet = Math.floor(totalInches / 12);
          const remainingInches = Math.round(totalInches % 12);
          
          setHeight(feet.toString());
          setInches(remainingInches.toString());
        }
      }
      setHeightUnit('ft');
    } else {
      // Switch from ft/in to cm
      const feetNum = parseFloat(height || '0');
      const inchesNum = parseFloat(inches || '0');
      
      if (!isNaN(feetNum) || !isNaN(inchesNum)) {
        // Convert feet and inches to cm
        const totalInches = (feetNum * 12) + inchesNum;
        const cm = Math.round(totalInches / 0.393701);
        
        setHeight(cm.toString());
        setInches(''); // Clear inches when switching to cm
      }
      setHeightUnit('cm');
    }
  };
  
  const handleNext = async () => {
    if (!name || !weight || !height) {
      Alert.alert('Missing Information', 'Please fill in your name, weight, and height to continue.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Format the display string for logging depending on the units
      const heightDisplay = heightUnit === 'ft' ? 
        `${height}ft ${inches ? inches + 'in' : ''}` : 
        `${height}${heightUnit}`;
      
      console.log(`Saving profile: weight=${weight}${weightUnit}, height=${heightDisplay}`);
      
      // Convert weight and height to numbers
      const weightNum = parseFloat(weight);
      let heightNum: number;
      
      // Calculate the appropriate height value based on the unit
      if (heightUnit === 'ft') {
        const feetNum = parseFloat(height);
        const inchesNum = parseFloat(inches || '0');
        
          // Store height in the selected unit, but calculate the equivalent in cm for the database
          const totalInches = (feetNum * 12) + inchesNum;
          heightNum = totalInches / 0.393701; // Convert to cm for storage
      } else {
        heightNum = parseFloat(height);
      }
      
      if (isNaN(weightNum) || isNaN(heightNum)) {
        Alert.alert('Invalid Input', 'Please enter valid numbers for weight and height.');
        setIsLoading(false);
        return;
      }
      
      // Convert weight to kg for storage if it's in lb
      const weightInKg = weightUnit === 'lb' ? weightNum / KG_TO_LB : weightNum;
      
      // Update user profile with the collected data
      await updateUserProfile({
        name,
        weight: weightInKg,  // Always store weight in kg in the database
        height: heightNum,   // Always store height in cm in the database
        weightUnit,          // Store user's preferred unit
        heightUnit,          // Store user's preferred unit
      });
      
      // Wait to make sure data is saved
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Navigate to the next onboarding screen
      router.push('/(onboarding)/goals-setup');
    } catch (error) {
      console.error('Error saving profile data:', error);
      Alert.alert('Error', 'There was an error saving your profile data. Please try again.');
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
                  {/* Unit toggle button */}
                  <TouchableOpacity 
                    style={styles.unitToggle}
                    onPress={toggleWeightUnit}
                  >
                    <Text style={styles.unitToggleText}>{weightUnit}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={[styles.inputContainer, styles.rowItem]}>
                <Text style={styles.label}>Height</Text>
                {heightUnit === 'ft' ? (
                  <View style={styles.heightInputContainer}>
                    {/* Feet input */}
                    <View style={styles.ftInputContainer}>
                      <TextInput
                        style={[styles.input, styles.ftInput]}
                        value={height}
                        onChangeText={setHeight}
                        placeholder="Ft"
                        placeholderTextColor="#999"
                        keyboardType="decimal-pad"
                        maxLength={1}
                      />
                      <Text style={styles.unitLabel}>ft</Text>
                    </View>
                    
                    {/* Inches input */}
                    <View style={styles.inInputContainer}>
                      <TextInput
                        style={[styles.input, styles.inInput]}
                        value={inches}
                        onChangeText={setInches}
                        placeholder="In"
                        placeholderTextColor="#999"
                        keyboardType="decimal-pad"
                        maxLength={2}
                      />
                      <Text style={styles.unitLabel}>in</Text>
                    </View>
                    
                    {/* Unit toggle button - showing current unit */}
                    <TouchableOpacity 
                      style={styles.unitToggle}
                      onPress={toggleHeightUnit}
                    >
                      <Text style={styles.unitToggleText}>ft</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.unitInputContainer}>
                    <TextInput
                      style={[styles.input, styles.unitInput]}
                      value={height}
                      onChangeText={setHeight}
                      placeholder="Height"
                      placeholderTextColor="#999"
                      keyboardType="decimal-pad"
                    />
                    {/* Unit toggle button - showing current unit */}
                    <TouchableOpacity 
                      style={styles.unitToggle}
                      onPress={toggleHeightUnit}
                    >
                      <Text style={styles.unitToggleText}>cm</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
  unitToggle: {
    width: 50,
    height: 50,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    marginLeft: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unitToggleText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: 'white',
  },
  heightInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    justifyContent: 'space-between'
  },
  unitLabel: {
    marginLeft: 2,
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#555',
  },
  ftInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '30%',
  },
  ftInput: {
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  inInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '30%',
    marginHorizontal: 4,
  },
  inInput: {
    paddingHorizontal: 8,
    textAlign: 'center',
  },
}); 