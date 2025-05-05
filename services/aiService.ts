import { supabase } from '../lib/supabaseClient'; // Assuming client is here
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions'; // Assuming types might be available

// Remove OpenAI import and initialization
// No need for API key check here anymore

export const analyzeFood = async (messages: ChatCompletionMessageParam[]): Promise<string> => {
  console.log("[aiService] Forwarding messages to openai-proxy...");
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
    if (data.error) {
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
        return 'Unable to analyze this food.'; // Fallback message
    }

  } catch (error: any) {
    console.error('[aiService] Error analyzing food via proxy:', error);
    return `Sorry, AI analysis failed: ${error.message}`;
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

    // Adjust response parsing similarly if needed
    const content = data?.choices?.[0]?.message?.content;
    return content || 'Unable to generate meal suggestions.'; 

  } catch (error) {
    console.error('Error getting meal suggestions from AI Function:', error);
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

    // Fix: Extract content from the ChatCompletion response structure
    const content = data?.choices?.[0]?.message?.content;
    return content || 'Unable to answer your question.';
  } catch (error) {
    console.error('Error getting answer from AI Function:', error);
    // Removed mock fallback
    return 'Sorry, I could not answer your question. Please try again later.';
  }
};

// Removed mock functions below