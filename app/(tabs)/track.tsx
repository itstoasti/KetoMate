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
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search as SearchIcon, Scan, X, CheckCircle2, Plus, Check, Info, Star, Heart, PlusCircle } from 'lucide-react-native';
import { useAppContext } from '../../context/AppContext';
import { Food, Macro, Meal } from '../../types';
import { getFoodDetailsFromAI, NotFoundMarker, getNutritionFromImageAI, mockFoodSearch, getKetoRating } from '../../services/foodService';
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
  
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    Keyboard.dismiss();
    setIsSearching(true);
    setAnalyzedFood(null);
    setScanLoading(false);
    resetManualForm(); // Reset form and flag at start

    try {
      const result = await getFoodDetailsFromAI(searchQuery.trim());
      handleApiResponse(result);
    } catch (error) {
      console.error("Error fetching food details:", error);
      Alert.alert("Error", "An error occurred while searching for the food.");
      setAnalyzedFood(null);
      setShowManualEntryForm(false); // Ensure form is hidden on error
    } finally {
      setIsSearching(false);
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
      // const initialQuery = `food item with barcode ${barcode}`; // OLD - Incorrect
      // Pass the raw barcode directly to the AI service
      const result = await getFoodDetailsFromAI(barcode);
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
    if (analyzedFood) {
      const mealName = analyzedFood.name;
      
      // --- Calculate Adjusted Macros --- 
      const multiplier = parseFloat(servingMultiplier);
      // Use 1 as default if parsing fails or value is not positive
      const validMultiplier = !isNaN(multiplier) && multiplier > 0 ? multiplier : 1;
      console.log(`[TrackScreen] Using serving multiplier: ${validMultiplier} (input: "${servingMultiplier}")`);
      
      const adjustedMacros: Macro = {
        carbs: (analyzedFood.macros.carbs || 0) * validMultiplier,
        protein: (analyzedFood.macros.protein || 0) * validMultiplier,
        fat: (analyzedFood.macros.fat || 0) * validMultiplier,
        calories: (analyzedFood.macros.calories || 0) * validMultiplier,
      };
      // --- End Calculation --- 
    
      const newMeal: Meal = {
        id: `meal_${Date.now()}`,
        name: mealName,
        // Keep the original food data for reference within the meal
        // The meal's top-level macros represent the adjusted total consumed
        foods: [analyzedFood],
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        type: selectedMealType,
        macros: adjustedMacros // Use the adjusted macros for the meal log
      };
    
      console.log(`Adding meal (${selectedMealType}) with adjusted macros:`, newMeal);
      addMeal(newMeal);
    
      Alert.alert("Meal Added", `${analyzedFood.name} added as ${selectedMealType}.`);
      setAnalyzedFood(null); // Clear analyzed food after adding
      setServingMultiplier('1'); // Reset multiplier after adding
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
      name: manualName.trim(),
      brand: 'Manual Entry',
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
    // setManualName(''); <-- redundant
    // ... reset other manual fields ... <-- redundant
    // setScannedBarcodeForManualEntry(null); <-- redundant
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
          const nutritionResult = await getNutritionFromImageAI(photoBase64);

          if (nutritionResult.error) {
              throw new Error(`Analysis Service Error: ${nutritionResult.error}`);
          }

          console.log('[TrackScreen] AI Analysis Result:', nutritionResult);
          
          // Log carb breakdown
          console.log(`[TrackScreen] Carb breakdown: Total=${nutritionResult.totalCarbs}, Fiber=${nutritionResult.fiber}, SugarAlc=${nutritionResult.sugarAlcohols}, Net=${nutritionResult.netCarbs}`);

          // 3. Populate manual entry fields
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
          // --- End set flag ---

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

        {/* --- Search Row (Input, Scan, Manual) --- */}
        <View style={styles.searchRowContainer}>
          {/* Search Input Area */}
          <View style={styles.inputContainer}>
            <SearchIcon size={20} color="#888" style={styles.searchIcon} />
            <TextInput
              style={styles.input}
              placeholder="Search for a food..."
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
        {/* --- End Search Row --- */}

        {/* --- Analyze Button Row --- */}
        <TouchableOpacity
          style={[styles.analyzeButtonFullWidth, (!searchQuery.trim() || isSearching) && styles.disabledButton]}
          onPress={handleSearch}
          disabled={!searchQuery.trim() || isSearching}
        >
          {isSearching ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.analyzeButtonText}>Analyze Food</Text>
          )}
        </TouchableOpacity>
        {/* --- End Analyze Button Row --- */}

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
  searchRowContainer: { 
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15, // Add margin below search row
  },
  inputContainer: {
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
  input: {
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
  analyzeButtonFullWidth: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20, // Margin below analyze button
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
    marginTop: 15, // Space above the input
    marginBottom: 15, // Space below the input
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#f9f9f9', // Slight background highlight
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
    minWidth: 60, // Ensure it has some width
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
  },
  // Verification Hint Styles
  verificationHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1', // Light yellow background
    padding: 10,
    borderRadius: 8,
    marginBottom: 15, // Add margin below the hint
    borderWidth: 1,
    borderColor: '#FFECB3', // Lighter yellow border
  },
  verificationHintIcon: {
    marginRight: 8,
  },
  verificationHintText: {
    flex: 1, // Allow text to wrap
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#FFA000', // Darker yellow text
    lineHeight: 18,
  },
  // Meal Type Button Styles (Reinstated)
  mealTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap', // Allow buttons to wrap
    justifyContent: 'space-around', // Distribute space
    marginTop: 15, // Add margin above buttons
    marginBottom: 10, // Add margin below buttons
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
  // ADD Style for Header Favorites Button (Absolute Positioning)
  headerFavoritesButton: {
    position: 'absolute',
    top: 55, // Lowered the button
    right: 16, // Adjust based on SafeAreaView padding/margins
    padding: 10,
    zIndex: 10, // Ensure it's above other scroll content
    backgroundColor: '#FFF0F0', // Keep background for visibility
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  manualEntryButton: {
    padding: 12, // Keep padding for touch area
    marginLeft: 10, // Space between Scan and Manual Entry buttons
  },
});