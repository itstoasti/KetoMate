import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import OpenAI from "https://deno.land/x/openai@v4.52.7/mod.ts";

// Ensure you have set the OPENAI_API_KEY secret in your Supabase project secrets
// supabase secrets set OPENAI_API_KEY <your-key>

serve(async (req: Request) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === "OPTIONS") {
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

    // --- IMPORTANT: Adapt this based on your app's request ---
    // Expecting a JSON body with a 'messages' array or similar.
    // Adjust 'messages' if your app sends a different structure (e.g., 'prompt').
    console.log("Parsing request body...");
    const { messages } = await req.json();
    if (!messages) {
      console.error("Request body missing 'messages' array.");
      throw new Error("Request body must contain 'messages' array.");
    }
    console.log("Request body parsed successfully.");
    // --- End of adaptation section ---


    // --- Call OpenAI API ---
    // Adapt the model and other parameters as needed for your use case.
    console.log("Calling OpenAI API...");
    const chatCompletion = await openai.chat.completions.create({
      messages: messages, // Use the messages received from the app
      model: "gpt-4o", // Or your preferred model
      // Add any other parameters like max_tokens, temperature, etc.
    });
    console.log("OpenAI API call successful.");
    // --- End of OpenAI Call ---

    // Extract the content from the first choice
    console.log("Raw OpenAI response:", JSON.stringify(chatCompletion));
    const responseData = chatCompletion.choices[0]?.message?.content;

    if (!responseData) {
        console.error("No response content received from OpenAI.");
        throw new Error("No response content received from OpenAI.");
    }

    console.log("Extracted response content:", responseData);

    console.log("Returning successful response to client...");
    return new Response(
      JSON.stringify({ response: responseData }), // Send only the content back
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error occurred:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400, // Or 500 for internal server errors
      }
    );
  }
});

// To deploy: supabase functions deploy openai-proxy --no-verify-jwt 