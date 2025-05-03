import { Food, Macro } from '@/types';
import { analyzeFood } from './aiService'; // Import the AI service
// Removed supabase client import as proxy is no longer used

// Type for the NotFound marker
export type NotFoundMarker = { status: 'not_found'; query: string };

// Helper function for keto check (keep for parsed results)
const isKetoFriendly = (macros: Macro): boolean => {
  // Simplified check: Primarily focus on low carbs (e.g., <= 7g)
  return macros.carbs >= 0 && macros.carbs <= 7;
};

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
      isKetoFriendly: true
    },
    {
      id: '2',
      name: 'Bacon',
      brand: 'Generic',
      servingSize: '2 slices (20g)',
      macros: { carbs: 0, protein: 6, fat: 8, calories: 90 },
      dateAdded: new Date().toISOString(),
      isKetoFriendly: true
    },
    {
      id: '3',
      name: 'Bread',
      brand: 'Generic',
      servingSize: '1 slice (30g)',
      macros: { carbs: 15, protein: 3, fat: 1, calories: 80 },
      dateAdded: new Date().toISOString(),
      isKetoFriendly: false
    }
  ];

  return mockFoods.filter(food => 
    food.name.toLowerCase().includes(query.toLowerCase()) || 
    (food.brand && food.brand.toLowerCase().includes(query.toLowerCase()))
  );
};

// Function return type updated to include NotFoundMarker
export const getFoodDetailsFromAI = async (query: string): Promise<Food | NotFoundMarker | null> => {
  console.log('[foodService] Getting food details from AI for:', query);

  // Enhanced Prompt v4 - Status key
  const prompt = `
Analyze the following food query: "${query}"

If the query is a barcode, look up the product *accurately*.
If it's a food name, provide typical nutritional information.

**Accuracy is critical.** Respond with a status line first, then the details.
If you cannot confidently identify the *exact* product for the given barcode, set Status to NotFound.

**Output Format:** Respond *only* with the following key-value pairs on separate lines. Do not add any extra explanation or commentary.

Status: [Found | NotFound]
Name: [Product Name or Unknown Barcode ...]
Serving Size: [Serving Size or N/A]
Calories: [Number or 0]
Carbs: [Number or 0]
Protein: [Number or 0]
Fat: [Number or 0]

Example for "1 large egg":
Status: Found
Name: Large Egg
Serving Size: 1 large (50g)
Calories: 72
Carbs: 0.4
Protein: 6
Fat: 5

Example for barcode 123456789 (if found):
Status: Found
Name: Specific Product Name
Serving Size: 1 bar (45g)
Calories: 200
Carbs: 20
Protein: 5
Fat: 10

Example for barcode 987654321 (if NOT found or unsure):
Status: NotFound
Name: Unknown Barcode 987654321
Serving Size: N/A
Calories: 0
Carbs: 0
Protein: 0
Fat: 0
  `;

  try {
    const aiResponseText = await analyzeFood(prompt);
    console.log('[foodService] AI analysis response:\n', aiResponseText);

    // parseAIResponseToFood now also returns NotFoundMarker or null
    const parsedResult = parseAIResponseToFood(query, aiResponseText); 

    if (parsedResult === null) {
       // Parsing failed completely
       console.warn('[foodService] Could not parse AI response into Food object for query:', query);
       // Return a minimal object indicating parsing failure
       return {
           id: `parse_err_${Date.now()}`,
           name: query,
           brand: 'Parsing Failed',
           servingSize: 'N/A',
           macros: { carbs: 0, protein: 0, fat: 0, calories: 0 },
           description: 'AI response could not be parsed.',
           dateAdded: new Date().toISOString(),
           isKetoFriendly: false,
       } as Food; // Cast to Food for simplicity here, UI will handle
    }
    
    // Return the parsed Food object or the NotFoundMarker
    return parsedResult; 

  } catch (aiError) {
    console.error('[foodService] AI analysis failed for query:', query, aiError);
    return null; // Return null if AI call itself fails
  }
};

// Updated parser return type
const parseAIResponseToFood = (originalQuery: string, text: string): Food | NotFoundMarker | null => {
  try {
    let status: 'Found' | 'NotFound' | 'Unknown' = 'Unknown';
    let name = "N/A";
    let servingSize = "N/A";
    let carbs = 0;
    let protein = 0;
    let fat = 0;
    let calories = 0;

    const lines = text.trim().split('\n');
    console.log("[parseAIResponseToFood] Lines:", lines);

    lines.forEach(line => {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim().toLowerCase();
        const value = parts.slice(1).join(':').trim(); 

        if (key === 'status') {
          if (value.toLowerCase() === 'notfound') status = 'NotFound';
          else if (value.toLowerCase() === 'found') status = 'Found';
        }
        else if (key === 'name') name = value;
        else if (key === 'serving size') servingSize = value;
        else if (key === 'calories') calories = parseFloat(value) || 0;
        else if (key === 'carbs') carbs = parseFloat(value) || 0;
        else if (key === 'protein') protein = parseFloat(value) || 0;
        else if (key === 'fat') fat = parseFloat(value) || 0;
      }
    });

    console.log("[parseAIResponseToFood] Parsed Status:", status);
    console.log("[parseAIResponseToFood] Parsed Values:", { name, servingSize, calories, carbs, protein, fat });

    if (status === 'NotFound') {
       console.log("[parseAIResponseToFood] AI reported NotFound.");
       return { status: 'not_found', query: originalQuery };
    }

    // If status wasn't explicitly NotFound, but we didn't parse anything useful, treat as failure
    if (status === 'Unknown' && name === "N/A" && servingSize === "N/A" && calories === 0 && carbs === 0 && protein === 0 && fat === 0) {
       console.warn("[parseAIResponseToFood] Failed to parse any meaningful data or status from lines.");
       return null; // Indicate complete parsing failure
    }
    
    // Assume Status is Found (or wasn't provided but we got data)
    const macros: Macro = { carbs, protein, fat, calories };
    const ketoFriendly = isKetoFriendly(macros);
    console.log("[parseAIResponseToFood] Calculated Keto Friendly:", ketoFriendly);

    return {
      id: `ai_${Date.now()}`,
      name: name, 
      brand: 'AI Analyzed',
      servingSize: servingSize, 
      macros: macros,
      description: text, 
      dateAdded: new Date().toISOString(),
      isKetoFriendly: ketoFriendly,
    };
  } catch (e) {
    console.error('[foodService] Error parsing AI response:', e);
    return null;
  }
};