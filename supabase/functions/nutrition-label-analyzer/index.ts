import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Ensure you have set the GOOGLE_AI_API_KEY environment variable in your Supabase project.
const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_AI_API_KEY}`;

interface NutritionData {
  name?: string;
  servingSize?: string;
  calories?: number;
  carbs?: number;
  protein?: number;
  fat?: number;
  error?: string; // Include error field for reporting issues
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Validate API Key
  if (!GOOGLE_AI_API_KEY) {
     console.error('[nutrition-label-analyzer] GOOGLE_AI_API_KEY not set.');
     return new Response(JSON.stringify({ error: 'Server configuration error: Missing API key.' }), {
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       status: 500,
     });
  }

  // Ensure it's a POST request
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  let imageBase64: string | null = null;
  try {
    const body = await req.json();
    imageBase64 = body.imageBase64;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new Error('Missing or invalid imageBase64 in request body.');
    }
     // Basic check to remove data URI prefix if present
     if (imageBase64.startsWith('data:image')) {
        imageBase64 = imageBase64.split(',')[1];
     }
  } catch (e) {
    console.error('[nutrition-label-analyzer] Error parsing request body:', e.message);
    return new Response(JSON.stringify({ error: `Bad Request: ${e.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
  
  console.log('[nutrition-label-analyzer] Received image for analysis (base64 length):', imageBase64.length);

  try {
    const requestPayload = {
      contents: [
        {
          parts: [
            {
              text: `Analyze the provided image of a nutrition facts label. Extract the following information accurately. If a value is not clearly present or readable, use "N/A" for strings or 0 for numbers. Respond ONLY with a valid JSON object containing these keys: "name", "servingSize", "calories", "carbs", "protein", "fat". Do not include markdown formatting (\`\`\`) around the JSON. Example: {"name": "Example Product", "servingSize": "1 cup (240g)", "calories": 150, "carbs": 10, "protein": 5, "fat": 8}. If you cannot perform the analysis, return JSON with an error key: {"error": "Could not analyze image"}.`,
            },
            {
              inline_data: {
                mime_type: 'image/jpeg', // Assuming JPEG, adjust if needed
                data: imageBase64,
              },
            },
          ],
        },
      ],
       "generationConfig": { // Add generation config
         "responseMimeType": "application/json", // Instruct Gemini to respond with JSON
       }
    };

    console.log('[nutrition-label-analyzer] Sending request to Gemini API...');
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    console.log('[nutrition-label-analyzer] Gemini API response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[nutrition-label-analyzer] Gemini API error response:', errorBody);
      throw new Error(`Gemini API request failed with status ${response.status}: ${errorBody}`);
    }

    const result = await response.json();
    console.log('[nutrition-label-analyzer] Gemini API raw result:', JSON.stringify(result));

    // Extract the JSON string from the response - Gemini might wrap it
    let nutritionJsonString = "{}"; 
    if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0]) {
       nutritionJsonString = result.candidates[0].content.parts[0].text;
    } else {
         console.error('[nutrition-label-analyzer] Could not find nutrition data structure in Gemini response.');
         throw new Error('Invalid response structure from Gemini API.');
    }

    console.log('[nutrition-label-analyzer] Extracted JSON string from AI:', nutritionJsonString);

    // Parse the JSON string returned by the AI
    let nutritionData: NutritionData = {};
    try {
       nutritionData = JSON.parse(nutritionJsonString);
    } catch (parseError) {
       console.error('[nutrition-label-analyzer] Failed to parse JSON from Gemini:', parseError.message, "Raw string:", nutritionJsonString);
       // Attempt to extract values with regex as a fallback (simple example)
       const caloriesMatch = nutritionJsonString.match(/"calories":\s*(\d+)/);
       // ... add more regex fallbacks if needed ...
       if (caloriesMatch) {
          nutritionData.calories = parseInt(caloriesMatch[1], 10);
          console.warn('[nutrition-label-analyzer] Partially parsed calories via regex fallback.');
          // You might want to signal partial success/failure here
          nutritionData.error = "AI response format error, partial data extracted.";
       } else {
         throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
       }
    }

    console.log('[nutrition-label-analyzer] Parsed nutrition data:', nutritionData);

    // Return the extracted data
    return new Response(JSON.stringify(nutritionData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[nutrition-label-analyzer] Error during analysis:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to analyze nutrition label.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 