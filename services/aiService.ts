import { supabase } from '../lib/supabaseClient'; // Assuming client is here

// Remove OpenAI import and initialization
// No need for API key check here anymore

export const analyzeFood = async (foodItem: string): Promise<string> => {
  try {
    const messages = [
      {
        role: 'system',
        content: 'You are a keto diet nutrition expert assistant. Respond concisely. When providing macronutrients, use the EXACT format: "Calories: VALUE, Carbs: VALUE, Protein: VALUE, Fat: VALUE" using numerical values only for VALUE (e.g., Carbs: 2.5). Provide this information per common serving size.'
      },
      {
        role: 'user',
        content: `Analyze the food item or barcode query: "${foodItem}". Provide its typical macronutrients per common serving size (using the specified format) and explain if it is generally considered keto-friendly based on these macros.`
      }
    ];

    // Invoke the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('openai-proxy', {
      body: { messages } // Send messages in the body
    });

    if (error) throw error; // Throw if Supabase function invocation fails
    if (data.error) throw new Error(data.error); // Throw if the Edge Function returned an error message

    return data.response || 'Unable to analyze this food.'; // Extract the response from the function's return value
  } catch (error) {
    console.error('Error analyzing food with AI Function:', error);
    // Removed mock fallback
    return 'Sorry, I could not analyze this food. Please try again later.';
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

    // Invoke the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('openai-proxy', {
        body: { messages }
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);

    return data.response || 'Unable to generate meal suggestions.';
  } catch (error) {
    console.error('Error getting meal suggestions from AI Function:', error);
    // Removed mock fallback
    return 'Sorry, I could not generate meal suggestions. Please try again later.';
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

    // Invoke the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('openai-proxy', {
        body: { messages }
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);

    return data.response || 'Unable to answer your question.';
  } catch (error) {
    console.error('Error getting answer from AI Function:', error);
    // Removed mock fallback
    return 'Sorry, I could not answer your question. Please try again later.';
  }
};

// Removed mock functions below