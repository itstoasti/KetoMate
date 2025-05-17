import { supabase } from '../lib/supabaseClient'; // Assuming client is here
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions'; // Assuming types might be available

// Mock data for fallback when service is unavailable
const MOCK_FOOD_RESPONSES: Record<string, string> = {
  // Common foods with reasonably accurate nutritional data
  default: `Name: Generic Food Item
Serving Size: 1 serving
Calories: 200
Total Carbs: 15
Fiber: 3
Sugar Alcohols: 0
Net Carbs: 12
Protein: 10
Fat: 15`,
  burger: `Name: Hamburger
Serving Size: 1 burger (170g)
Calories: 354
Total Carbs: 26
Fiber: 1
Sugar Alcohols: 0
Net Carbs: 25
Protein: 20
Fat: 17`,
  steak: `Name: Ribeye Steak
Serving Size: 8 oz (226g)
Calories: 544
Total Carbs: 0
Fiber: 0
Sugar Alcohols: 0
Net Carbs: 0
Protein: 44
Fat: 40`,
  chicken: `Name: Grilled Chicken Breast
Serving Size: 1 breast (172g)
Calories: 284
Total Carbs: 0
Fiber: 0
Sugar Alcohols: 0
Net Carbs: 0
Protein: 53
Fat: 6`,
  salad: `Name: Garden Salad with Ranch
Serving Size: 1 bowl (150g)
Calories: 150
Total Carbs: 8
Fiber: 3
Sugar Alcohols: 0
Net Carbs: 5
Protein: 2
Fat: 12`
};

// Select the best mock data based on search query
const getFallbackResponse = (query: string): string => {
  query = query.toLowerCase();
  
  if (query.includes('burger') || query.includes('hamburger')) return MOCK_FOOD_RESPONSES.burger;
  if (query.includes('steak') || query.includes('beef')) return MOCK_FOOD_RESPONSES.steak;
  if (query.includes('chicken') || query.includes('breast')) return MOCK_FOOD_RESPONSES.chicken;
  if (query.includes('salad')) return MOCK_FOOD_RESPONSES.salad;
  
  return MOCK_FOOD_RESPONSES.default;
};

export const analyzeFood = async (messages: ChatCompletionMessageParam[]): Promise<string> => {
  console.log("[aiService] Forwarding messages to openai-proxy...");
  
  // Extract the food query for potential fallback
  const userMessage = messages.find(m => m.role === 'user');
  const userQuery = typeof userMessage?.content === 'string' 
    ? userMessage.content 
    : typeof userMessage?.content === 'object' && userMessage.content[0]?.type === 'text'
      ? userMessage.content[0].text
      : '';
  
  // Create a timeout promise that resolves with fallback data
  const timeoutPromise = new Promise<string>((resolve) => {
    setTimeout(() => {
      console.log('[aiService] Request timed out, using fallback data');
      resolve(getFallbackResponse(userQuery));
    }, 8000); // 8 second timeout before falling back
  });
  
  try {
    // Race between the actual request and timeout
    return await Promise.race([
      (async () => {
  try {
    // Invoke the Supabase Edge Function, passing the messages array directly
    const { data, error } = await supabase.functions.invoke('openai-proxy', {
      body: { messages } // Pass the pre-constructed messages array
    });

    if (error) {
        console.error("[aiService] Supabase function invocation error:", error);
        throw error;
    }
    
    // Edge function might return an error object within data
          if (data?.error) {
        console.error("[aiService] Edge function returned error:", data.error);
        throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
    }

    // Parse the actual response content from the full ChatCompletion object returned by the proxy
    const content = data?.choices?.[0]?.message?.content;
    if (content) {
        console.log("[aiService] Received content from proxy:", content.substring(0, 100) + "...");
        return content;
    } else {
        console.error("[aiService] Invalid or missing content in proxy response:", data);
            throw new Error('Invalid response format');
          }
        } catch (err) {
          console.error('[aiService] Error in supabase function call:', err);
          throw err;
        }
      })(),
      timeoutPromise
    ]);
  } catch (error: any) {
    console.error('[aiService] Error analyzing food via proxy, using fallback:', error);
    return getFallbackResponse(userQuery);
  }
};

export const getSuggestedMeals = async (preferences: string): Promise<string> => {
  try {
    const messages = [
      {
        role: 'system',
        content: 'You are a keto diet nutrition expert assistant. Suggest keto-friendly meals based on user preferences.'
      },
      {
        role: 'user',
        content: `Suggest 3 keto-friendly meal ideas ${preferences ? 'with these preferences: ' + preferences : ''}. Include approximate macros for each meal.`
      }
    ];

    // Add a timeout to prevent indefinite waiting
    const timeoutPromise = new Promise<string>((resolve) => {
      setTimeout(() => {
        resolve(`1. Steak with Buttered Asparagus - Calories: 550, Net Carbs: 5g, Protein: 40g, Fat: 38g
2. Keto Cobb Salad with Chicken - Calories: 450, Net Carbs: 6g, Protein: 30g, Fat: 30g
3. Salmon with Creamed Spinach - Calories: 500, Net Carbs: 4g, Protein: 35g, Fat: 35g`);
      }, 8000);
    });

    // Race between the actual request and timeout
    return await Promise.race([
      (async () => {
    // Invoke the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('openai-proxy', {
        body: { messages }
    });

    if (error) throw error;
        if (data?.error) throw new Error(data.error);

    // Adjust response parsing similarly if needed
    const content = data?.choices?.[0]?.message?.content;
    return content || 'Unable to generate meal suggestions.'; 
      })(),
      timeoutPromise
    ]);
  } catch (error) {
    console.error('Error getting meal suggestions from AI Function:', error);
    return `1. Steak with Buttered Asparagus - Calories: 550, Net Carbs: 5g, Protein: 40g, Fat: 38g
2. Keto Cobb Salad with Chicken - Calories: 450, Net Carbs: 6g, Protein: 30g, Fat: 30g
3. Salmon with Creamed Spinach - Calories: 500, Net Carbs: 4g, Protein: 35g, Fat: 35g`;
  }
};

export const getAnswerToQuestion = async (question: string): Promise<string> => {
  try {
    const messages = [
        {
          role: 'system',
          content: 'You are a keto diet nutrition expert assistant. Provide accurate, helpful, and concise information about the ketogenic diet.'
        },
        {
          role: 'user',
          content: question
        }
      ];

    // Add a timeout to prevent indefinite waiting
    const timeoutPromise = new Promise<string>((resolve) => {
      setTimeout(() => {
        resolve('Sorry, the service is temporarily unavailable. The ketogenic diet is a high-fat, low-carb diet that puts your body in ketosis, a metabolic state where you burn fat for fuel instead of carbs. Typically, keep carbs under 20-50g per day, eat moderate protein, and get most calories from healthy fats.');
      }, 8000);
    });

    // Race between the actual request and timeout
    return await Promise.race([
      (async () => {
    // Invoke the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('openai-proxy', {
        body: { messages }
    });

    if (error) throw error;
        if (data?.error) throw new Error(data.error);

    // Fix: Extract content from the ChatCompletion response structure
    const content = data?.choices?.[0]?.message?.content;
    return content || 'Unable to answer your question.';
      })(),
      timeoutPromise
    ]);
  } catch (error) {
    console.error('Error getting answer from AI Function:', error);
    return 'Sorry, the service is temporarily unavailable. The ketogenic diet is a high-fat, low-carb diet that puts your body in ketosis, a metabolic state where you burn fat for fuel instead of carbs. Typically, keep carbs under 20-50g per day, eat moderate protein, and get most calories from healthy fats.';
  }
};

// Removed mock functions below