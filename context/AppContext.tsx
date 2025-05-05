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
  favoriteFoods: Food[];
  addFavoriteFood: (food: Food) => Promise<void>;
  removeFavoriteFood: (foodId: string) => Promise<void>;
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
  const [favoriteFoods, setFavoriteFoods] = useState<Food[]>([]);
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
      setFavoriteFoods([]);
      setTodayMacros(DEFAULT_DAILY_MACROS);
      setConversations([]);
      setCurrentConversationState(null);
      setIsLoading(false); 
  };

  const loadData = async (userId: string | undefined) => {
    if (!userId) {
      console.log("[AppContext] loadData called without userId. Resetting state.");
      resetStateToDefaults();
      // No need to set isLoading false here, resetStateToDefaults does it.
      return;
    }
    
    console.log(`[AppContext] loadData - START for user: ${userId}`); // Log start
    setIsLoading(true); 
    let loadedProfile: UserProfile | null = null; // Define loadedProfile earlier
    let appMeals: Meal[] = []; // Define appMeals earlier
    let appProfile: UserProfile | null = null; // Define appProfile earlier

    try {
      console.log(`[AppContext] loadData - Proceeding with fetch for user: ${userId}`);

      console.log("[AppContext] loadData - Before Promise.all"); // Log before Promise.all
      const [profileResult, mealsResult, weightResult, favoritesResult] = await Promise.all([
        supabase.from('user_profiles').select('user_id, name, weight, height, goal, activity_level, daily_macro_limit, daily_calories_limit, height_unit, weight_unit').eq('user_id', userId).single(),
        supabase.from('meals').select('*').eq('user_id', userId),
        supabase.from('weight_history')
            .select('id, user_id, entry_date, weight_kg') // Corrected select columns
            .eq('user_id', userId)
            .order('entry_date', { ascending: false }),
        supabase.from('favorite_foods').select('food_data').eq('user_id', userId) // Assuming 'food_data' is the correct column
      ]);
      console.log("[AppContext] loadData - After Promise.all"); // Log after Promise.all

      // Log results individually (optional but helpful)
      console.log("[AppContext] loadData - Profile Result:", profileResult.status, profileResult.error ? profileResult.error.message : `Data: ${!!profileResult.data}`);
      console.log("[AppContext] loadData - Meals Result:", mealsResult.status, mealsResult.error ? mealsResult.error.message : `Data Count: ${mealsResult.data?.length ?? 0}`);
      console.log("[AppContext] loadData - Weight Result:", weightResult.status, weightResult.error ? weightResult.error.message : `Data Count: ${weightResult.data?.length ?? 0}`);
      console.log("[AppContext] loadData - Favorites Result:", favoritesResult.status, favoritesResult.error ? favoritesResult.error.message : `Data Count: ${favoritesResult.data?.length ?? 0}`);


      // --- Initialize Local State (can be kept here or moved) ---
      setFoods([]);
      setMeals([]);
      setConversations([]);
      setWeightHistory([]);
      setFavoriteFoods([]);
      setTodayMacros(DEFAULT_DAILY_MACROS);
      setUserProfile(null);
      appMeals = []; // Reset temporary variable
      appProfile = null; // Reset temporary variable

      console.log("[AppContext] loadData - Start processing fetched data...");

      // --- Process Profile ---
      try {
         if (profileResult.error && profileResult.status !== 406) { // 406 means no rows found, which is okay if we create a default one
            console.error("[AppContext] loadData - Error fetching profile:", profileResult.error);
            // Handle error appropriately, maybe show an alert or use defaults
         } else if (profileResult.data) {
            console.log("[AppContext] loadData - Processing profile data...");
            const dbProfile = profileResult.data as any;
             appProfile = { // Assign to the higher-scoped appProfile
                id: uuidv4(), // Generate client-side ID
                user_id: dbProfile.user_id,
                name: dbProfile.name,
                weight: dbProfile.weight,
                height: dbProfile.height,
                weightUnit: dbProfile.weight_unit || 'kg', // Provide default
                heightUnit: dbProfile.height_unit || 'cm', // Provide default
                goal: dbProfile.goal || 'maintain', // Provide default
                activityLevel: dbProfile.activity_level || 'moderate', // Provide default
                dailyMacroLimit: dbProfile.daily_macro_limit || { carbs: 20, protein: 120, fat: 150, calories: 1800 }, // Provide default
                dailyCalorieLimit: dbProfile.daily_calories_limit || 1800, // Provide default
            };
            setUserProfile(appProfile);
            console.log("[AppContext] loadData - Profile processed and set.");
            loadedProfile = appProfile; // Also update loadedProfile if needed elsewhere
         } else {
             console.warn("[AppContext] loadData - No profile data found for user, creating default.");
            // Consider creating a default profile if none exists
             // const defaultProfileData = { ...DEFAULT_USER_PROFILE, user_id: userId, id: uuidv4() }; // Example
             // const { data: newProfile, error: insertError } = await supabase.from('user_profiles').insert(defaultProfileData).select().single();
             // if (insertError) { console.error("Error creating default profile", insertError); }
             // else { setUserProfile(newProfile); appProfile = newProfile; loadedProfile = newProfile;}
             // For now, let's just set a null or default profile state if creation isn't implemented
             const defaultProfile: UserProfile = {
                ...DEFAULT_USER_PROFILE,
                id: uuidv4(), // Generate a client-side ID
                user_id: userId
             };
             setUserProfile(defaultProfile);
             appProfile = defaultProfile;
             loadedProfile = defaultProfile;

         }
      } catch(e) { console.error("[AppContext] loadData - Error processing profile:", e); }


      // --- Process Meals ---
      try {
        if (mealsResult.error) {
           console.error("[AppContext] loadData - Error fetching meals:", mealsResult.error);
        } else {
        const dbMeals = mealsResult.data || [];
            console.log(`[AppContext] loadData - Processing ${dbMeals.length} meals...`);
             appMeals = dbMeals.map((dbMeal: any) => ({ // Assign to the higher-scoped appMeals
                id: dbMeal.id,
                user_id: dbMeal.user_id,
                name: dbMeal.name,
                date: dbMeal.date, // Assuming date is stored correctly
                type: dbMeal.meal_type || 'snack', // Map meal_type to type, provide default
                foods: dbMeal.foods || [], // Assuming foods is stored correctly, provide default
                macros: dbMeal.macros || { carbs: 0, protein: 0, fat: 0, calories: 0 }, // Provide default
                created_at: dbMeal.created_at
        })) as Meal[];
            setMeals(appMeals);
            console.log("[AppContext] loadData - Meals processed and set.");
        }
      } catch (e) { console.error(`[AppContext] loadData - Error processing meals for ${userId}:`, e); }

      // --- Process Weight History ---
      let appWeightHistory: WeightEntry[] = [];
      try {
        if (weightResult.error) {
            console.error("[AppContext] loadData - Error fetching weight history:", weightResult.error);
        } else if (weightResult.data) {
           console.log(`[AppContext] loadData - Processing ${weightResult.data.length} weight entries...`);
          appWeightHistory = weightResult.data.map((dbEntry: any) => ({
              id: dbEntry.id,
              user_id: dbEntry.user_id,
              date: dbEntry.entry_date, // Map entry_date to date
              weight: dbEntry.weight_kg, // Map weight_kg to weight
               unit: appProfile?.weightUnit || 'kg' // Use loaded profile
          })) as WeightEntry[];
          
           setWeightHistory(appWeightHistory.sort((a, b) => compareDesc(parseISO(a.date), parseISO(b.date)))); // Use parseISO for correct date sorting
           console.log("[AppContext] loadData - Weight history processed and set.");
        }
      } catch (e) { console.error(`[AppContext] loadData - Error processing weight history for ${userId}:`, e); }
      
      // --- Process Favorites --- 
      try {
          if (favoritesResult.error) {
              console.error("[AppContext] loadData - Error fetching favorites:", favoritesResult.error);
          } else if (favoritesResult.data) {
               console.log(`[AppContext] loadData - Processing ${favoritesResult.data.length} favorite foods...`);
              const favs = favoritesResult.data.map(fav => fav.food_data as Food); // Assuming food_data is the correct structure
              setFavoriteFoods(favs);
              console.log(`[AppContext] loadData - Favorites processed and set.`);
          }
      } catch (e) { console.error(`[AppContext] loadData - Error processing favorites for ${userId}:`, e); }

      // --- Calculate Macros ---
      console.log("[AppContext] loadData - Calculating today's macros...");
      // Ensure appProfile is not null before passing it
      if(appProfile) {
          try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const newTodayMacros = calculateMacrosForDay(appMeals, today, appProfile);
            setTodayMacros(newTodayMacros);
            console.log("[AppContext] loadData - Today's macros calculated.");
          } catch (error) {
            console.error("[AppContext] Error calculating today's macros:", error);
            setTodayMacros(DEFAULT_DAILY_MACROS);
          }
        } else {
           console.warn("[AppContext] loadData - Skipping macro calculation because profile is null.");
           // Set default macros if profile wasn't loaded/created
           setTodayMacros(DEFAULT_DAILY_MACROS);
      }


      console.log(`[AppContext] loadData - Data processing complete for user: ${userId}`);

    } catch (error) {
      console.error(`[AppContext] loadData - Error during data fetching or processing for user ${userId}:`, error);
      // Optionally reset state or set specific error state here
      // resetStateToDefaults(); // Consider if resetting is the desired behavior on error
    } finally {
      console.log(`[AppContext] loadData - FINALLY block reached for user: ${userId}. Setting isLoading to false.`); // Log finally block
      setIsLoading(false);
       console.log(`[AppContext] loadData - END for user: ${userId}, isLoading is now false.`); // Log end
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
    // Always add user_id to payload to ensure proper record creation/matching
    supabasePayload.user_id = user.id;
    // --- End Build Payload ---

    // Check if there's anything left to update
    if (Object.keys(supabasePayload).length === 0) {
        console.warn("[AppContext] updateUserProfile called with no valid data to update.");
        return;
    } 
    
    console.log("[AppContext] Attempting to update profile in Supabase with explicit payload:", supabasePayload);
    
    try {
      // First check if the profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
        
      if (checkError && checkError.code !== 'PGRST116') {
        // If it's an error other than "no rows returned", throw it
        throw checkError;
      }
      
      let dataToUpdateStateWith;
      
      if (!existingProfile) {
        // Profile doesn't exist, create a new one with defaults plus provided data
        const newProfileData = {
          ...DEFAULT_USER_PROFILE,
          ...supabasePayload,
          user_id: user.id,
          // Don't specify id - let the database generate it
        };
        
        console.log("[AppContext] No existing profile found, creating new one:", newProfileData);
        // Insert without selecting data back and without .single()
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert(newProfileData);
        
        if (insertError) throw insertError;
        dataToUpdateStateWith = newProfileData; // Use the data we sent for state update
          
      } else {
        // Profile exists, just update it
        console.log("[AppContext] Updating existing profile");
        // Update without selecting data back and without .single()
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update(supabasePayload)
          .eq('user_id', user.id);
          
        if (updateError) throw updateError;
        // Use the userProfile from state and merge the updates we sent
        dataToUpdateStateWith = { ...userProfile, ...supabasePayload }; 
      }
      
      // No need to process returned data as we didn't select it
      
      if (dataToUpdateStateWith) {
        console.log("[AppContext] Profile updated/created successfully in Supabase. Updating local state...");
        // Map the snake_case data we have to camelCase for the app state
        const dbProfile = dataToUpdateStateWith as any;
        const appProfile: UserProfile = {
            id: userProfile?.id || uuidv4(), // Keep existing ID or generate new if creating
            user_id: dbProfile.user_id,
            name: dbProfile.name || DEFAULT_USER_PROFILE.name,
            weight: dbProfile.weight || DEFAULT_USER_PROFILE.weight,
            height: dbProfile.height || DEFAULT_USER_PROFILE.height,
            goal: dbProfile.goal || DEFAULT_USER_PROFILE.goal,
            activityLevel: dbProfile.activity_level || DEFAULT_USER_PROFILE.activityLevel,
            dailyMacroLimit: dbProfile.daily_macro_limit || DEFAULT_USER_PROFILE.dailyMacroLimit,
            dailyCalorieLimit: dbProfile.daily_calories_limit || DEFAULT_USER_PROFILE.dailyCalorieLimit,
            heightUnit: dbProfile.height_unit || DEFAULT_USER_PROFILE.heightUnit,
            weightUnit: dbProfile.weight_unit || DEFAULT_USER_PROFILE.weightUnit
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
    } catch (error) {
      console.error("[AppContext] Error updating profile:", error);
      Alert.alert("Error", `Could not update profile: ${(error as any)?.message || 'Unknown error'}`);
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
        console.error(`[AppContext] Error updating weight entry ${entryId}:`, error);
        Alert.alert("Error", `Could not update weight entry: ${error.message || error}`);
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

  // --- Favorite Functions --- 

  const addFavoriteFood = useCallback(async (food: Food) => {
    if (!user?.id) {
      Alert.alert("Error", "You must be logged in to add favorites.");
      return;
    }
    if (!food || !food.id) {
        Alert.alert("Error", "Invalid food item provided.");
        return;
    }
    
    // Check if already favorited
    const isAlreadyFavorite = favoriteFoods.some(fav => fav.id === food.id);
    if (isAlreadyFavorite) {
        Alert.alert("Info", `${food.name} is already in your favorites.`);
        return;
    }

    console.log(`[AppContext] Adding favorite: ${food.name} (ID: ${food.id})`);
    const { error } = await supabase
      .from('favorite_foods')
      .insert({ user_id: user.id, food_data: food })
      .select(); // Added select() to potentially get back the inserted row if needed

    if (error) {
      console.error("[AppContext] Error adding favorite food:", error);
      Alert.alert("Error", `Could not add favorite: ${error.message}`);
    } else {
      console.log(`[AppContext] Favorite ${food.name} added successfully.`);
      setFavoriteFoods(prev => [...prev, food]);
      Alert.alert("Favorite Added", `${food.name} added to favorites.`);
    }
  }, [user?.id, favoriteFoods]);

  const removeFavoriteFood = useCallback(async (foodId: string) => {
    if (!user?.id) {
      Alert.alert("Error", "You must be logged in to remove favorites.");
      return;
    }
    if (!foodId) {
        Alert.alert("Error", "Invalid food ID provided.");
        return;
    }

    console.log(`[AppContext] Removing favorite with food ID: ${foodId}`);
    const { error } = await supabase
      .from('favorite_foods')
      .delete()
      .eq('user_id', user.id)
      // Match the 'id' field *inside* the 'food_data' JSONB column
      .eq('food_data->>id', foodId); 

    if (error) {
      console.error("[AppContext] Error removing favorite food:", error);
      Alert.alert("Error", `Could not remove favorite: ${error.message}`);
    } else {
      const removedFoodName = favoriteFoods.find(fav => fav.id === foodId)?.name || 'Item';
      console.log(`[AppContext] Favorite ${removedFoodName} (ID: ${foodId}) removed successfully.`);
      setFavoriteFoods(prev => prev.filter(fav => fav.id !== foodId));
      Alert.alert("Favorite Removed", `${removedFoodName} removed from favorites.`);
    }
  }, [user?.id, favoriteFoods]);

  // --- End Favorite Functions ---

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
    setIsLoading(true); // Indicate loading during sign out
    try {
    const { error } = await supabase.auth.signOut();
    if (error) {
            console.error("Error signing out:", error);
            Alert.alert("Error", `Sign out failed: ${error.message}`);
             setIsSigningOut(false); // Reset flag on error
             setIsLoading(false); // Reset loading on error
    } else {
            console.log("[AppContext] Supabase signOut successful. Auth listener should handle state reset.");
             // Don't manually reset state here - let the onAuthStateChange listener handle it
             // resetStateToDefaults(); // REMOVED - let listener handle it
             // setSession(null); // REMOVED
             // setUser(null); // REMOVED
             // setIsLoading(false); // REMOVED - Listener will set this after reset
             // isSigningOut will be reset by the listener when SIGNED_OUT is processed
        }
    } catch (e: any) {
        console.error("Unexpected error during sign out:", e);
        Alert.alert("Error", `An unexpected error occurred during sign out: ${e.message}`);
         setIsSigningOut(false); // Reset flag on unexpected error
         setIsLoading(false); // Reset loading on unexpected error
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
    clearData,
    editWeightEntry,
    deleteWeightEntry,
    signOut,
    favoriteFoods,
    addFavoriteFood,
    removeFavoriteFood
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
    clearData,
    editWeightEntry,
    deleteWeightEntry,
    signOut,
    calculateRemainingMacros,
    calculateMacrosForDay,
    favoriteFoods,
    addFavoriteFood,
    removeFavoriteFood
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