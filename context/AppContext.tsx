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
  weightUnit: 'lb',
  heightUnit: 'ft',
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

    // Add safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      if (isLoading) {
        console.log("[AppContext] Safety timeout triggered - forcing loading state to false");
        setIsLoading(false);
      }
    }, 10000); // 10 seconds safety timeout

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

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
        console.log(`[AppContext] Initial session: ${session ? 'Found' : 'Not Found'}`);
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Initial load only if user exists and we are not in the process of signing out.
          // isLoading check can also be here if desired, but isSigningOut is key for this specific issue.
          if (!isSigningOut) { 
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
      clearTimeout(safetyTimeout);
    };
    // Ensure isSigningOut is included if it influences logic inside
  }, []); // REMOVED isSigningOut from dependency array

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

  const calculateRemainingMacros = useCallback((total: Macro, limit: Macro): Macro => {
    return {
      carbs: Math.max(0, limit.carbs - total.carbs),
      protein: Math.max(0, limit.protein - total.protein),
      fat: Math.max(0, limit.fat - total.fat),
      calories: Math.max(0, limit.calories - total.calories)
    };
  }, []);

  // Function for calculating macros by day  
  const calculateMacrosForDay = useCallback((userMeals: Meal[], date: string, profile: UserProfile | null): DailyMacros => {
    // Filter meals for the specified date
    const mealsForDay = userMeals.filter(meal => meal.date === date);
    
    // Calculate total macros from all meals for this day
    const totalMacros = mealsForDay.reduce(
      (total, meal) => {
        return {
          carbs: total.carbs + (meal.macros?.carbs || 0),
          protein: total.protein + (meal.macros?.protein || 0),
          fat: total.fat + (meal.macros?.fat || 0),
          calories: total.calories + (meal.macros?.calories || 0)
        };
      },
      { carbs: 0, protein: 0, fat: 0, calories: 0 }
    );
    
    // Get macro limits from user profile or use defaults
    const limitMacros = profile?.dailyMacroLimit || DEFAULT_DAILY_MACROS.limit;
    
    // Calculate remaining macros
    const remainingMacros = calculateRemainingMacros(totalMacros, limitMacros);
    
    return {
      date,
      total: totalMacros,
      limit: limitMacros,
      remaining: remainingMacros,
      meals: mealsForDay // Use the array of meal objects directly
    };
  }, [calculateRemainingMacros]);

  const loadData = async (userId: string | undefined) => {
    if (!userId) {
      console.log("[AppContext] loadData called without userId. Resetting state.");
      resetStateToDefaults();
      // No need to set isLoading false here, resetStateToDefaults does it.
      return;
    }
    
    console.log(`[AppContext] loadData - START for user: ${userId}`); // Log start
    setIsLoading(true);
    
    // Add safety timeout specifically for loadData function
    const dataLoadTimeout = setTimeout(() => {
      console.log("[AppContext] loadData timeout reached - forcing completion");
      setIsLoading(false);
    }, 8000); // 8 seconds timeout for data loading
    
    let loadedProfile: UserProfile | null = null; // Define loadedProfile earlier
    let appMeals: Meal[] = []; // Define appMeals earlier
    let appProfile: UserProfile | null = null; // Define appProfile earlier

    try {
      console.log(`[AppContext] loadData - Proceeding with fetch for user: ${userId}`);

      console.log("[AppContext] loadData - Before Promise.all"); // Log before Promise.all
      
      // Perform database queries with try-catch instead of promise catch chaining
      let profileResult, mealsResult, weightResult, favoritesResult;
      
      try {
        // Profile query
        profileResult = await supabase
          .from('user_profiles')
          .select('id:user_id, name, weight, height, goal, activity_level, daily_macro_limit, daily_calories_limit, height_unit, weight_unit')
          .eq('user_id', userId)
          .single();
      } catch (error) {
        console.error("[AppContext] Error fetching profile:", error);
        profileResult = { data: null, error };
      }
      
      try {
        // Meals query
        mealsResult = await supabase
          .from('meals')
          .select('id, name, foods, date, time, type, macros, created_at') // Explicitly list fields, including time
          .eq('user_id', userId);
      } catch (error) {
        console.error("[AppContext] Error fetching meals:", error);
        mealsResult = { data: [], error };
      }
      
      try {
        // Weight history query
        weightResult = await supabase
          .from('weight_history')
          .select('id, entry_date, weight_kg') // Removed 'notes' from select
          .eq('user_id', userId)
          .order('entry_date', { ascending: false });
      } catch (error) {
        console.error("[AppContext] Error fetching weight history:", error);
        weightResult = { data: [], error };
      }
      
      try {
        // Favorites query
        favoritesResult = await supabase
          .from('favorite_foods')
          .select('food_data')
          .eq('user_id', userId);
      } catch (error) {
        console.error("[AppContext] Error fetching favorites:", error);
        favoritesResult = { data: [], error };
      }
      
      console.log("[AppContext] loadData - After individual queries"); // Log after queries

      // Log results individually with proper error type handling
      console.log("[AppContext] loadData - Profile Result:", profileResult.status, 
        profileResult.error && typeof profileResult.error === 'object' && 'message' in profileResult.error 
          ? profileResult.error.message 
          : `Data: ${!!profileResult.data}`);
      console.log("[AppContext] loadData - Meals Result:", mealsResult.status, 
        mealsResult.error && typeof mealsResult.error === 'object' && 'message' in mealsResult.error 
          ? mealsResult.error.message 
          : `Data Count: ${mealsResult.data?.length ?? 0}`);
      console.log("[AppContext] loadData - Weight Result:", weightResult.status, 
        weightResult.error && typeof weightResult.error === 'object' && 'message' in weightResult.error 
          ? weightResult.error.message 
          : `Data Count: ${weightResult.data?.length ?? 0}`);
      console.log("[AppContext] loadData - Favorites Result:", favoritesResult.status, 
        favoritesResult.error && typeof favoritesResult.error === 'object' && 'message' in favoritesResult.error 
          ? favoritesResult.error.message 
          : `Data Count: ${favoritesResult.data?.length ?? 0}`);


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
            const fetchedProfile = profileResult.data as any; // Keep as any for raw DB data
             appProfile = { // Assign to the higher-scoped appProfile
                id: fetchedProfile.id, // This is now the aliased user_id
                name: fetchedProfile.name,
                weight: fetchedProfile.weight,
                height: fetchedProfile.height,
                weightUnit: fetchedProfile.weight_unit || 'lb',
                heightUnit: fetchedProfile.height_unit || 'ft',
                goal: fetchedProfile.goal || 'maintain',
                activityLevel: fetchedProfile.activity_level || 'moderate',
                dailyMacroLimit: fetchedProfile.daily_macro_limit || { carbs: 20, protein: 120, fat: 150, calories: 1800 },
                dailyCalorieLimit: fetchedProfile.daily_calories_limit || 1800,
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
                id: userId, // Use userId for the id field
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
             appMeals = dbMeals.map((dbMeal: any) => ({ 
                id: dbMeal.id,
                name: dbMeal.name,
                date: dbMeal.date, 
                time: dbMeal.time, // Added mapping for time
                type: dbMeal.meal_type || 'snack', 
                foods: dbMeal.foods || [], 
                macros: dbMeal.macros || { carbs: 0, protein: 0, fat: 0, calories: 0 }, 
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
           // Get user's preferred weight unit
           const preferredUnit = appProfile?.weightUnit || 'lb';
           
          appWeightHistory = weightResult.data.map((dbEntry: any) => {
              // Convert weight from kg to lb if the preferred unit is lb
              let weightValue = dbEntry.weight_kg;
              if (preferredUnit === 'lb') {
                  weightValue = dbEntry.weight_kg * 2.20462; // Convert kg to lb
              }
              
              return {
              id: dbEntry.id,
                  date: dbEntry.entry_date, 
                  weight: weightValue, 
                  unit: preferredUnit,
              };
          }) as WeightEntry[];
          
           setWeightHistory(appWeightHistory.sort((a, b) => compareDesc(parseISO(a.date), parseISO(b.date))));
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
      clearTimeout(dataLoadTimeout);
      console.log(`[AppContext] loadData - FINALLY block reached for user: ${userId}. Setting isLoading to false.`); // Log finally block
      setIsLoading(false);
      console.log(`[AppContext] loadData - END for user: ${userId}, isLoading is now false.`); // Log end
    }
  };

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

  const updateUserProfile = useCallback(async (profileData: Partial<UserProfile>) => {
    if (!user?.id) {
      console.error("[AppContext] Cannot update profile: No user logged in.");
      Alert.alert("Error", "Authentication error: Please log in again."); 
      return;
    }

    console.log("[AppContext] updateUserProfile called with:", profileData);
    
    const supabasePayload: any = {};
    
    if (profileData.name !== undefined) supabasePayload.name = profileData.name;
    if (profileData.weight !== undefined) supabasePayload.weight = profileData.weight;
    if (profileData.height !== undefined) supabasePayload.height = profileData.height;
    if (profileData.goal !== undefined) supabasePayload.goal = profileData.goal;
    if (profileData.activityLevel !== undefined) supabasePayload.activity_level = profileData.activityLevel;
    if (profileData.dailyMacroLimit !== undefined) supabasePayload.daily_macro_limit = profileData.dailyMacroLimit;
    if (profileData.dailyCalorieLimit !== undefined) supabasePayload.daily_calories_limit = profileData.dailyCalorieLimit;
    if (profileData.heightUnit !== undefined) supabasePayload.height_unit = profileData.heightUnit;
    if (profileData.weightUnit !== undefined) supabasePayload.weight_unit = profileData.weightUnit;
    
    if (Object.keys(supabasePayload).length === 0) {
        console.warn("[AppContext] updateUserProfile called with no valid data to update.");
        return;
    } 
    
    console.log("[AppContext] Attempting to update profile in Supabase with explicit payload:", supabasePayload);
    
    try {
      const { data: existingProfile, error: checkError } = await supabase
      .from('user_profiles')
        .select('user_id')
      .eq('user_id', user.id) 
      .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      
      let dataToUpdateStateWith;
      let profileForStateUpdate: UserProfile;
      
      if (!existingProfile) {
        const newProfileData = {
          name: supabasePayload.name ?? DEFAULT_USER_PROFILE.name,
          weight: supabasePayload.weight ?? DEFAULT_USER_PROFILE.weight,
          height: supabasePayload.height ?? DEFAULT_USER_PROFILE.height,
          goal: supabasePayload.goal ?? DEFAULT_USER_PROFILE.goal,
          activity_level: supabasePayload.activity_level ?? DEFAULT_USER_PROFILE.activityLevel,
          daily_macro_limit: supabasePayload.daily_macro_limit ?? DEFAULT_USER_PROFILE.dailyMacroLimit,
          daily_calories_limit: supabasePayload.daily_calories_limit ?? DEFAULT_USER_PROFILE.dailyCalorieLimit,
          height_unit: supabasePayload.height_unit ?? DEFAULT_USER_PROFILE.heightUnit,
          weight_unit: supabasePayload.weight_unit ?? DEFAULT_USER_PROFILE.weightUnit,
          user_id: user.id,
        };
        
        console.log("[AppContext] No existing profile found, creating new one:", newProfileData);
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert(newProfileData);
        
        if (insertError) throw insertError;
        profileForStateUpdate = {
            id: user.id, // Use the actual user_id as the profile ID
            name: newProfileData.name,
            weight: newProfileData.weight,
            height: newProfileData.height,
            goal: newProfileData.goal,
            activityLevel: newProfileData.activity_level,
            dailyMacroLimit: newProfileData.daily_macro_limit,
            dailyCalorieLimit: newProfileData.daily_calories_limit,
            heightUnit: newProfileData.height_unit,
            weightUnit: newProfileData.weight_unit,
        };
      } else {
        console.log("[AppContext] Updating existing profile");
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update(supabasePayload)
          .eq('user_id', user.id);
          
        if (updateError) throw updateError;
        // Construct the updated profile for state based on current and new data
        const currentProfile = userProfile || { ...DEFAULT_USER_PROFILE, id: user.id }; // Fallback if userProfile is null
        profileForStateUpdate = {
            ...currentProfile, // Spread existing profile data first
            id: user.id,      // Ensure ID is the user_id
            name: supabasePayload.name ?? currentProfile.name,
            weight: supabasePayload.weight ?? currentProfile.weight,
            height: supabasePayload.height ?? currentProfile.height,
            goal: supabasePayload.goal ?? currentProfile.goal,
            activityLevel: supabasePayload.activity_level ?? currentProfile.activityLevel,
            dailyMacroLimit: supabasePayload.daily_macro_limit ?? currentProfile.dailyMacroLimit,
            dailyCalorieLimit: supabasePayload.daily_calories_limit ?? currentProfile.dailyCalorieLimit,
            heightUnit: supabasePayload.height_unit ?? currentProfile.heightUnit,
            weightUnit: supabasePayload.weight_unit ?? currentProfile.weightUnit,
        };
      }
      
        console.log("[AppContext] Profile updated/created successfully in Supabase. Updating local state...");
      setUserProfile(profileForStateUpdate); 

        setTodayMacros(prev => ({
        ...prev,
        limit: profileForStateUpdate.dailyMacroLimit,
        remaining: calculateRemainingMacros(prev.total, profileForStateUpdate.dailyMacroLimit)
        }));
      
    } catch (error) {
      console.error("[AppContext] Error updating profile:", error);
      Alert.alert("Error", `Could not update profile: ${(error as any)?.message || 'Unknown error'}`);
    }
  }, [user?.id, userProfile, calculateRemainingMacros]);

  const addWeightEntry = useCallback(async (entryData: Omit<WeightEntry, 'id' | 'date'>) => {
    if (!user?.id) {
        Alert.alert("Error", "You must be logged in to add weight entries.");
        return;
    }
    
    let weightForDb = entryData.weight;
    if (entryData.unit === 'lb') {
        weightForDb = entryData.weight * 0.453592; 
    }

    const newEntryPayload = {
        user_id: user.id, 
        entry_date: new Date().toISOString(), 
        weight_kg: weightForDb,             
        // unit: entryData.unit, // unit column doesn't exist
        // notes: entryData.notes, // notes column doesn't exist
    };
    
    const { data, error } = await supabase
        .from('weight_history')
        .insert(newEntryPayload)
        .select('id, entry_date, weight_kg') // Removed 'notes' from select
        .single();

    if (error) {
        console.error("[AppContext] Error saving weight entry:", error.message);
        Alert.alert("Error", `Could not save weight entry: ${error.message}`);
    } else if (data) {
        console.log("[AppContext] Weight entry saved successfully:", data.id);
        const anyData = data as any;
        const savedDbEntry = {
            id: anyData.id as string,
            entry_date: anyData.entry_date as string, 
            weight_kg: anyData.weight_kg as number, 
            // unit: anyData.unit as ('kg' | 'lb'), 
            // notes: anyData.notes as (string | undefined),
        };

        const savedAppEntry: WeightEntry = { 
            id: savedDbEntry.id,
            date: savedDbEntry.entry_date, 
            weight: savedDbEntry.weight_kg, 
            unit: entryData.unit, 
            notes: entryData.notes // Keep notes from input for app state, even if not saved to DB
        };

        setWeightHistory(currentWeightHistory => { 
            const newHistory = [savedAppEntry, ...currentWeightHistory].sort((a, b) => compareDesc(parseISO(a.date), parseISO(b.date)));
            
            if (userProfile) { // Check if userProfile exists
              // Check if the new entry is the latest one and differs from profile
              if (newHistory.length > 0 && newHistory[0].id === savedAppEntry.id) {
                if (userProfile.weight !== savedAppEntry.weight || userProfile.weightUnit !== savedAppEntry.unit) {
                    updateUserProfile({ weight: savedAppEntry.weight, weightUnit: savedAppEntry.unit });
                }
              }
            }
            return newHistory;
        });
        
        Alert.alert("Success", "Weight entry saved!");
    }
  }, [user?.id, userProfile, updateUserProfile]);

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
    
    // Always convert to kg for database storage
    const updatePayload = { 
        weight_kg: updatedWeightKg, // DB column is weight_kg
        entry_date: new Date().toISOString() // DB column is entry_date
    };

    console.log(`[AppContext] Attempting to update weight entry ${entryId} in Supabase...`);
    const { data, error } = await supabase
        .from('weight_history')
        .update(updatePayload)
        .eq('id', entryId)
        .eq('user_id', user.id)
        .select('id, entry_date, weight_kg')
        .single();

    if (error) {
        console.error(`[AppContext] Error updating weight entry ${entryId}:`, error);
        Alert.alert("Error", `Could not update weight entry: ${error.message || 'Unknown error'}`);
    } else if (data) {
        console.log(`[AppContext] Weight entry ${entryId} updated successfully.`);
        
        // Get the user's preferred weight unit
        const preferredUnit = userProfile?.weightUnit || 'lb';
        
        // Map DB response to app's WeightEntry type, respecting the user's unit preference
        const dbEntry = data as any;
        
        // Convert weight from kg to lb if the preferred unit is lb
        let weightValue = dbEntry.weight_kg;
        if (preferredUnit === 'lb') {
            weightValue = dbEntry.weight_kg * 2.20462; // Convert kg to lb
        }
        
        const updatedAppEntry: WeightEntry = {
            id: dbEntry.id,
            date: dbEntry.entry_date,
            weight: weightValue,
            unit: preferredUnit,
            // notes: undefined
        };

    const updatedHistory = weightHistory.map(entry => 
            entry.id === entryId ? updatedAppEntry : entry
    );
        updatedHistory.sort((a, b) => compareDesc(parseISO(a.date), parseISO(b.date)));
    setWeightHistory(updatedHistory);

        // Update user profile if this was the latest weight entry
        if (userProfile && updatedHistory.length > 0 && updatedHistory[0].id === entryId) {
            if (userProfile.weight !== updatedAppEntry.weight) {
                // Just update weight, preserve the user's existing weight unit
                updateUserProfile({ weight: updatedAppEntry.weight });
            }
        }
        Alert.alert("Success", "Weight entry updated!");
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

  const signOut = async () => {
    console.log("[AppContext] Initiating sign out...");
    setIsSigningOut(true);
    // No need to set setIsLoading(true) here, the auth listener will handle UI state based on events.
    // setIsLoading(true); 
    try {
    const { error } = await supabase.auth.signOut();
    if (error) {
            console.error("Error signing out:", error);
            Alert.alert("Error", `Sign out failed: ${error.message}`);
        // Reset flags immediately on error so app can recover or user can retry.
        setIsSigningOut(false); 
        setIsLoading(false); 
    } else {
            console.log("[AppContext] Supabase signOut successful. Auth listener should handle state reset.");
        // isSigningOut will be reset by the listener when SIGNED_OUT is processed.
        // setIsLoading will be managed by the listener.
        }
    } catch (e: any) {
        console.error("Unexpected error during sign out:", e);
        Alert.alert("Error", `An unexpected error occurred during sign out: ${e.message}`);
      setIsSigningOut(false); 
      setIsLoading(false); 
    }
  };

  // Function to check if food is keto-friendly based on macros
  const checkIfFoodIsKetoFriendly = useCallback((macros: { carbs: number; fat: number; protein: number }) => {
    // A food is keto-friendly if it has low carbs (typically less than 5-10g per serving)
    // and higher fat content relative to carbs
    const lowCarb = macros.carbs <= 5;
    const highFat = macros.fat >= macros.carbs * 2;
    
    return lowCarb && highFat;
  }, []);

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
    removeFavoriteFood,
    checkIfFoodIsKetoFriendly
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
    removeFavoriteFood,
    checkIfFoodIsKetoFriendly
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