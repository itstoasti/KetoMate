import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
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
  Platform,
  Switch,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search as SearchIcon, Scan, X, CheckCircle2, Plus, Check, Info, Star, Heart, PlusCircle, Database } from 'lucide-react-native';
import { useAppContext } from '../../context/AppContext';
import { Food, Macro, Meal } from '../../types';
import { 
  getFoodDetailsFromAI, 
  NotFoundMarker, 
  getNutritionFromImageAI, 
  mockFoodSearch, 
  getKetoRating, 
  searchSharedFoods,
} from '../../services/foodService';
import FoodCard from '../../components/FoodCard';
import BarcodeScanner from '../../components/BarcodeScanner';
import FavoritesModal from '../../components/FavoritesModal';
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
  const { addMeal, session, favoriteFoods, addFavoriteFood, removeFavoriteFood } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [analyzedFood, setAnalyzedFood] = useState<Food | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [showingScanner, setShowingScanner] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('snack');
  const [servingMultiplier, setServingMultiplier] = useState('1');
  
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
  
  // State to track if form was populated by AI label scan
  const [formPopulatedByAI, setFormPopulatedByAI] = useState(false); 

  const [showFavoritesModal, setShowFavoritesModal] = useState(false); // State for modal visibility

  const [searchMode, setSearchMode] = useState<'ai' | 'community'>('community'); // Changed states and default
  const [sharedFoods, setSharedFoods] = useState<Food[]>([]);
  const [isLoadingSharedFoods, setIsLoadingSharedFoods] = useState(false);
  const [showSharedResults, setShowSharedResults] = useState(false);

  // Request Camera Permissions on mount (or when needed)
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(status === 'granted');
    })();
  }, []);

  // Function to reset manual form state and AI flag
  const resetManualForm = () => {
    setShowManualEntryForm(false);
    setManualName('');
    setManualServingSize('');
    setManualCalories('');
    setManualCarbs('');
    setManualProtein('');
    setManualFat('');
    setScannedBarcodeForManualEntry(null);
    setFormPopulatedByAI(false); // Reset the flag here
    setServingMultiplier('1'); // Reset multiplier here too
  };

  const handleApiResponse = (result: any, isScan = false, barcode: string | null = null) => {
    setAnalyzedFood(null);
    resetManualForm();

    if (result === null) {
      Alert.alert("Error", "An error occurred while analyzing the food.");
    } else if (isNotFoundMarker(result)) {
        if (isScan) {
            // Barcode scan failed: Offer manual entry
            Alert.alert(
                "Barcode Not Found",
                "Could not automatically retrieve details. Would you like to enter them manually?",
                [
                  { text: "Cancel", style: "cancel", onPress: () => { setShowingScanner(false); } },
                  { text: "Enter Manually", onPress: () => {
                      if (barcode) setScannedBarcodeForManualEntry(barcode);
                      setShowManualEntryForm(true);
                      setShowingScanner(false);
                  } },
                ]
            );
        } else {
            // Text search failed: Just inform the user
            Alert.alert("Item Not Found", "Could not find details for the searched item.");
        }
    } else if (result.brand === 'Parsing Failed') {
        if (isScan) {
            // Parsing failed after barcode scan: Offer manual entry
            Alert.alert(
                "Parsing Error",
                "Could not understand the response from the AI. Would you like to enter details manually?",
                [
                  { text: "Cancel", style: "cancel", onPress: () => { setShowingScanner(false); } },
                  { text: "Enter Manually", onPress: () => {
                      if (barcode) setScannedBarcodeForManualEntry(barcode);
                      setShowManualEntryForm(true);
                      setShowingScanner(false);
                  } },
                ]
            );
        } else {
             // Parsing failed after text search: Just inform the user
             Alert.alert("Parsing Error", "Could not understand the response from the AI.");
        }
    } else {
      // The result from getFoodDetailsFromAI already has ketoRating
      // No need to check or calculate it here.
      // if (!result.id) { 
      //    result.id = `shared_${barcode || Date.now()}`; 
      // }
      // if (result.isKetoFriendly === undefined && result.macros) {
      //     result.isKetoFriendly = checkIfFoodIsKetoFriendly(result.macros);
      // }
      
      // Ensure ID exists if it came from AI without one somehow
      if (!result.id) {
          result.id = `ai_fallback_${Date.now()}`;
      }
      
      setAnalyzedFood(result as Food); // Cast to Food type
      setServingMultiplier('1'); // Explicitly reset multiplier when new food is set
      if (isScan) setShowingScanner(false);
    }
  };
  
  const handleChangeSearchMode = (newMode: 'ai' | 'community') => {
    if (searchMode === newMode) return; 

    setSearchMode(newMode);
    // Cleanup logic
    setAnalyzedFood(null);
    setShowManualEntryForm(false);
    setSharedFoods([]);
    setShowSharedResults(false);
    setSearchQuery(''); 
    Keyboard.dismiss(); 
  };
  
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    Keyboard.dismiss();
    
    if (searchMode === 'ai') {
      // Existing AI search logic
      setIsSearching(true);
      setAnalyzedFood(null);
      setScanLoading(false);
      resetManualForm();
      setShowSharedResults(false);

      try {
        console.log('[TrackScreen] Starting AI food analysis for:', searchQuery.trim());
        const result = await getFoodDetailsFromAI(searchQuery.trim());
        console.log('[TrackScreen] Received result from AI service');
        handleApiResponse(result);
      } catch (error) {
        console.error("Error fetching food details:", error);
        Alert.alert("Error", "An error occurred while searching for the food. Try again or use manual entry.");
        setAnalyzedFood(null);
        setShowManualEntryForm(false);
      } finally {
        setIsSearching(false);
      }
    } else if (searchMode === 'community') { 
      setIsLoadingSharedFoods(true);
      setAnalyzedFood(null);
      setShowManualEntryForm(false);
      setSharedFoods([]);
      setShowSharedResults(false); 
      
      try {
        if (!session) {
          Alert.alert("Auth Error", "You must be logged in to search the shared database.");
          return;
        }
        
        // 'community' mode now directly uses searchSharedFoods or a similar function intended for the shared database.
        // If you had specific 'all' logic before that was different from 'shared', ensure it's correctly consolidated or adjusted.
        // For now, we will use searchSharedFoods as that seems to be the intent for the "Shared" option.
        const results = await searchSharedFoods(searchQuery.trim()); // Explicitly using searchSharedFoods
        console.log(`[TrackScreen] Found ${results.length} shared foods for "${searchQuery}"`);
        setSharedFoods(results);
        setShowSharedResults(true);
      } catch (error) {
        console.error("Error searching shared foods:", error);
        Alert.alert("Error", "An error occurred while searching the shared database.");
      } finally {
        setIsLoadingSharedFoods(false);
      }
    }
  };
  
  const handleBarcodeScan = async (barcode: string) => {
    console.log(`[TrackScreen] Handling barcode: ${barcode}`);
    Keyboard.dismiss();
    setAnalyzedFood(null);
    resetManualForm(); // Reset form and flag at start
    // setScannedBarcodeForManualEntry(null); <-- redundant

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
        
        const sharedMacros = {
            calories: sharedData.macros?.calories || 0,
            carbs: sharedData.macros?.carbs || 0, // Assuming net carbs from shared DB
            protein: sharedData.macros?.protein || 0,
            fat: sharedData.macros?.fat || 0,
        };
        // Use the imported function to calculate rating
        const sharedKetoRating = getKetoRating(sharedMacros.carbs);
        console.log(`[TrackScreen] Determined keto rating for shared data: ${sharedKetoRating}`);

        const foodItem: Food = {
          id: `shared_${barcode}`,
          name: sharedData.name,
          brand: sharedData.brand || 'User Submitted',
          servingSize: sharedData.servingSize || 'N/A',
          macros: sharedMacros,
          ketoRating: sharedKetoRating, // Assign calculated rating
          description: 'Data from shared user database.',
          dateAdded: new Date().toISOString(),
        };
        // TODO: Remove warning now
        // console.warn("[TrackScreen] KetoRating not assigned for shared barcode data yet.");
        setAnalyzedFood(foodItem);
        setShowingScanner(false);
        return;
      } else {
         console.log(`[TrackScreen] Barcode ${barcode} not found in shared data or non-success response.`);
      }
      
      console.log(`[TrackScreen] Falling back to AI for barcode: ${barcode}`);
      try {
        const result = await getFoodDetailsFromAI(barcode);
        handleApiResponse(result, true, barcode);
      } catch (error) {
        console.error("[TrackScreen] AI barcode analysis error:", error);
        Alert.alert("Error", "Could not analyze barcode. Please try manual entry.");
        setShowManualEntryForm(true);
        setScannedBarcodeForManualEntry(barcode);
      }

    } catch (error) {
      console.error("Error processing barcode scan:", error);
      Alert.alert("Error", "An unexpected error occurred. You can try entering details manually.");
      setAnalyzedFood(null);
      setShowManualEntryForm(true);
      setScannedBarcodeForManualEntry(barcode);
    } finally {
      setScanLoading(false);
      if (showingScanner) {
        setShowingScanner(false);
      }
    }
  };
  
  // Determine if the currently analyzed food is a favorite
  const isCurrentFoodFavorite = useMemo(() => {
    if (!analyzedFood) return false;
    return favoriteFoods.some(fav => fav.id === analyzedFood.id);
  }, [analyzedFood, favoriteFoods]);

  // Handler for toggling favorite status
  const handleToggleFavorite = () => {
    if (!analyzedFood) return;
    if (isCurrentFoodFavorite) {
      removeFavoriteFood(analyzedFood.id);
    } else {
      addFavoriteFood(analyzedFood);
    }
  };

  // --- Handlers for Favorites Modal ---
  const handleSelectFavorite = (food: Food) => {
    console.log("[TrackScreen] Selected favorite:", food.name);
    setAnalyzedFood(food); // Set the selected favorite as the current food
    setServingMultiplier('1'); // Reset multiplier
    setShowFavoritesModal(false); // Close the modal
  };

  const handleRemoveFavoriteFromModal = (foodId: string) => {
    console.log("[TrackScreen] Removing favorite from modal:", foodId);
    removeFavoriteFood(foodId); // Call context function to remove
    // The modal list will update automatically due to context state change
  };
  // --- End Handlers for Favorites Modal ---

  // --- Handler for opening the manual entry form ---
  const handleOpenManualEntry = () => {
    console.log("[TrackScreen] Opening manual entry form.");
    setAnalyzedFood(null); // Clear any analyzed food result
    resetManualForm(); // Reset form fields
    setShowManualEntryForm(true); // Show the form
    setScannedBarcodeForManualEntry(null); // Ensure barcode isn't carried over unintentionally
  };
  // --- End handler ---
  
  const handleAddToLog = () => {
    if (!analyzedFood) {
      Alert.alert("No Food Selected", "Please search or scan a food item first.");
      return;
    }

    const multiplier = parseFloat(servingMultiplier) || 1;
    if (multiplier <= 0) {
      Alert.alert("Invalid Serving", "Please enter a positive serving size multiplier.");
      return;
    }

    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    
    // Calculate multiplied macros
    const adjustedMacros: Macro = {
      calories: Math.round(analyzedFood.macros.calories * multiplier),
      carbs: parseFloat((analyzedFood.macros.carbs * multiplier).toFixed(1)),
      protein: parseFloat((analyzedFood.macros.protein * multiplier).toFixed(1)),
      fat: parseFloat((analyzedFood.macros.fat * multiplier).toFixed(1)),
    };

    const newMeal: Meal = {
      id: uuidv4(),
      name: `${analyzedFood.name} (${multiplier}x)`,
      date: today,
      type: selectedMealType,
      foods: [{ ...analyzedFood, quantity: multiplier }],
      macros: adjustedMacros,
      time: format(now, 'HH:mm') // Add current time
    };

    // Save to the add meal function from context
    addMeal(newMeal)
      .then(() => {
        console.log('[TrackScreen] Successfully added meal to log');
        
        // Clear the UI
        setAnalyzedFood(null);
        setSearchQuery('');
      })
      .catch(error => {
        console.error('[TrackScreen] Error adding meal:', error);
        Alert.alert("Error", "Failed to add meal to your log.");
      });
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
    
    // Extract food name and brand if format looks like "Brand - Food Name"
    let foodName = manualName.trim();
    let brandName = 'Manual Entry';
    
    if (foodName.includes(' - ')) {
      const parts = foodName.split(' - ');
      if (parts.length >= 2) {
        brandName = parts[0].trim();
        foodName = parts.slice(1).join(' - ').trim();
      }
    }
    
    const calories = parseFloat(manualCalories) || 0;
    // IMPORTANT: Assume carbs entered manually are NET CARBS
    // If you want users to enter Total Carbs/Fiber/Sugar Alc manually,
    // this form needs more fields and calculation here.
    const netCarbs = parseFloat(manualCarbs) || 0; 
    const protein = parseFloat(manualProtein) || 0;
    const fat = parseFloat(manualFat) || 0;

    // Calculate rating based on manually entered net carbs
    const rating = getKetoRating(netCarbs);
    console.log(`[TrackScreen] Manual entry keto rating: ${rating} for ${netCarbs}g net carbs.`);

    // Store net carbs in the 'carbs' field of the macro object
    const macros: Macro = { calories, carbs: netCarbs, protein, fat };

    const newManualFood: Food = {
      id: uuidv4(),
      name: foodName,
      brand: brandName,
      servingSize: manualServingSize.trim(),
      macros: macros,
      description: 'Manually entered food item.',
      dateAdded: new Date().toISOString(),
      ketoRating: rating, // Assign the calculated rating
    };

    setAnalyzedFood(newManualFood);
    setServingMultiplier('1'); // Reset multiplier when using manual entry result
    resetManualForm(); // Reset form and flag after saving
    const currentBarcode = scannedBarcodeForManualEntry; // Capture before reset

    // Clear local state *after* capturing barcode, before potentially long async call
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
    
    // First check if permission is already granted
    let { status } = await Camera.getCameraPermissionsAsync();
    console.log('[TrackScreen] Initial camera permission status:', status);
    
    // If not granted already, request it
    if (status !== 'granted') {
      console.log('[TrackScreen] Camera permission not granted, requesting...');
      const { status: newStatus } = await Camera.requestCameraPermissionsAsync();
      status = newStatus;
      console.log('[TrackScreen] New camera permission status:', status);
    }
    
    setHasCameraPermission(status === 'granted');

    if (status === 'granted') {
      console.log('[TrackScreen] Camera permission granted, opening label scanner.');
      setShowLabelScanner(true);
    } else {
      console.log('[TrackScreen] Camera permission denied.');
      
      // Check if permission is permanently denied
      if (status === 'denied') {
        Alert.alert(
          'Camera Permission Required',
          'KetoMate needs camera access to scan nutrition labels. Please enable camera permissions in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => {
                // Open device settings
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              } 
            }
          ]
        );
      } else {
        // Regular denial
        Alert.alert(
          'Permission Denied', 
          'Camera access is required to scan nutrition labels.'
        );
      }
    }
  };

  const handlePictureTaken = async () => {
    if (cameraRef.current && !isAnalyzingLabel) {
      setIsAnalyzingLabel(true);
      let photoBase64: string | undefined;
      try {
        // 1. Take picture, get base64
        const photo = await cameraRef.current.takePictureAsync({
            quality: 0.5, // Increased quality slightly
            base64: true // Get base64 directly
        });
        setShowLabelScanner(false);
        photoBase64 = photo?.base64; // Store base64
        console.log('[TrackScreen] Nutrition label picture taken. Base64 length:', photoBase64?.length);

        if (photoBase64) {
          // 2. Call AI service with base64 data
          console.log('[TrackScreen] Sending image base64 to AI for analysis...');
          
          try {
            const nutritionResult = await getNutritionFromImageAI(photoBase64);

            if (nutritionResult.error) {
              console.error('[TrackScreen] AI Analysis error:', nutritionResult.error);
              throw new Error(`Analysis failed: ${nutritionResult.error}`);
            }

            console.log('[TrackScreen] AI Analysis Result:', nutritionResult);
            
            // Log carb breakdown
            console.log(`[TrackScreen] Carb breakdown: Total=${nutritionResult.totalCarbs}, Fiber=${nutritionResult.fiber}, SugarAlc=${nutritionResult.sugarAlcohols}, Net=${nutritionResult.netCarbs}`);

            // 3. Populate manual entry fields with values or defaults
            setManualName(nutritionResult.name || '');
            setManualServingSize(nutritionResult.servingSize || '');
            setManualCalories(nutritionResult.calories !== undefined ? String(nutritionResult.calories) : '');
            const carbsToSet = nutritionResult.netCarbs !== undefined
              ? String(nutritionResult.netCarbs)
              : nutritionResult.totalCarbs !== undefined // Fallback to totalCarbs if netCarbs missing
                  ? String(nutritionResult.totalCarbs)
                  : ''; // Default to empty if neither is present
            setManualCarbs(carbsToSet);
            setManualProtein(nutritionResult.protein !== undefined ? String(nutritionResult.protein) : '');
            setManualFat(nutritionResult.fat !== undefined ? String(nutritionResult.fat) : '');
            
            // --- Set the flag indicating AI populated the form ---
            setFormPopulatedByAI(true); 
            
            // Open manual entry form if it's not already open
            setShowManualEntryForm(true);
            
            Alert.alert(
              'Nutrition Analyzed',
              'We extracted the nutrition information. Please review and make any needed corrections before saving.',
              [{ text: "OK" }]
            );
          } catch (analysisError: any) {
            console.error('[TrackScreen] Error analyzing nutrition label:', analysisError);
            
            // Open manual entry form anyway so user can enter data
            setShowManualEntryForm(true);
            setFormPopulatedByAI(false);
            
            Alert.alert(
              'Could Not Analyze Label',
              'We couldn\'t automatically read the nutrition label. Please enter the nutrition information manually.',
              [{ text: "OK" }]
            );
          }
        } else {
          console.warn('[TrackScreen] No base64 data found in photo object.');
          Alert.alert('Error', 'Could not capture image data.');
          setShowManualEntryForm(true); // Still let the user enter data manually
        }
      } catch (error: any) {
        console.error('[TrackScreen] Error during nutrition label processing:', error);
        setShowManualEntryForm(true); // Still let the user enter data manually
        
        Alert.alert(
          'Error Capturing Image',
          'There was a problem with the camera. You can enter the nutrition information manually.',
          [{ text: "OK" }]
        );
      } finally {
        setIsAnalyzingLabel(false);
      }
    }
  };

  // --- End Nutrition Label Scanning Logic ---

  const renderManualEntryForm = () => (
    <View style={styles.manualEntryContainer}>
      <Text style={styles.manualEntryTitle}>Enter Food Details Manually</Text>
      
      {/* Verification Hint - Conditionally Rendered */}
      {formPopulatedByAI && (
          <View style={styles.verificationHintContainer}>
              <Info size={16} color="#FFA000" style={styles.verificationHintIcon} />
              <Text style={styles.verificationHintText}>
                AI-populated data. Please verify against the label and adjust if needed.
              </Text>
          </View>
      )}
      
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
          onPress={resetManualForm} // Use reset function for cancel
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
  
  // Conditional rendering for overlays
  if (showLabelScanner && hasCameraPermission) {
    return (
      <CameraView 
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject} // Make camera fill screen
        facing="back"
      >
        <View style={styles.cameraOverlay}>
          <TouchableOpacity 
             style={styles.cameraCloseButton} 
             onPress={() => setShowLabelScanner(false)}
          >
             <X size={30} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
             style={styles.cameraCaptureButton} 
             onPress={handlePictureTaken}
             disabled={isAnalyzingLabel} // Disable button while analyzing
          >
             {/* Simple capture button appearance */}
             {isAnalyzingLabel && <ActivityIndicator color="#000" />} 
          </TouchableOpacity>
        </View>
      </CameraView>
    );
  }

  if (showingScanner) {
    return (
      <BarcodeScanner
        onScan={handleBarcodeScan}
        onClose={() => setShowingScanner(false)}
      />
    );
  }
  
  const handleSelectSharedFood = (food: Food) => {
    setAnalyzedFood(food);
    setShowSharedResults(false);
  };
  
  const renderFoodItem = ({ item }: { item: Food }) => {
    const isMatchingBarcode = scannedBarcodeForManualEntry && item.barcode === scannedBarcodeForManualEntry;
    const carbsLabel = item.macros.carbs === (item.macros as any).netCarbs 
      ? `${item.macros.carbs}g carbs` 
      : `${(item.macros as any).netCarbs || item.macros.carbs}g net carbs`;
    
    // Determine the source badge color and icon
    let sourceBadge = null;
    if (item.source === 'user') {
      sourceBadge = (
        <View style={styles.sourceBadge}>
          <Heart size={12} color="#fff" />
          <Text style={styles.sourceBadgeText}>Shared</Text>
        </View>
      );
    } else if (item.source === 'ai') {
      sourceBadge = (
        <View style={styles.sourceBadge}>
          <SearchIcon size={12} color="#fff" />
          <Text style={styles.sourceBadgeText}>AI</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[
          styles.foodItem,
          isMatchingBarcode ? styles.matchingBarcodeItem : null
        ]}
        onPress={() => handleSelectSharedFood(item)}
      >
        <View style={styles.foodItemContent}>
          <View style={styles.foodItemHeader}>
            {item.barcode && <Scan size={14} color="#666" style={styles.barcodeIcon} />}
            {isMatchingBarcode && <CheckCircle2 size={16} color="#22c55e" style={styles.matchIcon} />}
            
            <View style={styles.foodItemHeaderText}>
              <Text style={styles.foodName} numberOfLines={1}>
                {item.name}
              </Text>
              {sourceBadge}
            </View>
          </View>
          
          {item.brand && <Text style={styles.brandName}>{item.brand}</Text>}
          
          <View style={styles.itemMacroRow}>
            <Text style={[
              styles.macroValue, 
              item.ketoRating === 'Keto-Friendly' && styles.greatValue,
              item.ketoRating === 'Limit' && styles.limitValue,
              item.ketoRating === 'Strictly Limit' && styles.strictlyLimit,
              item.ketoRating === 'Avoid' && styles.avoidValue
            ]}>
              {carbsLabel}
            </Text>
            <Text style={styles.macroValue}>{item.macros.calories} cal</Text>
            <Text style={styles.macroValue}>{item.macros.protein}g protein</Text>
            <Text style={styles.macroValue}>{item.macros.fat}g fat</Text>
          </View>
          
          <Text style={styles.servingSize}>{item.servingSize}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Main screen content (conditionally dimmed if analyzing label)
  return (
    <SafeAreaView style={[styles.safeArea, isAnalyzingLabel && styles.dimmedBackground]}>
      {/* --- Add Favorites Button Top Right --- */}
      <TouchableOpacity 
        style={styles.headerFavoritesButton} 
        onPress={() => setShowFavoritesModal(true)}
      >
        <Heart size={24} color="#E91E63" />
      </TouchableOpacity>
      {/* --- End Add Favorites Button --- */}

      {/* Show loading indicator over the main screen */} 
      {isAnalyzingLabel && (
        <View style={styles.labelAnalysisLoadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.labelAnalysisLoadingText}>Analyzing Label...</Text>
        </View>
      )}
      
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Track Food</Text>
        <Text style={styles.subtitle}>Search, scan, or enter manually</Text>

        {/* Search Bar with Toggle */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <SearchIcon size={20} color="#888" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={searchMode === 'ai' ? "Search for a food..." : "Search community foods..."}
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <X size={18} color="#888" />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Scan Button */}
          <TouchableOpacity style={styles.scanButton} onPress={() => setShowingScanner(true)}>
            <Scan size={24} color="#4CAF50" />
          </TouchableOpacity>
          
          {/* Manual Entry Button */}
          <TouchableOpacity 
            style={styles.manualEntryButton} 
            onPress={handleOpenManualEntry} 
          >
            <PlusCircle size={28} color="#2196F3" />
          </TouchableOpacity>
        </View>
        
        {/* Search Mode Toggle */}
        <View style={styles.searchModeContainer}>
          <TouchableOpacity
            style={[styles.searchModeButton, searchMode === 'ai' ? styles.activeButton : styles.inactiveButton]}
            onPress={() => handleChangeSearchMode('ai')}
          >
            <Text style={[styles.buttonText, searchMode === 'ai' ? styles.activeButtonText : styles.inactiveButtonText]}>AI</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.searchModeButton, searchMode === 'community' ? styles.activeButton : styles.inactiveButton]}
            onPress={() => handleChangeSearchMode('community')}
          >
            <Text style={[styles.buttonText, searchMode === 'community' ? styles.activeButtonText : styles.inactiveButtonText]}>Shared</Text>
          </TouchableOpacity>
        </View>
        
        {/* Search Button */}
        <TouchableOpacity
          style={[styles.analyzeButtonFullWidth, (!searchQuery.trim() || isSearching || isLoadingSharedFoods) && styles.disabledButton]}
          onPress={handleSearch}
          disabled={!searchQuery.trim() || isSearching || isLoadingSharedFoods}
        >
          {isSearching || isLoadingSharedFoods ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.analyzeButtonText}>
              {searchMode === 'ai' ? 'Analyze Food' : 'Search Community Foods'}
            </Text>
          )}
        </TouchableOpacity>
        
        {/* Scan Loading Indicator */}
        {scanLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Analyzing Barcode...</Text>
          </View>
        )}

        {/* Analyzed Food Card */}
        {analyzedFood && !showManualEntryForm && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>Analysis Result</Text>
            <FoodCard 
              food={analyzedFood} 
              isFavorite={isCurrentFoodFavorite} 
              onToggleFavorite={handleToggleFavorite} 
            />
            
            {/* Serving Multiplier Input */}
            <View style={styles.servingInputContainer}>
              <Text style={styles.servingInputLabel}>Servings Consumed:</Text>
              <TextInput
                style={styles.servingInput}
                value={servingMultiplier}
                onChangeText={setServingMultiplier}
                keyboardType="numeric"
                selectTextOnFocus // Select all text on focus for easy replacement
              />
            </View>
            
            {renderMealTypeButtons()}
            <TouchableOpacity style={styles.addButton} onPress={handleAddToLog}>
              <Plus size={20} color="#FFF" />
              <Text style={styles.addButtonText}>Add to Log</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Manual Entry Form */}
        {showManualEntryForm && renderManualEntryForm()}

        {/* --- Render Favorites Modal --- */} 
        <FavoritesModal 
          visible={showFavoritesModal}
          onClose={() => setShowFavoritesModal(false)}
          favorites={favoriteFoods}
          onSelectFavorite={handleSelectFavorite}
          onRemoveFavorite={handleRemoveFavoriteFromModal}
        />
        {/* --- End Render Favorites Modal --- */}

        {/* Loading Indicators */}
        {isSearching && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3498db" />
            <Text style={styles.loadingText}>Searching using AI...</Text>
          </View>
        )}
        
        {isLoadingSharedFoods && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2ecc71" />
            <Text style={styles.loadingText}>Searching community foods...</Text>
          </View>
        )}
        
        {/* Shared Foods Results */}
        {showSharedResults && sharedFoods.length > 0 && (
          <View style={styles.sharedResultsContainer}>
            <Text style={styles.sectionTitle}>Community Foods</Text>
            {sharedFoods.map((food) => (
              <TouchableOpacity 
                key={food.id} 
                style={styles.sharedFoodItem}
                onPress={() => handleSelectSharedFood(food)}
              >
                <View style={styles.sharedFoodHeader}>
                  <Text style={styles.sharedFoodName}>{food.name}</Text>
                  <Text style={[
                    styles.ketoTag, 
                    food.ketoRating === 'Keto-Friendly' ? styles.ketoKetoFriendly : 
                    food.ketoRating === 'Limit' ? styles.ketoLimit :
                    food.ketoRating === 'Strictly Limit' ? styles.ketoStrictlyLimit :
                    styles.ketoAvoid
                  ]}>
                    {food.ketoRating}
                  </Text>
                </View>
                
                <Text style={styles.sharedFoodDetail}>
                  Serving: {food.servingSize}
                </Text>
                
                <View style={styles.itemMacroRow}>
                  <Text style={styles.macro}>Calories: {food.macros.calories}</Text>
                  <Text style={styles.macro}>Net Carbs: {food.macros.carbs}g</Text>
                  <Text style={styles.macro}>Protein: {food.macros.protein}g</Text>
                  <Text style={styles.macro}>Fat: {food.macros.fat}g</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        
        {showSharedResults && sharedFoods.length === 0 && !isLoadingSharedFoods && (
          <View style={styles.emptyResultsContainer}>
            <Text style={styles.emptyResultsText}>
              No matching foods found in the community.
            </Text>
            <TouchableOpacity 
              style={styles.switchToAIButton}
              onPress={() => {
                setSearchMode('ai');
                handleSearch();
              }}
            >
              <Text style={styles.switchToAIText}>Try AI Search Instead</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
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
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  searchInputContainer: {
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
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#333',
  },
  searchButton: {
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchModeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
    marginTop: 10,
  },
  searchModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    borderWidth: 1.5,
    flex: 1,
    marginHorizontal: 5,
  },
  activeButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  inactiveButton: {
    backgroundColor: 'transparent',
    borderColor: '#4CAF50',
  },
  buttonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    marginLeft: 8,
  },
  activeButtonText: {
    color: '#FFFFFF',
  },
  inactiveButtonText: {
    color: '#4CAF50',
  },
  resultContainer: {
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
  resultTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#333',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  servingInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 15,
    marginBottom: 15,
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  servingInputLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#555',
  },
  servingInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    minWidth: 60,
    textAlign: 'center',
    backgroundColor: '#fff',
  },
  addButton: {
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
  addButtonText: {
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
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: 30,
  },
  cameraCloseButton: {
    alignSelf: 'flex-start',
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 25,
  },
  cameraCaptureButton: {
    alignSelf: 'center',
    marginBottom: 20,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 3,
    borderColor: 'rgba(0,0,0,0.3)',
  },
  labelAnalysisLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  labelAnalysisLoadingText: {
    marginTop: 15,
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#fff',
  },
  dimmedBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0,
    zIndex: 5,
  },
  verificationHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#FFECB3',
  },
  verificationHintIcon: {
    marginRight: 8,
  },
  verificationHintText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#FFA000',
    lineHeight: 18,
  },
  mealTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: 15,
    marginBottom: 10,
  },
  mealTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginRight: 6,
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
  headerFavoritesButton: {
    position: 'absolute',
    top: 55,
    right: 16,
    padding: 10,
    zIndex: 10,
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  sharedResultsContainer: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sharedFoodItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2ecc71',
  },
  sharedFoodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sharedFoodName: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  ketoTag: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    overflow: 'hidden',
    fontWeight: 'bold',
  },
  ketoKetoFriendly: {
    backgroundColor: '#d5f5e3',
    color: '#27ae60',
  },
  ketoLimit: {
    backgroundColor: '#fef9e7',
    color: '#f39c12',
  },
  ketoStrictlyLimit: {
    backgroundColor: '#fdedec',
    color: '#e74c3c',
  },
  ketoAvoid: {
    backgroundColor: '#f5eef8',
    color: '#8e44ad',
  },
  sharedFoodDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  itemMacroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 4,
  },
  macro: {
    fontSize: 12,
    backgroundColor: '#eee',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
    marginBottom: 4,
  },
  emptyResultsContainer: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  emptyResultsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  switchToAIButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  switchToAIText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  searchIcon: {
    marginRight: 10,
  },
  clearButton: {
    padding: 10,
  },
  scanButton: {
    padding: 10,
  },
  manualEntryButton: {
    padding: 10,
  },
  analyzeButtonFullWidth: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
  analyzeButtonText: {
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
  foodItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  foodItemContent: {
    flex: 1,
  },
  foodItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  foodItemHeaderText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  barcodeIcon: {
    marginRight: 8,
  },
  matchIcon: {
    marginRight: 8,
  },
  foodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flexShrink: 1,
  },
  brandName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498db',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  sourceBadgeText: {
    fontSize: 11,
    color: '#fff',
    marginLeft: 3,
  },
  hideWhenAnalyzing: {
    display: 'none',
  },
  strictlyLimit: {
    color: '#e74c3c',
    fontWeight: '600',
  },
  matchingBarcodeItem: {
    borderColor: '#22c55e',
    borderWidth: 1.5,
    backgroundColor: '#f0fdf4',
  },
  macroValue: {
    fontSize: 14,
    color: '#555',
    marginRight: 12,
  },
  greatValue: {
    color: '#22c55e',
    fontWeight: '600',
  },
  goodValue: {
    color: '#84cc16',
    fontWeight: '600',
  },
  limitValue: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  avoidValue: {
    color: '#ef4444',
    fontWeight: '600',
  },
  servingSize: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  searchSection: {
    marginBottom: 16,
  },
  scanLine: {
    width: '100%',
    height: 2,
    backgroundColor: 'red',
  },
});