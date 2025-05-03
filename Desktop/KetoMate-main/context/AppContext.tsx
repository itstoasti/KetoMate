import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { Food, Meal, DailyMacros, UserProfile, AIConversation, Macro, WeightEntry } from '@/types';
import { format, isSameDay, parseISO, compareDesc } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabaseClient'; // Import Supabase client
import { Session, User, PostgrestError } from '@supabase/supabase-js'; // Import Session type and PostgrestError
import { Alert } from 'react-native'; // Import Alert

interface AppContextProps {
  foods: Food[];
  meals: Meal[];
  todayMacros: DailyMacros;
  userProfile: UserProfile | null;
  conversations: AIConversation[];
  weightHistory: WeightEntry[];
  isLoading: boolean;
  currentConversation: AIConversation | null;
  session: Session | null;
  user: User | null;
  addFood: (food: Food) => void;
  addMeal: (meal: Meal) => Promise<void>;
  removeMeal: (mealId: string) => Promise<void>;
  addWeightEntry: (entryData: Omit<WeightEntry, 'id' | 'date'>) => Promise<void>;
  updateUserProfile: (profileData: Partial<UserProfile>) => Promise<void>;
  addMessageToConversation: (conversationId: string, message: { role: 'user' | 'assistant'; content: string }) => void;
  createNewConversation: (title: string) => string;
  setCurrentConversation: (conversation: AIConversation | null) => void;
  checkIfFoodIsKetoFriendly: (macros: { carbs: number; fat: number; protein: number }) => boolean;
  clearData: () => Promise<void>;
  editWeightEntry: (entryId: string, updatedWeightKg: number) => Promise<void>;
  deleteWeightEntry: (entryId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const DEFAULT_USER_PROFILE: Omit<UserProfile, 'id'> = {
  name: 'User',
  weight: 70,
  height: 170,
  weightUnit: 'kg',
  heightUnit: 'cm',
  goal: 'weight_loss',
  activityLevel: 'moderate',
  dailyMacroLimit: {
    carbs: 20,
    protein: 120,
    fat: 150,
    calories: 1800
  },
  dailyCalorieLimit: 1800
};

const DEFAULT_DAILY_MACROS: DailyMacros = {
  date: format(new Date(), 'yyyy-MM-dd'),
  total: { carbs: 0, protein: 0, fat: 0, calories: 0 },
  limit: { carbs: 20, protein: 120, fat: 150, calories: 1800 },
  remaining: { carbs: 20, protein: 120, fat: 150, calories: 1800 },
  meals: []
};

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  console.log("\n\n\n--- RUNNING NEW AppContext-DB PROVIDER CODE (SUPABASE) ---\n\n\n");
  const [foods, setFoods] = useState<Food[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [todayMacros, setTodayMacros] = useState<DailyMacros>(DEFAULT_DAILY_MACROS);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [currentConversationState, setCurrentConversationState] = useState<AIConversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [justLoaded, setJustLoaded] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    console.log("[AppContext Auth Effect] Running..."); // Log effect execution

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log(`[AppContext] Auth State Change Event: ${_event} ${session ? 'Session Active' : 'No Session'}`);
      setSession(session);
      setUser(session?.user ?? null);

      // Clear data immediately on sign out before attempting load
      if (_event === 'SIGNED_OUT') {
        console.log("[AppContext] SIGNED_OUT detected. Resetting state.");
        resetStateToDefaults(); // Reset state immediately
        setIsLoading(false); // Set loading false after reset
        setIsSigningOut(false); // Reset the signing out flag
      } else if (session?.user) {
         // Only load data if we have a user ID and are not signing out
        if (!isSigningOut) {
            await loadData(session.user.id);
        } else {
            console.log("[AppContext] Skipping data load because isSigningOut is true.");
        }
      } else {
        // No session, ensure state is reset and loading is false
        console.log("[AppContext] No session detected on auth change. Resetting state.");
        resetStateToDefaults();
        setIsLoading(false);
      }
    });

    // Set initial loading state
    // setIsLoading(true); // Moved initial setIsLoading(true) to useState initializer

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
        console.log(`[AppContext] Initial session: ${session ? 'Found' : 'Not Found'}`);
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Initial load only if user exists and not already loading
          if(!isLoading) { // Check isLoading flag
            loadData(session.user.id);
          }
        } else {
           setIsLoading(false); // No user on initial check, finish loading
        }
    }).catch(error => {
        console.error("[AppContext] Error getting initial session:", error);
        setIsLoading(false); // Error, finish loading
    });

    return () => {
      console.log("[AppContext] Cleaning up auth listener.");
      authListener?.subscription.unsubscribe();
    };
    // Ensure isSigningOut is included if it influences logic inside
  }, [isSigningOut]); // Add isSigningOut if needed by logic inside

  const resetStateToDefaults = () => {
      setUserProfile(null);
      setMeals([]);
      setWeightHistory([]);
      setTodayMacros(DEFAULT_DAILY_MACROS);
      setConversations([]);
      setCurrentConversationState(null);
      setIsLoading(false); 
  };

  const loadData = async (userId: string | undefined) => {
    if (!userId) {
      console.log("[AppContext] loadData called without userId. Resetting state.");
      resetStateToDefaults();
      setIsLoading(false);
      return;
    }
    
    console.log(`[AppContext] Loading data for user: ${userId}...`);
    setIsLoading(true); 
    let loadedProfile: UserProfile | null = null;
    try {
      await new Promise(resolve => setTimeout(resolve, 100)); 
      console.log(`[AppContext] Proceeding with load after short delay for user: ${userId}`);

      const [profileResult, mealsResult, weightResult] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('user_id', userId).single(),
        supabase.from('meals').select('*').eq('user_id', userId),
        supabase.from('weight_history')
            .select('id, user_id, entry_date, weight_kg')
            .eq('user_id', userId)
            .order('entry_date', { ascending: false })
      ]);

      // --- Initialize Local State ---
      setFoods([]); // Not currently persisted
      setMeals([]); // Will be set below
      setConversations([]); // Not currently persisted
      setWeightHistory([]); // Will be set below
      setTodayMacros(DEFAULT_DAILY_MACROS); // Will be recalculated below
      setUserProfile(null); // Will be set below
      let appMeals: Meal[] = []; // Temporary variable to hold fetched meals

      // --- Process Fetched Data ---
      try {
        // Map meal_type from DB to type for the app state
        const dbMeals = mealsResult.data || [];
        appMeals = dbMeals.map((dbMeal: any) => ({
            ...dbMeal,
            type: dbMeal.meal_type // Map meal_type to type
        })) as Meal[];
        // Log fetched meals
        console.log(`[AppContext] loadData - Fetched Meals Count: ${appMeals.length}`);
        console.log("[AppContext] loadData - Fetched Meals (sample):", JSON.stringify(appMeals.slice(0, 2), null, 2)); 
        setMeals(appMeals); // Set meals state with fetched & mapped data
      } catch (e) { console.error(`[AppContext] Error parsing meals for ${userId}:`, e); }
      
      let appWeightHistory: WeightEntry[] = []; // Temporary variable
      try {
        if (weightResult.data) {
          // Map DB columns (snake_case) to app state (camelCase)
          appWeightHistory = weightResult.data.map((dbEntry: any) => ({
              id: dbEntry.id,
              user_id: dbEntry.user_id,
              date: dbEntry.entry_date, // Map entry_date to date
              weight: dbEntry.weight_kg, // Map weight_kg to weight
              unit: loadedProfile?.weightUnit || 'kg' // Assign unit based on profile (use loadedProfile here)
          })) as WeightEntry[];
          
          // Log fetched weight history
          console.log(`[AppContext] loadData - Fetched Weight History Count: ${appWeightHistory.length}`);
          console.log("[AppContext] loadData - Fetched Weight History (sample):", JSON.stringify(appWeightHistory.slice(0, 2), null, 2)); 
          
          // Sort by date (already mapped to 'date')
          setWeightHistory(appWeightHistory.sort((a, b) => compareDesc(new Date(a.date), new Date(b.date))));
          console.log(`[AppContext] Successfully parsed and loaded weight history for ${userId}`);
        }
      } catch (e) { console.error(`[AppContext] Error parsing weight history for ${userId}:`, e); }
      
      try {
        if (profileResult.data) {
          // Map snake_case from DB to camelCase for app state
          const dbProfile = profileResult.data as any;
          const appProfile: UserProfile = {
            ...dbProfile,
            activityLevel: dbProfile.activity_level, // Map activity_level to activityLevel
            dailyMacroLimit: dbProfile.daily_macro_limit, // Map daily_macro_limit to dailyMacroLimit
            dailyCalorieLimit: dbProfile.daily_calories_limit, // Map daily_calories_limit to dailyCalorieLimit
            heightUnit: dbProfile.height_unit, // Map height_unit to heightUnit
            weightUnit: dbProfile.weight_unit, // Map weight_unit to weightUnit
          };
          // Optionally delete the snake_case keys if desired
          // delete appProfile.activity_level;
          // delete appProfile.daily_macro_limit;
          // delete appProfile.daily_calories_limit;
          // delete appProfile.height_unit;
          // delete appProfile.weight_unit;
          
          loadedProfile = appProfile;
          setUserProfile(loadedProfile); // Set profile state with mapped data
          console.log(`[AppContext] Successfully parsed and loaded profile for ${userId}`);
        } else {
          console.log(`[AppContext] No profile found for user ${userId}. Attempting minimal profile creation.`);
          const minimalProfileData = { user_id: userId };
          const { data: minimalInsertData, error: minimalInsertError } = await supabase
              .from('user_profiles')
              .insert(minimalProfileData)
              .select()
              .single();

          if (minimalInsertError) {
              console.error('[AppContext] Error creating MINIMAL profile:', JSON.stringify(minimalInsertError, null, 2));
              Alert.alert("Error", "Could not initialize your user profile (minimal insert failed).");
              // Maybe set isLoading false here? Or handle error differently
              setIsLoading(false); 
              return;
          } else if (minimalInsertData) {
             console.log('[AppContext] Minimal profile created successfully. Now attempting to update with full defaults.');
             // Set the minimally created profile first (no mapping needed here as it just has user_id)
             loadedProfile = minimalInsertData as UserProfile; 
          setUserProfile(loadedProfile);

             // Prepare the default update payload with snake_case keys
             const defaultProfileUpdate = {
                 name: DEFAULT_USER_PROFILE.name,
                 weight: DEFAULT_USER_PROFILE.weight,
                 height: DEFAULT_USER_PROFILE.height,
                 weight_unit: DEFAULT_USER_PROFILE.weightUnit,
                 height_unit: DEFAULT_USER_PROFILE.heightUnit,
                 goal: DEFAULT_USER_PROFILE.goal,
                 activity_level: DEFAULT_USER_PROFILE.activityLevel,
                 daily_macro_limit: DEFAULT_USER_PROFILE.dailyMacroLimit,
                 daily_calories_limit: DEFAULT_USER_PROFILE.dailyCalorieLimit
             };
             // Note: DEFAULT_USER_PROFILE uses camelCase, so we map here for the DB update

             const { data: updatedProfileData, error: updateError } = await supabase
                .from('user_profiles')
                .update(defaultProfileUpdate)
                .eq('user_id', userId)
                .select()
                .single();

             if (updateError) {
                 console.error('[AppContext] Error updating profile with defaults after minimal insert:', JSON.stringify(updateError, null, 2));
                 Alert.alert("Warning", "Could not fully set default profile values. Some defaults might be missing.");
                 // Keep loadedProfile as the minimal one in case of update error
             } else if (updatedProfileData) {
                 console.log('[AppContext] Profile successfully updated with full defaults.');
                 // Map the fully updated profile back from snake_case (DB) to camelCase (App)
                 const dbUpdatedProfile = updatedProfileData as any;
                 const appUpdatedProfile: UserProfile = {
                     ...dbUpdatedProfile,
                     activityLevel: dbUpdatedProfile.activity_level,
                     dailyMacroLimit: dbUpdatedProfile.daily_macro_limit,
                     dailyCalorieLimit: dbUpdatedProfile.daily_calories_limit,
                     heightUnit: dbUpdatedProfile.height_unit, // Map height_unit
                     weightUnit: dbUpdatedProfile.weight_unit, // Map weight_unit
                 };
                 loadedProfile = appUpdatedProfile; // Update loadedProfile with full mapped data
                 setUserProfile(loadedProfile); // Update state again with full mapped data
            } else {
                 console.warn('[AppContext] Profile update seemed successful but no data returned.');
                 // Keep loadedProfile as the minimal one
             }
          }
        }
      } catch (e) {
          console.error(`[AppContext] Error during profile loading/creation for ${userId}:`, e);
          Alert.alert("Profile Error", "An error occurred while setting up your profile.");
          // Consider setting isLoading false here too
           setIsLoading(false);
           return;
      }

      // --- Calculate Macros *AFTER* setting meals and profile ---
      const finalTodayMacros = calculateMacrosForDay(appMeals, format(new Date(), 'yyyy-MM-dd'), loadedProfile);
      setTodayMacros(finalTodayMacros); // Set the final calculated macros

      // Log the final calculated todayMacros state RIGHT BEFORE setting loading to false
      console.log('[AppContext] Final todayMacros state set AFTER calculation:', JSON.stringify(finalTodayMacros, null, 2));

      setIsLoading(false);
      console.log(`[AppContext] Data loading finished for user ${userId}.`);
      // console.log("[AppContext] Initialization complete. Setting loading false."); // Redundant log
      setJustLoaded(true);
    } catch (error) {
      console.error(`[AppContext] General error loading data for user ${userId}:`, error);
      setJustLoaded(false);
      setIsLoading(false); // Ensure loading is false on general error
    }
  };

  const calculateRemainingMacros = useCallback((total: Macro, limit: Macro): Macro => {
    return {
      carbs: Math.max(0, limit.carbs - total.carbs),
      protein: Math.max(0, limit.protein - total.protein),
      fat: Math.max(0, limit.fat - total.fat),
      calories: Math.max(0, limit.calories - total.calories)
    };
  }, []);

  const addFood = useCallback((food: Food) => {
    setFoods(prev => [...prev, food]);
  }, []);

  const addMeal = useCallback(async (meal: Meal) => {
    if (!user?.id) {
      console.error("[AppContext] Cannot add meal: No user logged in.");
      Alert.alert("Error", "You must be logged in to add a meal.");
      return;
    }
    
    // Prepare data for Supabase, mapping app property 'type' to DB column 'meal_type'
    const { type, ...restOfMeal } = meal; // Separate 'type' from the rest
    const mealToSave = { 
      ...restOfMeal,     // Include all other properties from the meal object
      user_id: user.id, 
      meal_type: type    // Map the app's 'type' to the DB's 'meal_type' column
    }; 
    
    console.log("[AppContext] Attempting to save meal to Supabase...");
    // Log the object being sent to Supabase for debugging
    console.log("[AppContext] Saving meal data:", JSON.stringify(mealToSave, null, 2));
    
    const { data, error } = await supabase
      .from('meals')
      .insert(mealToSave)
      .select()
      .single();

    if (error) {
      console.error("[AppContext] Error saving meal:", error.message);
      Alert.alert("Error", `Could not save meal: ${error.message}`);
    } else if (data) {
      console.log("[AppContext] Meal saved successfully to Supabase:", data.id);
      
      // Map the returned DB data (with meal_type) to the app's Meal type (with type)
      const savedDbMeal = data as any; // Cast to any to access meal_type
      const newAppMeal: Meal = {
          ...savedDbMeal,
          type: savedDbMeal.meal_type // Map meal_type back to type
      };
      // Remove meal_type if you don't want it lingering in the app state
      delete (newAppMeal as any).meal_type;

      // Update state with the correctly mapped object
      const updatedMeals = [...meals, newAppMeal];
      setMeals(updatedMeals);
      
      // Recalculate macros if it was for today
      if (isSameDay(parseISO(newAppMeal.date), new Date())) {
          const newTodayMacros = calculateMacrosForDay(updatedMeals, format(new Date(), 'yyyy-MM-dd'), userProfile);
          setTodayMacros(newTodayMacros);
      }
    }
  }, [user?.id, meals, userProfile, calculateMacrosForDay]);

  const removeMeal = useCallback(async (mealId: string) => {
    if (!user?.id) {
      console.error("[AppContext] Cannot remove meal: No user logged in.");
      Alert.alert("Error", "Authentication error.");
      return;
    }
    console.log(`[AppContext] Attempting to delete meal ${mealId} from Supabase...`);
    const { error } = await supabase
      .from('meals')
      .delete()
      .eq('id', mealId)
      .eq('user_id', user.id);

    if (error) {
      console.error("[AppContext] Error deleting meal:", error.message);
      Alert.alert("Error", `Could not remove meal: ${error.message}`);
    } else {
      console.log(`[AppContext] Meal ${mealId} deleted successfully from Supabase.`);
      const updatedMeals = meals.filter(meal => meal.id !== mealId);
      setMeals(updatedMeals);
      const removedMeal = meals.find(m => m.id === mealId);
      if (removedMeal && isSameDay(parseISO(removedMeal.date), new Date())) {
          const newTodayMacros = calculateMacrosForDay(updatedMeals, format(new Date(), 'yyyy-MM-dd'), userProfile);
          setTodayMacros(newTodayMacros);
      }
    }
  }, [user?.id, meals, userProfile, calculateMacrosForDay]);

  const addWeightEntry = useCallback(async (entryData: Omit<WeightEntry, 'id' | 'date'>) => {
    if (!user?.id) {
      console.error("[AppContext] Cannot add weight entry: No user logged in.");
      Alert.alert("Error", "You must be logged in to add a weight entry.");
      return;
    }

    // Convert weight to kg if necessary and prepare DB payload
    let weightInKg = entryData.weight;
    if (entryData.unit === 'lb') {
        weightInKg = entryData.weight * 0.453592; // Convert lbs to kg
    }

    const newEntryPayload = {
      user_id: user.id,
      entry_date: new Date().toISOString(), // Map app 'date' to DB 'entry_date'
      weight_kg: weightInKg // Send the weight in kg
      // Do not send 'unit' or 'weight_unit' as the DB column doesn't exist
    };
    
    // Log the payload being sent
    console.log("[AppContext] Attempting to save weight entry payload:", JSON.stringify(newEntryPayload, null, 2)); 
    
    const { data, error } = await supabase
        .from('weight_history') // Correct table name
        .insert(newEntryPayload) // Use correctly mapped payload
        .select('id, user_id, entry_date, weight_kg') // Select specific columns
        .single();

    if (error) {
        // Log the full error object, not just message
        console.error("[AppContext] Error saving weight entry:", JSON.stringify(error, null, 2)); 
        // Display a generic message or use error.message if it exists, otherwise provide a fallback
        const errorMessage = error?.message || "An unknown error occurred."; 
        Alert.alert("Error", `Could not save weight entry: ${errorMessage}`);
    } else if (data) {
        console.log("[AppContext] Weight entry saved successfully:", data.id);
        // Map the returned DB data back to the app state format
        const savedDbEntry = data as any;
        const savedAppEntry: WeightEntry = {
            id: savedDbEntry.id,
            user_id: savedDbEntry.user_id,
            date: savedDbEntry.entry_date, // Map entry_date back to date
            weight: savedDbEntry.weight_kg, // Map weight_kg back to weight
            unit: userProfile?.weightUnit || 'kg' // Assign unit based on profile
        };

        const updatedHistory = [savedAppEntry, ...weightHistory]
            .sort((a, b) => compareDesc(new Date(a.date), new Date(b.date)));
        setWeightHistory(updatedHistory);

        // Update profile weight if this is the newest entry
    setUserProfile(prevProfile => {
        if (!prevProfile) return null;
            // Update profile state ONLY if the new KG value is different
            // The context state should always store weight in KG.
            if (prevProfile.weight !== savedAppEntry.weight) { 
                return { ...prevProfile, weight: savedAppEntry.weight }; // Store KG value
            }
            return prevProfile; 
        });
        // Note: Removed the separate call to updateUserProfile here to avoid potential loops
        //       and because we don't need to save the weight *back* to the profile table usually.
        //       If profile weight update IS desired, call updateUserProfile({ weight: currentWeightInProfileUnits });
    }
  }, [user?.id, weightHistory, userProfile, calculateRemainingMacros]); // Removed updateUserProfile from deps

  const updateUserProfile = useCallback(async (profileData: Partial<UserProfile>) => {
    if (!user?.id) {
      console.error("[AppContext] Cannot update profile: No user logged in.");
      Alert.alert("Error", "Authentication error.");
      return;
    }

    // --- Build Payload Explicitly ---
    // Start with an empty object
    const supabasePayload: Record<string, any> = {};

    // Map known fields from app state (profileData) to DB column names (snake_case)
    // Only include fields that are present in profileData (not undefined)
    
    // Fields with matching names
    if (profileData.name !== undefined) supabasePayload.name = profileData.name;
    if (profileData.weight !== undefined) supabasePayload.weight = profileData.weight;
    if (profileData.height !== undefined) supabasePayload.height = profileData.height;
    if (profileData.goal !== undefined) supabasePayload.goal = profileData.goal;

    // Fields needing case conversion
    if (profileData.activityLevel !== undefined) supabasePayload.activity_level = profileData.activityLevel;
    if (profileData.heightUnit !== undefined) supabasePayload.height_unit = profileData.heightUnit;
    if (profileData.weightUnit !== undefined) supabasePayload.weight_unit = profileData.weightUnit;
    if (profileData.dailyMacroLimit !== undefined) supabasePayload.daily_macro_limit = profileData.dailyMacroLimit;
    if (profileData.dailyCalorieLimit !== undefined) supabasePayload.daily_calories_limit = profileData.dailyCalorieLimit;

    // Exclude id and user_id explicitly (though they shouldn't be in profileData usually)
    delete supabasePayload.id;
    delete supabasePayload.user_id;
    // --- End Build Payload ---

    // Check if there's anything left to update
    if (Object.keys(supabasePayload).length === 0) {
        console.warn("[AppContext] updateUserProfile called with no valid data to update.");
        return;
    } 
    
    console.log("[AppContext] Attempting to update profile in Supabase with explicit payload:", supabasePayload);
    const { data, error } = await supabase
      .from('user_profiles')
      .update(supabasePayload) // Sending explicitly built payload
      .eq('user_id', user.id) 
      .select() 
      .single();

    if (error) {
      console.error("[AppContext] Error updating profile:", JSON.stringify(error, null, 2));
      Alert.alert("Error", `Could not update profile: ${error.message}`);
    } else if (data) {
        console.log("[AppContext] Profile updated successfully in Supabase.");
        // Map the returned snake_case data to camelCase for the app state
        const dbProfile = data as any;
        const appProfile: UserProfile = {
            ...dbProfile,
            activityLevel: dbProfile.activity_level,
            dailyMacroLimit: dbProfile.daily_macro_limit,
            dailyCalorieLimit: dbProfile.daily_calories_limit,
            heightUnit: dbProfile.height_unit,
            weightUnit: dbProfile.weight_unit
            // other fields like name, weight, height, goal are assumed to match
        };
        
        // Update local state with the *mapped* camelCase data
        setUserProfile(appProfile); 

        // Recalculate today's macros using the *mapped* camelCase data
        setTodayMacros(prev => ({
        ...prev,
            limit: appProfile.dailyMacroLimit, // Use mapped appProfile
            remaining: calculateRemainingMacros(prev.total, appProfile.dailyMacroLimit) // Use mapped appProfile
        }));
    }
  }, [user?.id, calculateRemainingMacros]);

  const addMessageToConversation = useCallback((conversationId: string, message: { role: 'user' | 'assistant'; content: string }) => {
    console.warn("[AppContext] addMessageToConversation called, but 'conversations' are not currently persisted to Supabase.");
    const newMessage = { id: Date.now().toString(), content: message.content, role: message.role, timestamp: new Date().toISOString() };
    setConversations(prevConversations => {
      const index = prevConversations.findIndex(conv => conv.id === conversationId);
      if (index === -1) return prevConversations;
      const newConversations = [...prevConversations];
      const updatedConv = { ...newConversations[index], messages: [...newConversations[index].messages, newMessage], updatedAt: new Date().toISOString() };
      newConversations[index] = updatedConv;
      return newConversations;
    });
  }, []);

  const createNewConversation = useCallback((title: string) => {
    console.warn("[AppContext] createNewConversation called, but 'conversations' are not currently persisted to Supabase.");
    const newConversation: AIConversation = { id: Date.now().toString(), title, messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setConversations(prev => [...prev, newConversation]);
    setCurrentConversationState(newConversation);
    return newConversation.id;
  }, []);

  const setCurrentConversation = useCallback((conversation: AIConversation | null) => {
    console.warn("[AppContext] setCurrentConversation called, but 'conversations' are not currently persisted to Supabase.");
    setCurrentConversationState(conversation);
  }, []);

  const checkIfFoodIsKetoFriendly = (macros: { carbs: number; fat: number; protein: number }) => {
    return macros.carbs >= 0 && macros.carbs <= 7;
  };

  const clearData = useCallback(async () => {
    if (!user?.id) {
      Alert.alert("Error", "No user logged in to clear data for.");
      return;
    }
    console.log(`[AppContext] Clearing data for user: ${user.id} from Supabase...`);

    Alert.alert(
      "Confirm Clear Data",
      "Are you sure you want to delete all your meals and weight history? Your profile will be reset to defaults. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Data",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              const [mealDeleteResult, weightDeleteResult] = await Promise.all([
                  supabase.from('meals').delete().eq('user_id', user.id),
                  supabase.from('weight_history').delete().eq('user_id', user.id)
              ]);

              let errorOccurred = false;
              if (mealDeleteResult.error) {
                  console.error("[AppContext] Error clearing meals:", mealDeleteResult.error.message);
                  errorOccurred = true;
              }
               if (weightDeleteResult.error) {
                  console.error("[AppContext] Error clearing weight history:", weightDeleteResult.error.message);
                   errorOccurred = true;
              }

              if (errorOccurred) {
                  throw new Error("Failed to delete all user data.");
              }

              console.log("[AppContext] Resetting profile to default in Supabase...");
              const defaultProfileData = { ...DEFAULT_USER_PROFILE, user_id: user.id };
              const { data: updatedProfile, error: profileUpdateError } = await supabase
                .from('user_profiles')
                .upsert(defaultProfileData)
                .select()
                .single();

              if (profileUpdateError) {
                console.error("[AppContext] Error resetting profile:", profileUpdateError.message);
                 throw new Error("Failed to reset user profile.");
              }

              console.log(`[AppContext] Data cleared and profile reset successfully for user ${user.id}. Reloading state...`);
              
              await loadData(user.id); 

            } catch (error: any) {
              console.error(`[AppContext] Error clearing data for user ${user.id}:`, error.message || error);
              Alert.alert("Error", `Could not clear all data: ${error.message}`);
            } finally {
                 setIsLoading(false);
            }
          },
        },
      ]
    );
  }, [user?.id]);

  const editWeightEntry = useCallback(async (entryId: string, updatedWeightKg: number) => {
    if (!user?.id) {
      console.error("[AppContext] Cannot edit weight entry: No user logged in.");
      Alert.alert("Error", "Authentication error.");
      return;
    }
    
    const updatePayload = { 
        weight: updatedWeightKg, 
        date: new Date().toISOString()
    };

    console.log(`[AppContext] Attempting to update weight entry ${entryId} in Supabase...`);
    const { data, error } = await supabase
        .from('weight_history')
        .update(updatePayload)
        .eq('id', entryId)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) {
        console.error("[AppContext] Error updating weight entry:", error.message);
        Alert.alert("Error", `Could not update weight entry: ${error.message}`);
    } else if (data) {
        console.log(`[AppContext] Weight entry ${entryId} updated successfully.`);
        const updatedEntry = data as WeightEntry;
    const updatedHistory = weightHistory.map(entry => 
            entry.id === entryId ? updatedEntry : entry
    );
    updatedHistory.sort((a, b) => compareDesc(new Date(a.date), new Date(b.date)));
    setWeightHistory(updatedHistory);

    setUserProfile(prevProfile => {
      if (!prevProfile) return null;
            if (updatedHistory.length > 0 && updatedHistory[0].id === entryId && userProfile) {
                 if (userProfile.weight !== updatedEntry.weight) {
                     updateUserProfile({ weight: updatedEntry.weight });
                 }
      }
      return prevProfile;
    });
    }
 }, [user?.id, weightHistory, userProfile, updateUserProfile]);

  const deleteWeightEntry = useCallback(async (entryId: string) => {
    if (!user?.id) {
      console.error("[AppContext] Cannot delete weight entry: No user logged in.");
      Alert.alert("Error", "Authentication error.");
      return;
    }
     console.log(`[AppContext] Attempting to delete weight entry ${entryId} from Supabase...`);
    
    const entryToDelete = weightHistory.find(entry => entry.id === entryId);

    const { error } = await supabase
        .from('weight_history')
        .delete()
        .eq('id', entryId)
        .eq('user_id', user.id);

    if (error) {
        console.error("[AppContext] Error deleting weight entry:", error.message);
        Alert.alert("Error", `Could not delete weight entry: ${error.message}`);
    } else {
        console.log(`[AppContext] Weight entry ${entryId} deleted successfully.`);
        const updatedHistory = weightHistory.filter(entry => entry.id !== entryId);
        setWeightHistory(updatedHistory);

        if (userProfile && entryToDelete && userProfile.weight === entryToDelete.weight) {
            const newLatestWeight = updatedHistory.length > 0 ? updatedHistory[0].weight : DEFAULT_USER_PROFILE.weight;
            if (userProfile.weight !== newLatestWeight) {
                 updateUserProfile({ weight: newLatestWeight });
            }
        }
    }
  }, [user?.id, weightHistory, userProfile, updateUserProfile]);

  const calculateMacrosForDay = useCallback((allMeals: Meal[], date: string, profile: UserProfile | null): DailyMacros => {
    console.log(`[calculateMacrosForDay] Calculating for date: ${date}. Received ${allMeals.length} total meals.`);
    const targetDate = parseISO(date); // Parse target date once
    const todaysMeals = allMeals.filter(meal => {
        if (!meal.date) return false;
        try {
            const mealDate = parseISO(meal.date);
            const sameDay = isSameDay(mealDate, targetDate);
            // console.log(`[calculateMacrosForDay] Comparing meal ${meal.id} (${meal.date}) to ${date}: ${sameDay}`); // Verbose log if needed
            return sameDay;
        } catch (e) {
            console.warn(`[calculateMacrosForDay] Error parsing meal date: ${meal.date}`, e);
            return false;
        }
    });
    console.log(`[calculateMacrosForDay] Found ${todaysMeals.length} meals for ${date}:`, todaysMeals.map(m => m.id));
    
    const total: Macro = todaysMeals.reduce((acc, meal) => ({
      carbs: acc.carbs + (meal.macros?.carbs ?? 0),
      protein: acc.protein + (meal.macros?.protein ?? 0),
      fat: acc.fat + (meal.macros?.fat ?? 0),
      calories: acc.calories + (meal.macros?.calories ?? 0),
    }), { carbs: 0, protein: 0, fat: 0, calories: 0 });

    const limit = profile?.dailyMacroLimit ?? DEFAULT_DAILY_MACROS.limit;
    const remaining = calculateRemainingMacros(total, limit);

    return {
      date,
      total,
      limit,
      remaining,
      meals: todaysMeals
    };
  }, []);

  const signOut = async () => {
    console.log("[AppContext] Initiating sign out...");
    setIsSigningOut(true);

    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out from Supabase:", error);
      Alert.alert("Sign Out Error", error.message);
      setIsSigningOut(false);
    } else {
      console.log("[AppContext] Supabase sign out successful. State reset will be handled by auth listener.");
    }
  };

  const contextValue = useMemo(() => ({
    foods,
    meals,
    todayMacros,
    userProfile,
    conversations,
    weightHistory,
    isLoading,
    currentConversation: currentConversationState,
    session,
    user,
    addFood,
    addMeal,
    removeMeal,
    addWeightEntry,
    updateUserProfile,
    addMessageToConversation,
    createNewConversation,
    setCurrentConversation,
    checkIfFoodIsKetoFriendly,
    clearData,
    editWeightEntry,
    deleteWeightEntry,
    signOut
  }), [
    foods,
    meals,
    todayMacros,
    userProfile,
    conversations,
    weightHistory,
    isLoading,
    currentConversationState,
    session,
    user,
    addFood,
    addMeal,
    removeMeal,
    addWeightEntry,
    updateUserProfile,
    addMessageToConversation,
    createNewConversation,
    setCurrentConversation,
    checkIfFoodIsKetoFriendly,
    clearData,
    editWeightEntry,
    deleteWeightEntry,
    signOut,
    calculateRemainingMacros,
    calculateMacrosForDay
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};