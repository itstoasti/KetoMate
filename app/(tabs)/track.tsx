import React, { useState, useContext, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator,
  Keyboard,
  Alert,
  Platform
} from 'react-native';
import { Search as SearchIcon, Scan, X, CheckCircle2, Plus, Check } from 'lucide-react-native';
import { useAppContext } from '../../context/AppContext';
import { Food, Macro, Meal } from '../../types';
import { getFoodDetailsFromAI, NotFoundMarker, getNutritionFromImageAI } from '../../services/foodService';
import FoodCard from '../../components/FoodCard';
import BarcodeScanner from '../../components/BarcodeScanner';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabaseClient';
import { Camera, CameraView } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

function isNotFoundMarker(obj: any): obj is NotFoundMarker {
  return obj && typeof obj === 'object' && obj.status === 'not_found';
}

export default function TrackScreen() {
  const { addMeal, checkIfFoodIsKetoFriendly, session } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [analyzedFood, setAnalyzedFood] = useState<Food | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [showingScanner, setShowingScanner] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('snack');
  
  const [showManualEntryForm, setShowManualEntryForm] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualServingSize, setManualServingSize] = useState('');
  const [manualCalories, setManualCalories] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualFat, setManualFat] = useState('');
  const [scannedBarcodeForManualEntry, setScannedBarcodeForManualEntry] = useState<string | null>(null);

  // State for Nutrition Label Scanner
  const [showLabelScanner, setShowLabelScanner] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const cameraRef = useRef<CameraView>(null); // Ref for camera component
  const [isAnalyzingLabel, setIsAnalyzingLabel] = useState(false); // Added loading state

  // Request Camera Permissions on mount (or when needed)
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(status === 'granted');
    })();
  }, []);

  const handleApiResponse = (result: any, isScan = false, barcode: string | null = null) => {
    setAnalyzedFood(null);
    setShowManualEntryForm(false);
    setScannedBarcodeForManualEntry(null);

    if (result === null) {
      Alert.alert("Error", "An error occurred while analyzing the food.");
    } else if (isNotFoundMarker(result)) {
      Alert.alert(
        isScan ? "Barcode Not Found" : "Item Not Found",
        "Could not automatically retrieve details. Would you like to enter them manually?",
        [
          { text: "Cancel", style: "cancel", onPress: () => { if(isScan) setShowingScanner(false); } },
          { text: "Enter Manually", onPress: () => {
              if (isScan && barcode) setScannedBarcodeForManualEntry(barcode);
              setShowManualEntryForm(true);
              if (isScan) setShowingScanner(false);
          } },
        ]
      );
    } else if (result.brand === 'Parsing Failed') {
      Alert.alert(
        "Parsing Error",
        "Could not understand the response from the AI. Would you like to enter details manually?",
        [
          { text: "Cancel", style: "cancel", onPress: () => { if(isScan) setShowingScanner(false); } },
          { text: "Enter Manually", onPress: () => {
              if (isScan && barcode) setScannedBarcodeForManualEntry(barcode);
              setShowManualEntryForm(true);
              if (isScan) setShowingScanner(false);
          } },
        ]
      );
    } else {
      if (!result.id) {
         result.id = `shared_${barcode || Date.now()}`;
      }
      if (result.isKetoFriendly === undefined && result.macros) {
          result.isKetoFriendly = checkIfFoodIsKetoFriendly(result.macros);
      }
      setAnalyzedFood(result);
      if (isScan) setShowingScanner(false);
    }
  };
  
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    Keyboard.dismiss();
    setIsSearching(true);
    setAnalyzedFood(null);
    setScanLoading(false);
    setShowManualEntryForm(false);

    try {
      const result = await getFoodDetailsFromAI(searchQuery.trim());
      handleApiResponse(result);
    } catch (error) {
      console.error("Error fetching food details:", error);
      Alert.alert("Error", "An error occurred while searching for the food.");
      setAnalyzedFood(null);
      setShowManualEntryForm(false);
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleBarcodeScan = async (barcode: string) => {
    console.log(`[TrackScreen] Handling barcode: ${barcode}`);
    Keyboard.dismiss();
    setAnalyzedFood(null);
    setShowManualEntryForm(false);
    setScannedBarcodeForManualEntry(null);

    if (!session) {
      Alert.alert("Auth Error", "You must be logged in to check the shared database.");
      setShowingScanner(false);
      return;
    }

    setScanLoading(true);

    try {
      console.log(`[TrackScreen] Looking up shared data for barcode: ${barcode}`);
      const { data: sharedData, error: functionError } = await supabase.functions.invoke(
        `barcode-handler?barcode=${encodeURIComponent(barcode)}`,
        { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (functionError) {
        console.error("[TrackScreen] Barcode handler function error:", functionError);
      }

      if (sharedData && sharedData.status === 'found_shared') {
        console.log(`[TrackScreen] Found shared data for barcode ${barcode}:`, sharedData);
        const foodItem: Food = {
          id: `shared_${barcode}`,
          name: sharedData.name,
          brand: sharedData.brand || 'User Submitted',
          servingSize: sharedData.servingSize || 'N/A',
          macros: {
            calories: sharedData.macros?.calories || 0,
            carbs: sharedData.macros?.carbs || 0,
            protein: sharedData.macros?.protein || 0,
            fat: sharedData.macros?.fat || 0,
          },
          description: 'Data from shared user database.',
          dateAdded: new Date().toISOString(),
          isKetoFriendly: checkIfFoodIsKetoFriendly({ carbs: sharedData.macros?.carbs || 0 }),
        };
        setAnalyzedFood(foodItem);
        setShowingScanner(false);
        return;
      } else {
         console.log(`[TrackScreen] Barcode ${barcode} not found in shared data or non-success response.`);
      }
      
      console.log(`[TrackScreen] Falling back to AI for barcode: ${barcode}`);
      const initialQuery = `food item with barcode ${barcode}`;
      const result = await getFoodDetailsFromAI(initialQuery);
      handleApiResponse(result, true, barcode);

    } catch (error) {
      console.error("Error processing barcode scan:", error);
      Alert.alert("Error", "An unexpected error occurred while processing the barcode.");
      setAnalyzedFood(null);
      setShowManualEntryForm(false);
      setScannedBarcodeForManualEntry(null);
      setShowingScanner(false);
    } finally {
      setScanLoading(false);
    }
  };
  
  const handleAddToLog = () => {
    if (analyzedFood) {
      const mealName = analyzedFood.name;
    
    const newMeal: Meal = {
        id: `meal_${Date.now()}`,
        name: mealName,
        foods: [analyzedFood],
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'HH:mm'),
        type: selectedMealType,
        macros: analyzedFood.macros
    };
    
      console.log(`Adding meal (${selectedMealType}):`, newMeal);
    addMeal(newMeal);
    
      Alert.alert("Meal Added", `${analyzedFood.name} added as ${selectedMealType}.`);
    }
  };
  
  const renderMealTypeButtons = () => {
    const types: { type: MealType, label: string, color: string }[] = [
      { type: 'breakfast', label: 'Breakfast', color: '#FFC107' },
      { type: 'lunch', label: 'Lunch', color: '#4CAF50' },
      { type: 'dinner', label: 'Dinner', color: '#FF5252' },
      { type: 'snack', label: 'Snack', color: '#9C27B0' }
    ];
    
    return (
      <View style={styles.mealTypeContainer}>
        {types.map(item => (
          <TouchableOpacity
            key={item.type}
            style={[
              styles.mealTypeButton,
              selectedMealType === item.type && { backgroundColor: `${item.color}30` }
            ]}
            onPress={() => setSelectedMealType(item.type)}
          >
            {selectedMealType === item.type && (
              <CheckCircle2 size={16} color={item.color} style={{ marginRight: 6 }} />
            )}
            <Text
              style={[
                styles.mealTypeLabel,
                selectedMealType === item.type && { color: item.color, fontFamily: 'Inter-SemiBold' }
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const handleSaveManualEntry = async () => {
    if (!manualName.trim() || !manualServingSize.trim()) {
      Alert.alert("Missing Info", "Please enter at least a Name and Serving Size.");
      return;
    }
    const calories = parseFloat(manualCalories) || 0;
    const carbs = parseFloat(manualCarbs) || 0;
    const protein = parseFloat(manualProtein) || 0;
    const fat = parseFloat(manualFat) || 0;

    const macros: Macro = { calories, carbs, protein, fat };

    const newManualFood: Food = {
      id: uuidv4(),
      name: manualName.trim(),
      brand: 'Manual Entry',
      servingSize: manualServingSize.trim(),
      macros: macros,
      description: 'Manually entered food item.',
      dateAdded: new Date().toISOString(),
      isKetoFriendly: checkIfFoodIsKetoFriendly(macros),
    };

    setAnalyzedFood(newManualFood);
    setShowManualEntryForm(false);
    const currentBarcode = scannedBarcodeForManualEntry;

    setManualName('');
    setManualServingSize('');
    setManualCalories('');
    setManualCarbs('');
    setManualProtein('');
    setManualFat('');
    setScannedBarcodeForManualEntry(null);
    Keyboard.dismiss();

    if (currentBarcode) {
        console.log(`[TrackScreen] Saving manually entered data for barcode ${currentBarcode} to shared DB...`);
        try {
            const payload = {
                barcode: currentBarcode,
                name: newManualFood.name,
                serving_size: newManualFood.servingSize,
                calories: newManualFood.macros.calories,
                carbs: newManualFood.macros.carbs,
                protein: newManualFood.macros.protein,
                fat: newManualFood.macros.fat,
            };
            const { error: saveError } = await supabase.functions.invoke(
                'barcode-handler',
                { method: 'POST', body: payload }
            );

            if (saveError) {
                console.error("[TrackScreen] Error saving shared barcode data:", saveError);
            } else {
                console.log(`[TrackScreen] Successfully saved shared data for barcode ${currentBarcode}`);
            }
        } catch (err) {
             console.error("[TrackScreen] Exception saving shared barcode data:", err);
        }
    }
  };

  // --- Nutrition Label Scanning Logic ---

  const handleOpenCameraForLabelScan = async () => {
    Keyboard.dismiss(); // Dismiss keyboard if open
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasCameraPermission(status === 'granted');

    if (status === 'granted') {
      console.log('[TrackScreen] Camera permission granted, opening label scanner.');
      setShowLabelScanner(true);
    } else {
      Alert.alert('Permission Denied', 'Camera access is required to scan nutrition labels.');
      console.log('[TrackScreen] Camera permission denied.');
    }
  };

  const handlePictureTaken = async () => {
    if (cameraRef.current && !isAnalyzingLabel) {
      setIsAnalyzingLabel(true);
      try {
        // 1. Take picture, get base64
        const photo = await cameraRef.current.takePictureAsync({
            quality: 0.5, // Increased quality slightly
            base64: true // Get base64 directly
        });
        setShowLabelScanner(false);
        console.log('[TrackScreen] Nutrition label picture taken. Base64 length:', photo?.base64?.length);

        if (photo?.base64) {
          // No need for storage upload
          // console.log('[TrackScreen] Uploading image to Supabase Storage at path:', filePath);
          // const arrayBuffer = decode(photo.base64);
          // const { data: uploadData, error: uploadError } = await supabase.storage
          //   .from('nutrition-labels')
          //   .upload(filePath, arrayBuffer, {
          //     contentType: 'image/jpeg',
          //     upsert: true,
          //   });

          // if (uploadError) {
          //   throw new Error(`Storage Upload Error: ${uploadError.message}`);
          // }
          // console.log('[TrackScreen] Image uploaded successfully:', uploadData?.path);

          // const { data: urlData } = supabase.storage
          //   .from('nutrition-labels')
          //   .getPublicUrl(filePath);

          // const publicUrl = urlData?.publicUrl;
          // if (!publicUrl) {
          //   throw new Error('Could not get public URL for uploaded image.');
          // }
          // console.log('[TrackScreen] Public Image URL:', publicUrl);

          // 2. Call AI service with base64 data
          console.log('[TrackScreen] Sending image base64 to AI for analysis...');
          // Pass base64 data directly
          const nutritionResult = await getNutritionFromImageAI(photo.base64);

          if (nutritionResult.error) {
              throw new Error(`Analysis Service Error: ${nutritionResult.error}`);
          }

          console.log('[TrackScreen] AI Analysis Result:', nutritionResult);

          // 3. Populate manual entry fields
          setManualName(nutritionResult.name || '');
          setManualServingSize(nutritionResult.servingSize || '');
          // Ensure values are strings for TextInput
          setManualCalories(nutritionResult.calories !== undefined ? String(nutritionResult.calories) : '');
          setManualCarbs(nutritionResult.carbs !== undefined ? String(nutritionResult.carbs) : '');
          setManualProtein(nutritionResult.protein !== undefined ? String(nutritionResult.protein) : '');
          setManualFat(nutritionResult.fat !== undefined ? String(nutritionResult.fat) : '');

          // Optionally keep the manual entry form open or provide feedback
          Alert.alert('Success', 'Nutrition information extracted. Please review and confirm.');


        } else {
          console.warn('[TrackScreen] No base64 data found in photo object.');
          Alert.alert('Error', 'Could not capture image data.');
        }
      } catch (error: any) {
        console.error('[TrackScreen] Error during nutrition label processing:', error);
        Alert.alert('Error', `Failed to analyze nutrition label: ${error.message}`);
      } finally {
        setIsAnalyzingLabel(false);
        // Clean up if URI was used (not needed now)
        // if (photoUri) {
        //   try {
        //     await FileSystem.deleteAsync(photoUri);
        //     console.log('[TrackScreen] Cleaned up temporary image file:', photoUri);
        //   } catch (cleanupError) {
        //     console.error('[TrackScreen] Error cleaning up image file:', cleanupError);
        //   }
        // }
      }
    }
  };

  // --- End Nutrition Label Scanning Logic ---

  const renderManualEntryForm = () => (
    <View style={styles.manualEntryContainer}>
      <Text style={styles.manualEntryTitle}>Enter Food Details Manually</Text>
      <TextInput
        style={styles.manualInput}
        placeholder="Food Name *"
        value={manualName}
        onChangeText={setManualName}
      />
      <TextInput
        style={styles.manualInput}
        placeholder="Serving Size * (e.g., 1 cup, 100g)"
        value={manualServingSize}
        onChangeText={setManualServingSize}
      />
      <View style={styles.macroInputRow}>
        <TextInput style={styles.macroInput} placeholder="Cals" value={manualCalories} onChangeText={setManualCalories} keyboardType="numeric" />
        <TextInput style={styles.macroInput} placeholder="Carbs (g)" value={manualCarbs} onChangeText={setManualCarbs} keyboardType="numeric" />
      </View>
      <View style={styles.macroInputRow}>
        <TextInput style={styles.macroInput} placeholder="Protein (g)" value={manualProtein} onChangeText={setManualProtein} keyboardType="numeric" />
        <TextInput style={styles.macroInput} placeholder="Fat (g)" value={manualFat} onChangeText={setManualFat} keyboardType="numeric" />
      </View>
      <TouchableOpacity
        style={[styles.manualButton, styles.scanLabelButton]}
        onPress={handleOpenCameraForLabelScan}
      >
        <Text style={[styles.manualButtonText, styles.scanLabelButtonText]}>Scan Nutrition Label</Text>
      </TouchableOpacity>
      <View style={styles.manualButtonRow}>
        <TouchableOpacity 
          style={[styles.manualButton, styles.cancelButton]} 
          onPress={() => setShowManualEntryForm(false)}
        >
          <Text style={[styles.manualButtonText, styles.cancelButtonText]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.manualButton, styles.saveButton]} 
          onPress={handleSaveManualEntry}
        >
          <Text style={styles.manualButtonText}>Save & Use</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
  return (
    <View style={styles.container}>
      {/* Nutrition Label Camera View */}
      {showLabelScanner && hasCameraPermission ? (
         <CameraView 
           ref={cameraRef}
           style={StyleSheet.absoluteFillObject} // Make camera fill screen
           facing="back"
         >
           <View style={styles.cameraOverlay}>
             {/* Optional: Add UI elements over the camera, like a close button or focus square */}
             <TouchableOpacity 
                style={styles.cameraCloseButton} 
                onPress={() => setShowLabelScanner(false)}
             >
                <X size={30} color="#fff" />
             </TouchableOpacity>
             <TouchableOpacity 
                style={styles.cameraCaptureButton} 
                onPress={handlePictureTaken}
             >
                {/* Simple capture button appearance */}
             </TouchableOpacity>
           </View>
         </CameraView>
      ) : (
        <>
          {/* Show loading indicator over the main screen */} 
          {isAnalyzingLabel && (
            <View style={styles.labelAnalysisLoadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.labelAnalysisLoadingText}>Analyzing Label...</Text>
            </View>
          )}

          <ScrollView 
            style={[styles.scrollView, isAnalyzingLabel && styles.dimmedBackground]} // Dim background when analyzing
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={styles.title}>Track Food</Text>
              <Text style={styles.subtitle}>Search or scan to analyze a food item</Text> 
            </View>

            <View style={styles.searchContainer}>
              <View style={styles.searchBar}>
                <SearchIcon size={20} color="#888" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search for a food..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                />
              </View>
              
              <TouchableOpacity 
                style={styles.scanButton}
                onPress={() => setShowingScanner(true)}
                disabled={isSearching || scanLoading}
              >
                <Scan size={20} color={isSearching || scanLoading ? "#ccc" : "#4CAF50"} />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={[
                styles.searchButton, 
                (isSearching || !searchQuery.trim()) && styles.disabledButton
              ]}
              onPress={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.searchButtonText}>Analyze Food</Text>
              )}
            </TouchableOpacity>
            
            {(isSearching || scanLoading) && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.loadingText}>
                  {scanLoading ? 'Analyzing scanned item...' : 'Analyzing food...'}
                </Text>
              </View>
            )}
            
            {showManualEntryForm && !isSearching && !scanLoading && renderManualEntryForm()}
            
            {analyzedFood && !isSearching && !scanLoading && !showManualEntryForm && (
              <View style={styles.analyzedFoodContainer}>
                <Text style={styles.analyzedTitle}>Analyzed Food Details</Text>
                <FoodCard food={analyzedFood} />
                
                <Text style={styles.mealTypeTitle}>Add as:</Text>
                    {renderMealTypeButtons()}
                    
                    <TouchableOpacity 
                      style={styles.addToLogButton} 
                      onPress={handleAddToLog}
                    >
                      <Check size={20} color="#fff" style={{ marginRight: 8 }}/>
                      <Text style={styles.addToLogButtonText}>
                        Add as {selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1)}
                      </Text>
                    </TouchableOpacity>
              </View>
            )}

          </ScrollView>
          
          {showingScanner && (
            <BarcodeScanner
              onScan={handleBarcodeScan}
              onClose={() => setShowingScanner(false)}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F4F4',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 50,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#666',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2.22,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#333',
  },
  scanButton: {
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: '#a5d6a7',
    elevation: 0,
    shadowOpacity: 0,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#555',
  },
  analyzedFoodContainer: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 3.00,
    elevation: 3,
  },
  analyzedTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#333',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  mealTypeTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#555',
    marginTop: 15,
    marginBottom: 10,
  },
  mealTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  mealTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  mealTypeLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#444',
  },
  addToLogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 4,
  },
  addToLogButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  manualEntryContainer: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3.00,
    elevation: 3,
  },
  manualEntryTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  manualInput: {
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    marginBottom: 12,
  },
  macroInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  macroInput: {
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    width: '48%',
    textAlign: 'center',
  },
  manualButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  manualButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  manualButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#fff',
  },
  cancelButtonText: {
    color: '#555',
  },
  scanLabelButton: {
    backgroundColor: '#2196F3',
    marginTop: 15,
    marginHorizontal: 5,
  },
  scanLabelButtonText: {
    color: '#fff',
  },
  // Styles for Camera View
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'column', // Align items vertically
    justifyContent: 'space-between', // Push close to top, capture to bottom
    padding: 30,
  },
  cameraCloseButton: {
    alignSelf: 'flex-start', // Position close button top-left (within padding)
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 25,
  },
  cameraCaptureButton: {
    alignSelf: 'center', // Center capture button horizontally
    marginBottom: 20, // Space from bottom
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 3,
    borderColor: 'rgba(0,0,0,0.3)',
  },
  // Styles for Label Analysis Loading
  labelAnalysisLoadingOverlay: {
    ...StyleSheet.absoluteFillObject, // Cover entire screen
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Semi-transparent black
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10, // Ensure it's above other content
  },
  labelAnalysisLoadingText: {
    marginTop: 15,
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#fff',
  },
  dimmedBackground: {
      opacity: 0.5, // Dim the background content slightly
  }
});