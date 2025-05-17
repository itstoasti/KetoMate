import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Switch, Platform } from 'react-native';
import { useAppContext } from '@/context/AppContext';
import { UserProfile } from '@/types';
import { Save, CircleUser as UserCircle, Settings, CornerUpRight, Info, Trash2, LogOut } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Weight Conversion Helpers ---
const KG_TO_LB = 2.20462;
const kgToLb = (kg: number): number => kg * KG_TO_LB;
const lbToKg = (lb: number): number => lb / KG_TO_LB;
const roundToDecimal = (num: number, decimals: number = 1): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
};
// --- End Weight Conversion Helpers ---

// --- Height Conversion Helpers ---
const CM_TO_INCH = 0.393701;
const INCH_TO_CM = 2.54;

const cmToFtIn = (cm: number): { ft: number, in: number } => {
  if (isNaN(cm) || cm <= 0) return { ft: 0, in: 0 };
  const totalInches = cm * CM_TO_INCH;
  const ft = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12); 
  return { ft, in: inches };
};

const ftInToCm = (ft: number, inches: number): number => {
  const ftNum = isNaN(ft) ? 0 : ft;
  const inNum = isNaN(inches) ? 0 : inches;
  const totalInches = (ftNum * 12) + inNum;
  return Math.round(totalInches * INCH_TO_CM); 
};
// --- End Height Conversion Helpers ---

export default function ProfileScreen() {
  const { userProfile, updateUserProfile, clearData, signOut } = useAppContext();
  const router = useRouter();
  
  const [name, setName] = useState(userProfile?.name || '');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>(userProfile?.weightUnit || 'lb');
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>(userProfile?.heightUnit || 'ft');
  const [goal, setGoal] = useState<'weight_loss' | 'maintenance' | 'muscle_gain'>(userProfile?.goal || 'weight_loss');
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'>(userProfile?.activityLevel || 'moderate');
  const [isEditingMacros, setIsEditingMacros] = useState(false);
  const [customCarbs, setCustomCarbs] = useState(userProfile?.dailyMacroLimit?.carbs?.toString() || '20');
  const [customProtein, setCustomProtein] = useState(userProfile?.dailyMacroLimit?.protein?.toString() || '120');
  const [customFat, setCustomFat] = useState(userProfile?.dailyMacroLimit?.fat?.toString() || '150');
  const [customCalories, setCustomCalories] = useState(userProfile?.dailyMacroLimit?.calories?.toString() || '1800');
  
  // Track if profile has been loaded
  const [profileLoaded, setProfileLoaded] = useState(false);
  
  // Effect to initialize and load profile data as soon as component mounts
  useEffect(() => {
    console.log("Profile screen mounted");
    setProfileLoaded(false);
  }, []);
  
  // --- Synchronized Height Update Logic ---
  const updateHeightStates = useCallback((value: number, sourceUnit: 'cm' | 'ft/in') => {
    if (isNaN(value) || value < 0) {
      // Handle invalid input, maybe clear all or set to 0?
      setHeightCm('');
      setHeightFt('');
      setHeightIn('');
      return;
    }

    if (sourceUnit === 'cm') {
      setHeightCm(Math.round(value).toString());
      const { ft, in: inches } = cmToFtIn(value);
      setHeightFt(ft.toString());
      setHeightIn(inches.toString());
    } else { // sourceUnit === 'ft/in' - value is passed as cm calculated from ft/in
      setHeightCm(Math.round(value).toString());
      // Assuming ft/in are already set by their own inputs, just ensure cm is updated
    }
  }, []); // Empty dependency array as it uses state setters only

  // Effect to load initial profile data and handle unit conversions
  useEffect(() => {
    if (userProfile) {
      console.log("Loading user profile data:", JSON.stringify(userProfile, null, 2));
      
      // Set the profile as loaded
      setProfileLoaded(true);
      
      // Basic info
      setName(userProfile.name || '');
      
      // Units - Use the stored unit preferences or default to lb/ft if not specified
      const profileWeightUnit = userProfile.weightUnit || 'lb';
      const profileHeightUnit = userProfile.heightUnit || 'ft';
      setWeightUnit(profileWeightUnit);
      setHeightUnit(profileHeightUnit);
      
      // Goals and activity
      setGoal(userProfile.goal || 'weight_loss');
      setActivityLevel(userProfile.activityLevel || 'moderate');
      
      // Weight handling with validation
      let weightKg = userProfile.weight || 70; // Default weight in kg if missing
      if (isNaN(weightKg) || weightKg <= 0) weightKg = 70;
      
      // Convert only if we need to display in pounds
      const displayWeight = profileWeightUnit === 'lb' ? kgToLb(weightKg) : weightKg;
      setWeight(roundToDecimal(displayWeight, 1).toString());
      
      // Height handling with validation
      let initialCm = userProfile.height || 170; // Default height in cm if missing
      if (isNaN(initialCm) || initialCm <= 0) initialCm = 170;
      
      // Convert cm to ft/in for easier reference later
      const ftInHeight = cmToFtIn(initialCm);
      const ftValue = ftInHeight.ft;
      const inValue = ftInHeight.in;
      
      // Handle height based on the stored unit preference
      if (profileHeightUnit === 'ft') {
        // Convert height from cm to feet/inches for display
        setHeightFt(ftValue.toString());
        setHeightIn(inValue.toString());
        // Keep the cm value in case it's needed
        setHeightCm(Math.round(initialCm).toString());
      } else {
        // Just use the cm value directly
        setHeightCm(Math.round(initialCm).toString());
        // Still calculate ft/in in case user switches units
        setHeightFt(ftValue.toString());
        setHeightIn(inValue.toString());
      }
      
      // Load macros with validation
      const carbs = userProfile.dailyMacroLimit?.carbs || 20;
      const protein = userProfile.dailyMacroLimit?.protein || 120;
      const fat = userProfile.dailyMacroLimit?.fat || 150;
      const calories = userProfile.dailyMacroLimit?.calories || 1800;
      
      setCustomCarbs(isNaN(carbs) ? '20' : carbs.toString());
      setCustomProtein(isNaN(protein) ? '120' : protein.toString());
      setCustomFat(isNaN(fat) ? '150' : fat.toString());
      setCustomCalories(isNaN(calories) ? '1800' : calories.toString());
      
      console.log("Profile data loaded to UI: weight=", displayWeight, weightUnit, "height=", 
        profileHeightUnit === 'ft' ? `${ftValue}ft ${inValue}in` : `${initialCm} cm`);
    } else {
      console.log("No user profile data available to load");
    }
  }, [userProfile]); // Only run when userProfile changes
  
  // Effect to handle manual unit changes (weight)
  useEffect(() => {
      // This effect should only run when the unit is *manually* changed by the user,
      // AFTER the initial load effect has run. We can use a check against userProfile
      // to prevent running on the very first load before the profile is set.
      if (!userProfile) return; 

      const currentWeightInputString = weight; // Get the current string value from the input state
      const currentWeightNum = parseFloat(currentWeightInputString);

      if (!isNaN(currentWeightNum)) {
          let convertedWeight: number;
          // Convert the *currently displayed value* to the *newly selected* unit
          if (weightUnit === 'lb') { // We just switched TO lbs
             // The number in the input *was* kg before the switch
             convertedWeight = kgToLb(currentWeightNum);
          } else { // We just switched TO kg
             // The number in the input *was* lbs before the switch
             convertedWeight = lbToKg(currentWeightNum);
          }
          setWeight(roundToDecimal(convertedWeight, 1).toString());
      }
      // Add 'weight' to dependency array so this runs if the weight input changes *before* the unit changes
      // Although, the main use case is reacting to weightUnit change.
  }, [weightUnit]); // Primarily depends on weightUnit 

  // Effect for height unit changes (display only, calculations done in input handlers)
  // This effect doesn't need to do calculations anymore, just triggers re-render
  useEffect(() => {
      // No logic needed here anymore, the input visibility is handled by heightUnit state
  }, [heightUnit]);

  const handleWeightUnitChange = (newUnit: 'kg' | 'lb') => {
    if (newUnit === weightUnit) return;
    // Conversion logic moved to useEffect triggered by weightUnit change
    setWeightUnit(newUnit); 
  };
  
  const handleHeightUnitChange = (newUnit: 'cm' | 'ft') => {
    if (newUnit === heightUnit) return;
    
    // If switching from cm to ft/in
    if (newUnit === 'ft' && heightUnit === 'cm') {
      const cmValue = parseFloat(heightCm);
      if (!isNaN(cmValue)) {
        const { ft, in: inches } = cmToFtIn(cmValue);
        setHeightFt(ft.toString());
        setHeightIn(inches.toString());
      }
    }
    // If switching from ft/in to cm
    else if (newUnit === 'cm' && heightUnit === 'ft') {
      const ftValue = parseFloat(heightFt);
      const inValue = parseFloat(heightIn);
      if (!isNaN(ftValue) || !isNaN(inValue)) {
        const ft = isNaN(ftValue) ? 0 : ftValue;
        const inches = isNaN(inValue) ? 0 : inValue;
        const cmValue = ftInToCm(ft, inches);
        setHeightCm(Math.round(cmValue).toString());
      }
    }
    
    // Update the height unit
    setHeightUnit(newUnit);
  };

  // --- New onChange Handlers for Height Inputs ---
  const handleCmChange = (text: string) => {
    const cmValue = parseFloat(text);
    setHeightCm(text); // Update the cm input directly
    if (!isNaN(cmValue)) {
      const { ft, in: inches } = cmToFtIn(cmValue);
      setHeightFt(ft.toString());
      setHeightIn(inches.toString());
    }
  };

  const handleFtChange = (text: string) => {
    const ftValue = parseFloat(text);
    setHeightFt(text); // Update the ft input directly
    const inValue = parseFloat(heightIn);
    if (!isNaN(ftValue) && !isNaN(inValue)) {
      const cmValue = ftInToCm(ftValue, inValue);
      setHeightCm(Math.round(cmValue).toString());
    } else if (!isNaN(ftValue) && heightIn === '') {
        // If only ft is entered, calculate cm based on ft and 0 inches
        const cmValue = ftInToCm(ftValue, 0);
        setHeightCm(Math.round(cmValue).toString());
    }
  };

  const handleInChange = (text: string) => {
    const inValue = parseFloat(text);
    setHeightIn(text); // Update the in input directly
    const ftValue = parseFloat(heightFt);
     if (!isNaN(ftValue) && !isNaN(inValue)) {
      const cmValue = ftInToCm(ftValue, inValue);
      setHeightCm(Math.round(cmValue).toString());
    } else if (!isNaN(inValue) && heightFt === '') {
        // If only inches is entered, calculate cm based on 0 ft and inches
        const cmValue = ftInToCm(0, inValue);
        setHeightCm(Math.round(cmValue).toString());
    }
  };
  // --- End New Handlers ---

  const handleSave = () => {
    let weightInKg: number;
    let heightInCm: number;

    const weightNum = parseFloat(weight);
    const carbsNum = parseInt(customCarbs, 10);
    const proteinNum = parseInt(customProtein, 10);
    const fatNum = parseInt(customFat, 10);
    const caloriesNum = parseInt(customCalories, 10);
    
    if (isNaN(weightNum)) {
      Alert.alert('Invalid Weight', 'Please enter a valid number for weight.');
      return;
    }
    weightInKg = weightUnit === 'lb' ? lbToKg(weightNum) : weightNum;

    // Use the definitive cm state for saving
    const heightCmNum = parseFloat(heightCm); 
    if (isNaN(heightCmNum) || heightCmNum <= 0) {
      Alert.alert('Invalid Height', 'Please enter a valid height.');
      return;
    }
    heightInCm = heightCmNum;
    
    if (isNaN(carbsNum) || isNaN(proteinNum) || isNaN(fatNum) || isNaN(caloriesNum)) {
      Alert.alert('Invalid Macros', 'Please enter valid numbers for all macros.');
      return;
    }

    const updatedProfile: UserProfile = {
      id: userProfile?.id || '1',
      name,
      weight: weightInKg,
      height: heightInCm,
      weightUnit: weightUnit,
      heightUnit: heightUnit,
      goal,
      activityLevel,
      dailyMacroLimit: {
        carbs: carbsNum,
        protein: proteinNum,
        fat: fatNum,
        calories: caloriesNum
      },
      dailyCalorieLimit: caloriesNum
    };
    
    updateUserProfile(updatedProfile);
    setIsEditingMacros(false);
    
    Alert.alert('Success', 'Profile updated successfully!');
  };
  
  const confirmClearData = () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to clear all your data? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear Data', 
          style: 'destructive',
          onPress: () => {
            clearData();
            Alert.alert('Success', 'All data has been cleared.');
          }
        }
      ]
    );
  };
  
  const handleSignOut = () => {
    Alert.alert(
      "Confirm Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await signOut();
            // Explicitly navigate to login screen after signing out
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };
  
  const renderGoalButtons = () => {
    const goals = [
      { value: 'weight_loss', label: 'Weight Loss' },
      { value: 'maintenance', label: 'Maintenance' },
      { value: 'muscle_gain', label: 'Muscle Gain' }
    ];
    
    return (
      <View style={styles.segmentedControl}>
        {goals.map(item => (
          <TouchableOpacity
            key={item.value}
            style={[
              styles.segmentButton,
              goal === item.value && styles.segmentButtonActive
            ]}
            onPress={() => setGoal(item.value as any)}
          >
            <Text
              style={[
                styles.segmentButtonText,
                goal === item.value && styles.segmentButtonTextActive
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
  const renderActivityLevelButtons = () => {
    const levels = [
      { value: 'sedentary', label: 'Sedentary' },
      { value: 'light', label: 'Light' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'active', label: 'Active' },
      { value: 'very_active', label: 'Very Active' }
    ];
    
    return (
      <View style={styles.activityContainer}>
        {levels.map(item => (
          <TouchableOpacity
            key={item.value}
            style={[
              styles.activityButton,
              activityLevel === item.value && styles.activityButtonActive
            ]}
            onPress={() => setActivityLevel(item.value as any)}
          >
            <Text
              style={[
                styles.activityButtonText,
                activityLevel === item.value && styles.activityButtonTextActive
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderWeightUnitSelector = () => {
    const units = [
      { value: 'kg', label: 'kg' },
      { value: 'lb', label: 'lb' }
    ];
    return (
      <View style={styles.unitSelectorContainer}>
        {units.map(item => (
          <TouchableOpacity
            key={item.value}
            style={[
              styles.unitButton,
              weightUnit === item.value && styles.unitButtonActive
            ]}
            onPress={() => handleWeightUnitChange(item.value as 'kg' | 'lb')}
          >
            <Text
              style={[
                styles.unitButtonText,
                weightUnit === item.value && styles.unitButtonTextActive
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderHeightUnitSelector = () => {
    const units = [
      { value: 'cm', label: 'cm' },
      { value: 'ft', label: 'ft / in' }
    ];
    return (
      <View style={styles.unitSelectorContainer}>
        {units.map(item => (
          <TouchableOpacity
            key={item.value}
            style={[
              styles.unitButton,
              heightUnit === item.value && styles.unitButtonActive
            ]}
            onPress={() => handleHeightUnitChange(item.value as 'cm' | 'ft')}
          >
            <Text
              style={[
                styles.unitButtonText,
                heightUnit === item.value && styles.unitButtonTextActive
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage your personal information</Text>
        </View>
        
        <View style={styles.profileSection}>
          <View style={styles.profileIconContainer}>
            <UserCircle size={60} color="#4CAF50" />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your Name"
            />
          </View>
          
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Weight</Text>
              <TextInput
                style={styles.input}
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                placeholder={`Weight in ${weightUnit}`}
              />
              {renderWeightUnitSelector()}
            </View>
            
            <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Height</Text>
              {heightUnit === 'cm' ? (
                <TextInput
                  style={styles.input}
                  value={heightCm}
                  onChangeText={handleCmChange}
                  keyboardType="numeric"
                  placeholder="Height in cm"
                />
              ) : (
                <View style={styles.ftInContainer}>
                  <TextInput
                    style={[styles.input, styles.ftInput]}
                    value={heightFt}
                    onChangeText={handleFtChange}
                    keyboardType="numeric"
                    placeholder="ft"
                  />
                  <Text style={styles.ftInLabel}>ft</Text>
                  <TextInput
                    style={[styles.input, styles.inInput]}
                    value={heightIn}
                    onChangeText={handleInChange}
                    keyboardType="numeric"
                    placeholder="in"
                    maxLength={2}
                  />
                  <Text style={styles.ftInLabel}>in</Text>
                </View>
              )}
              {renderHeightUnitSelector()}
            </View>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Goal</Text>
            {renderGoalButtons()}
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Activity Level</Text>
            {renderActivityLevelButtons()}
          </View>
        </View>
        
        <View style={styles.macroSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              <Settings size={18} color="#333" style={{ marginRight: 8 }} />
              Daily Macro Goals
            </Text>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => setIsEditingMacros(!isEditingMacros)}
            >
              <Text style={styles.editButtonText}>
                {isEditingMacros ? 'Cancel' : 'Edit'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {isEditingMacros ? (
            <View style={styles.macroForm}>
              <View style={styles.macroItem}>
                <Text style={styles.macroLabel}>Carbs (g)</Text>
                <TextInput
                  style={styles.macroInput}
                  value={customCarbs}
                  onChangeText={setCustomCarbs}
                  keyboardType="numeric"
                />
              </View>
              
              <View style={styles.macroItem}>
                <Text style={styles.macroLabel}>Protein (g)</Text>
                <TextInput
                  style={styles.macroInput}
                  value={customProtein}
                  onChangeText={setCustomProtein}
                  keyboardType="numeric"
                />
              </View>
              
              <View style={styles.macroItem}>
                <Text style={styles.macroLabel}>Fat (g)</Text>
                <TextInput
                  style={styles.macroInput}
                  value={customFat}
                  onChangeText={setCustomFat}
                  keyboardType="numeric"
                />
              </View>
              
              <View style={styles.macroItem}>
                <Text style={styles.macroLabel}>Calories</Text>
                <TextInput
                  style={styles.macroInput}
                  value={customCalories}
                  onChangeText={setCustomCalories}
                  keyboardType="numeric"
                />
              </View>
              
              <View style={styles.macroTip}>
                <Info size={16} color="#FFC107" style={{ marginRight: 8 }} />
                <Text style={styles.macroTipText}>
                  For keto diet, typically keep carbs below 20-30g
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.macroDisplay}>
              <View style={styles.macroRow}>
                <View style={styles.macroDisplayItem}>
                  <Text style={styles.macroValue}>{userProfile?.dailyMacroLimit?.carbs || 20}g</Text>
                  <Text style={styles.macroName}>Carbs</Text>
                </View>
                
                <View style={styles.macroDisplayItem}>
                  <Text style={styles.macroValue}>{userProfile?.dailyMacroLimit?.protein || 120}g</Text>
                  <Text style={styles.macroName}>Protein</Text>
                </View>
              </View>
              
              <View style={styles.macroRow}>
                <View style={styles.macroDisplayItem}>
                  <Text style={styles.macroValue}>{userProfile?.dailyMacroLimit?.fat || 150}g</Text>
                  <Text style={styles.macroName}>Fat</Text>
                </View>
                
                <View style={styles.macroDisplayItem}>
                  <Text style={styles.macroValue}>{userProfile?.dailyMacroLimit?.calories || 1800}</Text>
                  <Text style={styles.macroName}>Calories</Text>
                </View>
              </View>
            </View>
          )}
        </View>
        
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Save size={20} color="#fff" style={{ marginRight: 10 }}/>
          <Text style={styles.saveButtonText}>Save Profile</Text>
        </TouchableOpacity>
        
        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <TouchableOpacity style={[styles.dangerButton, styles.signOutButton]} onPress={handleSignOut}>
            <LogOut size={18} color="#D32F2F" style={{ marginRight: 10 }}/>
            <Text style={[styles.dangerButtonText, styles.signOutButtonText]}>Sign Out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dangerButton, styles.clearDataButton]} onPress={confirmClearData}>
            <Trash2 size={18} color="#fff" style={{ marginRight: 10 }}/>
            <Text style={[styles.dangerButtonText, styles.clearDataButtonText]}>Clear All App Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 28,
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#666',
  },
  profileSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileIconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 48,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#4CAF50',
  },
  segmentButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#666',
  },
  segmentButtonTextActive: {
    color: '#FFFFFF',
  },
  activityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  activityButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    marginBottom: 8,
  },
  activityButtonActive: {
    backgroundColor: '#4CAF50',
  },
  activityButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#666',
  },
  activityButtonTextActive: {
    color: '#FFFFFF',
  },
  macroSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 16,
    color: '#333',
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: '#555',
  },
  macroForm: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 16,
  },
  macroItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  macroLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#555',
  },
  macroInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 8,
    width: 80,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#333',
  },
  macroTip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  macroTipText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#7D6200',
    flex: 1,
  },
  macroDisplay: {
    padding: 8,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  macroDisplayItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  macroValue: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 18,
    color: '#333',
    marginBottom: 4,
  },
  macroName: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
  },
  saveButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 8,
  },
  dangerZone: {
    marginTop: 40,
    marginBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 20,
  },
  dangerTitle: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 16,
    color: '#FF5252',
    marginBottom: 16,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  signOutButton: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  clearDataButton: {
    backgroundColor: '#D32F2F',
  },
  dangerButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
  },
  signOutButtonText: {
    color: '#D32F2F',
  },
  clearDataButtonText: {
    color: '#fff',
  },
  unitSelectorContainer: {
    flexDirection: 'row',
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  unitButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  unitButtonActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  unitButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#555',
  },
  unitButtonTextActive: {
    fontFamily: 'Inter-SemiBold',
    color: '#4CAF50',
  },
  ftInContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingRight: 10,
    minHeight: 48,
  },
  ftInput: {
    flex: 1,
    textAlign: 'center',
    borderRightWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
  },
  inInput: {
    flex: 1,
    textAlign: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
  },
  ftInLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#888',
    paddingHorizontal: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  imperialHeightContainer: {
    flex: 1, 
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  imperialInput: {
    paddingVertical: Platform.OS === 'ios' ? 14 : 10, 
    fontSize: 16,
    minWidth: 40,
    textAlign: 'center',
    marginHorizontal: 2,
  },
  unitLabel: {
    fontSize: 16,
    color: '#666',
    marginLeft: 2,
    marginRight: 8,
  },
});