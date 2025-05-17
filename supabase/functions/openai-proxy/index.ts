import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import OpenAI from "https://deno.land/x/openai@v4.52.7/mod.ts";
import { ChatCompletionMessageParam } from 'https://deno.land/x/openai@v4.52.7/resources/chat/completions.ts';

console.log(`Function Version: ${new Date().toISOString()}`);

// Ensure you have set the OPENAI_API_KEY secret in your Supabase project secrets
// supabase secrets set OPENAI_API_KEY <your-key>

serve(async (req: Request) => {
  console.log("Incoming request...");
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request...");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error("Missing environment variable OPENAI_API_KEY");
    }

    // Ensure the OpenAI library is initialized within the request handler
    // or globally if it doesn't store request-specific state.
    const openai = new OpenAI({ apiKey });

    // --- Parse request body --- 
    console.log("Parsing request body...");
    
    const body = await req.json(); // Parse JSON directly
    const { messages, imageBase64 } = body; // Expect imageBase64 again
    
    if (!messages || !Array.isArray(messages)) {
      console.error("Request body missing or invalid 'messages' array.");
      throw new Error("Request body must contain a valid 'messages' array.");
    }
    
    // Validate imageBase64 if present
    if (imageBase64 && typeof imageBase64 !== 'string') {
        console.error("Invalid 'imageBase64' field in request body.");
        throw new Error("If provided, 'imageBase64' must be a string.");
    }
    
    console.log(`Request body parsed. Image Base64 provided: ${imageBase64 ? 'Yes' : 'No'}`);
    // --- End of parsing section ---


    // --- Construct OpenAI Payload ---
    let payload: OpenAI.Chat.Completions.ChatCompletionCreateParams;
    const model = "gpt-4o"; // Use gpt-4o for all requests as it supports both text and vision

    if (imageBase64) {
        console.log("Constructing payload for VISION request with gpt-4o.");
        
        // Ensure base64 string has the correct prefix for OpenAI API
        const imageDataUri = imageBase64.startsWith('data:image') 
                             ? imageBase64 
                             : `data:image/jpeg;base64,${imageBase64}`;

        // Combine text messages and image message for gpt-4o
        const visionMessages: ChatCompletionMessageParam[] = [
            ...messages, // Include existing text messages (system, user prompt)
            {
                role: 'user',
                content: [
                    { 
                        type: "text", 
                        text: "Analyze this nutrition label image carefully and extract all visible nutritional information."
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: imageDataUri,
                            detail: "high" // Request high detail analysis for nutrition labels
                        },
                    },
                ],
            },
        ];

        payload = {
            model: model,
            messages: visionMessages,
            max_tokens: 500, // Increased for more detailed nutrition analysis
            temperature: 0.1, // Lower temperature for more deterministic results
        };
        console.log(`Using model: ${model} for image analysis with high detail setting`);
    } else {
        console.log("Constructing payload for TEXT request.");
        payload = {
            model: model,
            messages: messages,
            max_tokens: 200,
            temperature: 0, // CHANGED to 0 for determinism
        };
        console.log(`Using model: ${model} for regular queries`);
    }
    // --- End of Payload Construction ---


    // --- Call OpenAI API ---
    console.log(`Calling OpenAI API with model: ${model}...`);
    const chatCompletion = await openai.chat.completions.create(payload);
    console.log("OpenAI API call successful.");
    // console.log("Raw OpenAI response:", JSON.stringify(chatCompletion)); // Keep commented unless deep debugging

    const responseContent = chatCompletion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("OpenAI response did not contain content.");
    }
    console.log("Extracted response content:", responseContent.substring(0, 100) + "..."); // Log start of content

    // --- Return Response --- 
    console.log("Returning successful response to client...");
    return new Response(
      // Return the full ChatCompletion object so client can parse choices[0].message.content
      JSON.stringify(chatCompletion),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error occurred:", error);
    return new Response(
      JSON.stringify({ error: error.message, details: error.stack }), // Include stack trace in details for debugging
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});

// To deploy: supabase functions deploy openai-proxy --no-verify-jwt 