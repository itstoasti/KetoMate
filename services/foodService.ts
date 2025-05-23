import { Food, Macro } from '@/types';
import { analyzeFood } from './aiService'; // Import the AI service
import { supabase } from '../lib/supabaseClient'; // Re-add supabase import
// Removed supabase client import as proxy is no longer used

// Type definition for Keto Rating
type KetoRating = 'Keto-Friendly' | 'Limit' | 'Strictly Limit' | 'Avoid';

// Type for the NotFound marker
export type NotFoundMarker = { status: 'not_found'; query: string };

// Helper function for keto check (keep for parsed results)
const isKetoFriendly = (macros: Macro): boolean => {
  // Simplified check: Primarily focus on low carbs (e.g., <= 7g)
  // Note: This should ideally use NET CARBS if available
  // We handle this in TrackScreen by setting the `carbs` field
  // in the form/saved data to be net carbs.
  return macros.carbs >= 0 && macros.carbs <= 7;
};

// --- Moved from AppContext --- 
// Helper function to determine keto rating based on net carbs
// Export the function so it can be used elsewhere (e.g., TrackScreen)
export const getKetoRating = (netCarbs: number | null): KetoRating => {
  if (netCarbs === null || netCarbs < 0) {
    console.warn(`[getKetoRating] Invalid or null netCarbs (${netCarbs}), defaulting rating.`);
    return 'Limit'; // Default for missing/invalid data
  }
  if (netCarbs <= 6) return 'Keto-Friendly'; // Green
  if (netCarbs <= 10) return 'Limit'; // Yellow
  if (netCarbs <= 20) return 'Strictly Limit'; // Red
  return 'Avoid'; // Red (> 20)
};
// --- End Moved Function --- 

// --- Removed searchFoodByName and getFoodByBarcode functions --- 

// Fallback mock function remains for now
export const mockFoodSearch = (query: string): Food[] => {
  const mockFoods: Food[] = [
    {
      id: '1',
      name: 'Avocado',
      brand: 'Generic',
      servingSize: '1 medium (150g)',
      macros: { carbs: 2, protein: 2, fat: 15, calories: 160 },
      dateAdded: new Date().toISOString(),
      ketoRating: 'Keto-Friendly' // Net carbs = 2
    },
    {
      id: '2',
      name: 'Bacon',
      brand: 'Generic',
      servingSize: '2 slices (20g)',
      macros: { carbs: 0, protein: 6, fat: 8, calories: 90 },
      dateAdded: new Date().toISOString(),
      ketoRating: 'Keto-Friendly' // Net carbs = 0
    },
    {
      id: '3',
      name: 'Bread',
      brand: 'Generic',
      servingSize: '1 slice (30g)',
      macros: { carbs: 15, protein: 3, fat: 1, calories: 80 },
      dateAdded: new Date().toISOString(),
      ketoRating: 'Strictly Limit' // Net carbs = 15
    }
  ];

  return mockFoods.filter(food => 
    food.name.toLowerCase().includes(query.toLowerCase()) || 
    (food.brand && food.brand.toLowerCase().includes(query.toLowerCase()))
  );
};

// Function to check if a query looks like a barcode
const looksLikeBarcode = (query: string): boolean => {
  // Simple check: all digits and typical length (e.g., 8-14 digits)
  return /^\d{8,14}$/.test(query.trim());
};

// Function return type updated to include NotFoundMarker
export const getFoodDetailsFromAI = async (query: string): Promise<Food | NotFoundMarker | null> => {
  console.log('[foodService] Getting food details from AI for:', query);
  const isBarcodeQuery = looksLikeBarcode(query);
  console.log(`[foodService] Query "${query}" looks like barcode: ${isBarcodeQuery}`);

  // Construct the messages array directly here
  // Use any[] type as ChatCompletionMessageParam is not directly available
  let messages: any[];

  if (isBarcodeQuery) {
    messages = [
      {
        role: 'system',
        content: 'You are an accurate barcode lookup assistant. Respond only in the specified key-value format.'
      },
      {
        role: 'user',
        content: `
Analyze the following food query: "${query}"

This is a barcode. Look up the specific product *accurately*.

**Accuracy is critical.** Respond with a status line first, then the details.
If you cannot confidently identify the *exact* product for the given barcode, set Status to NotFound.

**Output Format:** Respond *only* with the following key-value pairs on separate lines. Do not add any extra explanation or commentary.

Status: [Found | NotFound]
Name: [Product Name or Unknown Barcode ${query}]
Serving Size: [Serving Size or N/A]
Calories: [Number or 0]
Total Carbs: [Number or 0] 
Fiber: [Number or 0]
Sugar Alcohols: [Number or 0] 
Net Carbs: [Number or 0]
Protein: [Number or 0]
Fat: [Number or 0]

Example (if found):
Status: Found
Name: Specific Product Name
Serving Size: 1 bar (45g)
Calories: 200
Total Carbs: 20
Fiber: 5
Sugar Alcohols: 10
Net Carbs: 5 
Protein: 5
Fat: 10

Example (if NOT found or unsure):
Status: NotFound
Name: Unknown Barcode ${query}
Serving Size: N/A
Calories: 0
Total Carbs: 0
Fiber: 0
Sugar Alcohols: 0
Net Carbs: 0
Protein: 0
Fat: 0
        `
      }
    ];
  } else {
    // General Term Query Prompt (REFINED for accuracy and net carbs)
    messages = [
       {
        role: 'system',
        // Refined System Prompt
        content: 'You are an accurate nutrition database assistant. Prioritize factual accuracy for the requested food item. Calculate net carbs (Total Carbs - Fiber - Sugar Alcohols). Respond only in the specified key-value format.'
      },
      {
          role: 'user',
          // Refined User Prompt v2
          content: `
Analyze the specific food item: "${query}"

Provide the most accurate nutritional information you can find for a common serving size. 

**CRITICAL ACCURACY REQUIRED FOR ALL VALUES.**

Calculate Net Carbs using the formula: Net Carbs = Total Carbohydrates - Dietary Fiber - Sugar Alcohols. 
If Fiber or Sugar Alcohols values are not found or are zero for this item, treat them as 0 in the calculation. Ensure the final Net Carbs value is correct based on the values you provide for Total Carbs, Fiber, and Sugar Alcohols.

**Output Format:** Respond *only* with the following key-value pairs on separate lines, ensuring maximum accuracy for each value. Do not add any extra explanation or commentary.

Name: [${query} or Specific Name Found]
Serving Size: [Common Serving Size]
Calories: [Accurate Number or 0]
Total Carbs: [Accurate Number or 0]
Fiber: [Accurate Number or 0]
Sugar Alcohols: [Accurate Number or 0]
Net Carbs: [Accurate Calculated Number or 0]
Protein: [Accurate Number or 0]
Fat: [Accurate Number or 0]

Fat: [Accurate Number or 0]
        ` // Note: Example values might vary, AI should find current best data
      }
    ];
  }

  try {
    // Pass the constructed messages array to analyzeFood
    const aiResponseText = await analyzeFood(messages);
    console.log('[foodService] AI analysis response text received:', aiResponseText);

    // Pass isBarcodeQuery to the parser
    const parsedResult = parseAIResponseToFood(query, aiResponseText, isBarcodeQuery);

    if (parsedResult === null || (parsedResult as Food).brand === 'Parsing Failed') {
       // Handle complete parsing failure or partial failure state
       console.warn('[foodService] Could not parse AI response or parsing failed for query:', query);
       // Return a minimal object indicating parsing failure - Ensure ketoRating is set
       return {
           id: `parse_err_${Date.now()}`,
           name: query,
           brand: 'Parsing Failed',
           servingSize: 'N/A',
           macros: { carbs: 0, protein: 0, fat: 0, calories: 0 }, // Use 0 for carbs here
           ketoRating: getKetoRating(0), // Assign a default rating based on 0 net carbs
           description: 'AI response could not be parsed.',
           dateAdded: new Date().toISOString(),
       } as Food;
    }

    // Return the parsed Food object or the NotFoundMarker
    return parsedResult;

  } catch (aiError: any) {
    console.error('[foodService] AI analysis failed for query:', query, aiError);
    // Include the error message from aiService if possible
    return null; 
  }
};

// Updated parser signature and logic
const parseAIResponseToFood = (originalQuery: string, text: string, isBarcodeQuery: boolean): Food | NotFoundMarker | null => {
  try {
    // If empty text, handle as failure case
    if (!text || text.trim() === '') {
      console.warn("[parseAIResponseToFood] Empty response text received");
      return {
        id: `parse_fail_empty_${Date.now()}`,
        name: originalQuery,
        brand: 'Parsing Failed',
        servingSize: 'N/A',
        macros: { carbs: 0, protein: 0, fat: 0, calories: 0 },
        ketoRating: getKetoRating(0),
        description: 'AI response was empty.',
        dateAdded: new Date().toISOString(),
      } as Food;
    }
    
    let status: 'Found' | 'NotFound' | 'Unknown' = isBarcodeQuery ? 'Unknown' : 'Found';
    let name = originalQuery; // Default to query instead of N/A for better UX
    let servingSize = "1 serving";
    let totalCarbs = 0; // Keep track of total carbs
    let fiber = 0;
    let sugarAlcohols = 0;
    let parsedNetCarbs: number | null = null; // Store net carbs if AI provides it directly
    let protein = 0;
    let fat = 0;
    let calories = 0;
    let parsedSomething = false;

    const lines = text.trim().split('\n'); 
    console.log("[parseAIResponseToFood] Lines:", lines);

    // Double check for "sorry" or error messages in first few lines
    const firstTwoLines = lines.slice(0, 2).join(' ').toLowerCase();
    if (firstTwoLines.includes('sorry') || 
        firstTwoLines.includes('error') || 
        firstTwoLines.includes('unable to') ||
        firstTwoLines.includes('failed')) {
      console.warn("[parseAIResponseToFood] Error message detected in response:", firstTwoLines);
      return {
        id: `parse_fail_error_${Date.now()}`,
        name: originalQuery,
        brand: 'AI Error',
        servingSize: 'N/A',
        macros: { carbs: 0, protein: 0, fat: 0, calories: 0 },
        ketoRating: getKetoRating(0),
        description: 'AI returned an error message.',
        dateAdded: new Date().toISOString(),
      } as Food;
    }

    lines.forEach(line => {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim().toLowerCase();
        const value = parts.slice(1).join(':').trim();

        if (isBarcodeQuery && key === 'status') {
          if (value.toLowerCase() === 'notfound') status = 'NotFound';
          else if (value.toLowerCase() === 'found') status = 'Found';
          else status = 'Unknown';
          parsedSomething = true;
        }
        else if (key === 'name') { name = value || originalQuery; parsedSomething = true; }
        else if (key === 'serving size') { servingSize = value || '1 serving'; parsedSomething = true; }
        else if (key === 'calories') { 
          const parsed = parseFloat(value); 
          calories = isNaN(parsed) ? 0 : parsed; 
          parsedSomething = true; 
        }
        else if (key === 'total carbs') { 
          const parsed = parseFloat(value); 
          totalCarbs = isNaN(parsed) ? 0 : parsed; 
          parsedSomething = true; 
        }
        else if (key === 'fiber') { 
          const parsed = parseFloat(value); 
          fiber = isNaN(parsed) ? 0 : parsed; 
          parsedSomething = true; 
        }
        else if (key === 'sugar alcohols') { 
          const parsed = parseFloat(value); 
          sugarAlcohols = isNaN(parsed) ? 0 : parsed; 
          parsedSomething = true; 
        }
        else if (key === 'net carbs') {
          const parsed = parseFloat(value);
          parsedNetCarbs = isNaN(parsed) ? null : parsed;
          parsedSomething = true; 
        }
        else if (key === 'protein') { 
          const parsed = parseFloat(value); 
          protein = isNaN(parsed) ? 0 : parsed; 
          parsedSomething = true; 
        }
        else if (key === 'fat') { 
          const parsed = parseFloat(value); 
          fat = isNaN(parsed) ? 0 : parsed; 
            parsedSomething = true; 
        }
      }
    });

    console.log("[parseAIResponseToFood] Parsed Status:", status);
    console.log("[parseAIResponseToFood] Parsed Values:", { name, servingSize, calories, totalCarbs, fiber, sugarAlcohols, parsedNetCarbs, protein, fat });

    // --- Barcode Not Found Handling ---
    if (isBarcodeQuery && (status as 'Found' | 'NotFound' | 'Unknown') === 'NotFound') {
        console.log("[parseAIResponseToFood] Barcode reported as NotFound by AI.");
       return { status: 'not_found', query: originalQuery };
    }
    // --- End Barcode Handling ---

    // If parsing failed to get any meaningful value other than potentially status
    if (!parsedSomething) {
       console.warn("[parseAIResponseToFood] Failed to parse any meaningful data from lines.");
        // Don't return null, return the specific 'Parsing Failed' structure
        // Need to assign a ketoRating even for failure cases
        const defaultRating = getKetoRating(0); // Rating based on 0 net carbs
        return {
           id: `parse_fail_${Date.now()}`,
           name: originalQuery,
           brand: 'Parsing Failed', 
           servingSize: 'N/A',
           macros: { carbs: 0, protein: 0, fat: 0, calories: 0 },
           ketoRating: defaultRating,
           description: 'AI response could not be parsed.',
           dateAdded: new Date().toISOString(),
       } as Food;
    }

    // --- Calculate Net Carbs and Keto Rating --- 
    let finalNetCarbs: number;
    if (parsedNetCarbs !== null) {
        // Use net carbs if AI provided it directly and it's valid
        finalNetCarbs = parsedNetCarbs;
        console.log(`[parseAIResponseToFood] Using net carbs provided by AI: ${finalNetCarbs}`);
    } else {
        // Calculate net carbs if not provided or invalid
        finalNetCarbs = Math.max(0, totalCarbs - fiber - sugarAlcohols);
        console.log(`[parseAIResponseToFood] Calculated net carbs: ${totalCarbs} - ${fiber} - ${sugarAlcohols} = ${finalNetCarbs}`);
    }

    const ketoRating = getKetoRating(finalNetCarbs);
    console.log(`[parseAIResponseToFood] Determined keto rating: ${ketoRating}`);
    // --- End Calculation ---

    return {
      id: `${Date.now()}_${Math.floor(Math.random() * 1000)}`, // Use timestamp + random for more unique IDs
      name: name,
      brand: isBarcodeQuery ? 'Barcode Lookup' : 'AI Search', // Indicate source
      servingSize: servingSize,
      macros: {
        // IMPORTANT: Store the calculated/validated *net carbs* in the 'carbs' field
        carbs: finalNetCarbs, 
        protein: protein,
        fat: fat,
        calories: calories
      },
      ketoRating: ketoRating, // Use the calculated rating
      dateAdded: new Date().toISOString(),
      source: 'ai', // Add source property to identify AI-generated foods
    } as Food;

  } catch (error) {
    console.error("[parseAIResponseToFood] Error parsing AI response:", error);
    // Instead of returning null, return a Food object with fallback values
    return {
      id: `parse_exception_${Date.now()}`,
      name: originalQuery,
      brand: 'AI Parsing Error',
      servingSize: '1 serving',
      macros: { carbs: 0, protein: 0, fat: 0, calories: 0 },
      ketoRating: 'Keto-Friendly', // Default to keto-friendly when we can't parse
      description: 'Exception occurred during parsing.',
      dateAdded: new Date().toISOString(),
      source: 'ai',
    } as Food;
  }
};

// --- Nutrition Label Analysis Service ---

export interface NutritionLabelData {
  name?: string;
  servingSize?: string;
  calories?: number | string;
  totalCarbs?: number | string;
  fiber?: number | string;
  sugarAlcohols?: number | string;
  netCarbs?: number | string;
  protein?: number | string;
  fat?: number | string;
  error?: string;
}

// Updated function signature to accept imageBase64
export const getNutritionFromImageAI = async (imageBase64: string): Promise<NutritionLabelData> => {
  console.log('[foodService] Getting nutrition details from image Base64 via AI (OpenAI Proxy)...');

  if (!imageBase64) {
    console.error('[foodService] No image base64 data provided for analysis.');
    return { error: 'No image base64 data provided.' };
  }

  const messages = [
    {
      role: 'system',
      content: 'You are an expert nutrition label analyzer. Your task is to analyze nutrition labels in images and extract key nutritional information accurately. Return the data in a simple JSON format.'
    },
    {
      role: 'user',
      // Enhanced prompt for better gpt-4o analysis
      content: `Analyze the provided image of a nutrition facts label. Extract the following information accurately. If a value is not clearly present or readable, use "N/A" for strings or 0 for numbers. 

Calculate Net Carbs using the formula: Net Carbs = Total Carbohydrates - Dietary Fiber - Sugar Alcohols. If Fiber or Sugar Alcohols are not present, not applicable, or zero, treat them as 0 in the calculation. 

Your response MUST be a valid JSON object containing ONLY these keys (all fields are required):
- "name": Product name from the label or "Unknown Product" if not visible
- "servingSize": Serving size from the label or "1 serving" if not visible
- "calories": Calories per serving (number)
- "totalCarbs": Total carbohydrates in grams (number)
- "fiber": Dietary fiber in grams (number)
- "sugarAlcohols": Sugar alcohols in grams (number)
- "netCarbs": Calculated net carbs (number)
- "protein": Protein in grams (number)
- "fat": Total fat in grams (number)

Format example: {"name": "Example Keto Bar", "servingSize": "1 bar (40g)", "calories": 180, "totalCarbs": 15, "fiber": 8, "sugarAlcohols": 4, "netCarbs": 3, "protein": 10, "fat": 12}

If you cannot analyze the image or it's not a nutrition label, return: {"error": "Could not analyze image"}`
    }
  ];

  try {
    console.log('[foodService] Calling openai-proxy function via fetch with base64...');

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      console.error('[foodService] Error fetching session or no active session:', sessionError);
      return { error: 'User not authenticated' };
    }
    const token = sessionData.session.access_token;
    const apiKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const functionUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/openai-proxy`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': apiKey!, // Add Supabase anon key
      },
      body: JSON.stringify({ messages: messages, imageBase64: imageBase64 })
    });

    console.log('[foodService] Proxy response status:', response.status);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[foodService] Proxy function call failed:', errorBody);
      throw new Error(`Proxy Error (${response.status}): ${errorBody}`);
    }

    const proxyResponse = await response.json(); // Proxy returns the full OpenAI ChatCompletion object
    console.log('[foodService] Received proxy response:', JSON.stringify(proxyResponse).substring(0, 300) + '...');
    
    // Check for error in the response
    if (proxyResponse.error) {
        console.error('[foodService] Error returned from proxy:', proxyResponse.error);
        throw new Error(proxyResponse.error);
    }
    
    // Extract the actual message content
    const aiMessageContent = proxyResponse.choices?.[0]?.message?.content;
    if (!aiMessageContent) {
        console.error("[foodService] No message content found in proxy response:", proxyResponse);
        throw new Error("AI response structure invalid or missing content.");
    }
    
    console.log('[foodService] AI Message Content (from proxy):', aiMessageContent);

    // Parse the JSON string within the message content
    try {
        // First try a direct JSON parse
        const nutritionData: NutritionLabelData = JSON.parse(aiMessageContent);
        console.log('[foodService] Parsed Nutrition Data:', nutritionData);
        
        // Return the parsed data (or data with error if AI returned an error JSON)
        return nutritionData;
    } catch (parseError) {
        console.error("[foodService] Failed to parse AI message content as JSON:", parseError);
        
        // Try to extract JSON from the response if it contains other text
        const jsonMatch = aiMessageContent.match(/\{[^]*\}/);
        if (jsonMatch) {
            try {
                const extractedJson = jsonMatch[0];
                console.log('[foodService] Attempting to parse extracted JSON:', extractedJson);
                const extractedData = JSON.parse(extractedJson);
                console.log('[foodService] Successfully parsed extracted JSON');
                return extractedData;
            } catch (extractError) {
                console.error('[foodService] Failed to parse extracted JSON:', extractError);
            }
        }
        
        // If all parsing attempts fail, try to extract some key nutrition facts
        // using regex as a last resort
        console.log('[foodService] Attempting to extract nutrition facts using regex...');
        const fallbackData: NutritionLabelData = {
            error: "Failed to parse AI response JSON, extracted partial data."
        };
        
        // Extract calories
        const caloriesMatch = aiMessageContent.match(/calories["']?\s*:?\s*(\d+)/i);
        if (caloriesMatch) fallbackData.calories = parseInt(caloriesMatch[1]);
        
        // Extract carbs
        const carbsMatch = aiMessageContent.match(/carbs|totalCarbs["']?\s*:?\s*(\d+)/i);
        if (carbsMatch) fallbackData.totalCarbs = parseInt(carbsMatch[1]);
        
        // Try to salvage whatever we can
        const nameMatch = aiMessageContent.match(/name["']?\s*:?\s*["']([^"']+)["']/i);
        if (nameMatch) fallbackData.name = nameMatch[1];
        
        if (Object.keys(fallbackData).length > 1) {
            console.log('[foodService] Extracted partial data using regex:', fallbackData);
            return fallbackData;
        }
        
        // Give up and return error
        console.error("[foodService] Content that failed parsing:", aiMessageContent);
        return { error: "Failed to parse AI response. Try again with a clearer image." };
    }

  } catch (error: any) {
    console.error('[foodService] Error during nutrition label analysis:', error);
    return { error: error.message || 'An unknown error occurred' };
  }
};

// --- End Nutrition Label Analysis Service ---

// Function to search shared foods database by name
export const searchSharedFoods = async (query: string): Promise<Food[]> => {
  console.log('[foodService] Searching shared foods database for:', query);
  if (!query || query.trim().length < 2) {
    console.log('[foodService] Search query too short, returning empty results');
    return [];
  }
  
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      console.error('[foodService] Error fetching session or no active session:', sessionError);
      return [];
    }
    
    const { data, error } = await supabase.functions.invoke(
      `food-search?query=${encodeURIComponent(query.trim())}`,
      { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (error) {
      console.error('[foodService] Error searching shared foods:', error);
      return [];
    }

    if (data && data.status === 'success') {
      console.log(`[foodService] Found ${data.count} shared food items`);
      return data.items || [];
    }
    
    return [];
  } catch (error) {
    console.error('[foodService] Exception searching shared foods:', error);
    return [];
  }
};

// Function to save a custom food to the user's personal collection
export const saveCustomFood = async (food: Food): Promise<boolean> => {
  console.log('[foodService] Attempting to save custom food to database:', food.name);
  
  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      console.error('[foodService] User authentication error:', userErr);
      return false;
    }
    
    // Try to save to custom_foods table
    const { error } = await supabase
      .from('custom_foods')
      .insert([
        {
          user_id: userData.user.id,
          name: food.name,
          brand: food.brand || null,
          serving_size: food.servingSize,
          calories: food.macros.calories || 0,
          carbs: food.macros.carbs || 0, 
          protein: food.macros.protein || 0,
          fat: food.macros.fat || 0,
          description: food.description || null
        }
      ]);
    
    if (error) {
      console.error('[foodService] Error saving custom food:', error);
      return false;
    }
    
    console.log('[foodService] Successfully saved custom food:', food.name);
    return true;
  } catch (error) {
    console.error('[foodService] Exception saving custom food:', error);
    return false;
  }
};

// Function to search for user's custom foods
export const searchCustomFoods = async (query: string): Promise<Food[]> => {
  console.log('[foodService] Custom foods search unavailable:', query);
  
  // Return empty array until database table is set up
  return [];
};

// Function to search both custom and shared foods
export const searchAllFoods = async (query: string): Promise<Food[]> => {
  console.log('[foodService] Searching all food sources for:', query);
  
  try {
    // First try shared foods (this will always work)
    const sharedResults = await searchSharedFoods(query);
    console.log(`[foodService] Found ${sharedResults.length} shared food items`);
    
    // Only try custom foods if we have fewer than 5 shared results
    let customResults: Food[] = [];
    if (sharedResults.length < 5) {
      customResults = await searchCustomFoods(query);
      console.log(`[foodService] Found ${customResults.length} custom food items`);
    }
    
    // Combine results, prioritizing custom foods
    const combinedResults = [...customResults, ...sharedResults];
    console.log(`[foodService] Returning total of ${combinedResults.length} food items`);
    
    return combinedResults;
  } catch (error) {
    console.error('[foodService] Exception searching all foods:', error);
    return [];
  }
};