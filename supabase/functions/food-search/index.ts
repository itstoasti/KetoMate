import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log(`Function "food-search" up and running!`);

// Helper to get Supabase client configured with user's auth context
function getSupabaseClient(req: Request): SupabaseClient {
    const authHeader = req.headers.get('Authorization')!;
    // Use ANON KEY - RLS will be enforced based on the JWT in authHeader
    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '', // Use Anon key
        { 
            global: { headers: { Authorization: authHeader } },
            auth: { persistSession: false } 
        }
    );
    return supabaseClient;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization');
    console.log(`[food-search] Received Authorization Header: ${authHeader ? 'Present' : 'Missing'}`);
    if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing Authorization Header' }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
        });
    }

    // Create client using helper function (uses ANON key)
    const supabase = getSupabaseClient(req);

    // --- Get User ID (needed for authentication) --- 
    const { data: { user }, error: getUserError } = await supabase.auth.getUser(); 
    
    if (getUserError) {
        console.error("[food-search] Error calling getUser:", getUserError.message);
        return new Response(JSON.stringify({ error: `Authentication error: ${getUserError.message}` }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
        });
    }
    if (!user) {
        console.error("[food-search] User object is null, authentication failed.");
        return new Response(JSON.stringify({ error: 'User not authenticated' }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
        });
    }
    const userId = user.id;
    console.log(`[food-search] Authenticated user ID: ${userId}`);
    // --- End Get User ID --- 

    if (req.method === 'GET') {
        // --- SEARCH Logic ---
        console.log(`[food-search] Entered GET handler.`);
        const url = new URL(req.url);
        console.log(`[food-search] Parsed URL: ${url.pathname}${url.search}`);
        const searchTerm = url.searchParams.get('query');
        console.log(`[food-search] Extracted search term: ${searchTerm}`);

        if (!searchTerm) {
            console.log(`[food-search] Search term is missing.`);
            return new Response(JSON.stringify({ error: 'Missing search term' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }
        
        // Query the shared_barcode_data table with ILIKE for fuzzy text searching
        console.log(`[food-search] Searching for: ${searchTerm}`);
        const { data, error } = await supabase
            .from('shared_barcode_data')
            .select('barcode, name, serving_size, calories, carbs, protein, fat')
            .ilike('name', `%${searchTerm}%`) // Case-insensitive pattern matching
            .limit(20); // Limit to 20 results for performance

        if (error) {
            console.error("[food-search] Supabase search error:", error.message);
            throw new Error(`Supabase search failed: ${error.message}`);
        }

        console.log(`[food-search] Search finished. Found ${data?.length || 0} results.`);

        if (data && data.length > 0) {
            // Map the results to a format similar to the Food type
            const foodItems = data.map(item => ({
                id: `shared_${item.barcode}`,
                name: item.name,
                brand: 'User Submitted',
                servingSize: item.serving_size || 'N/A',
                macros: {
                    calories: item.calories || 0,
                    carbs: item.carbs || 0,
                    protein: item.protein || 0,
                    fat: item.fat || 0,
                },
                barcode: item.barcode,
                ketoRating: determineKetoRating(item.carbs || 0),
                dateAdded: new Date().toISOString(),
                description: 'Data from shared user database.',
            }));

            return new Response(JSON.stringify({ 
                status: 'success',
                count: foodItems.length,
                items: foodItems 
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        } else {
            console.log(`[food-search] No results found for: ${searchTerm}`);
            return new Response(JSON.stringify({ 
                status: 'success',
                count: 0,
                items: [] 
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }
    } else {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 405,
        });
    }
  } catch (error) {
    console.error("[food-search] Caught error in main handler:", error?.message || String(error));
    console.error("[food-search] Error details (stringified):", JSON.stringify(error, null, 2));

    return new Response(JSON.stringify({ error: error?.message || 'An unexpected error occurred.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// Helper function to determine keto rating based on carbs
function determineKetoRating(netCarbs: number): 'Keto-Friendly' | 'Limit' | 'Strictly Limit' | 'Avoid' {
    if (netCarbs <= 5) return 'Keto-Friendly';
    if (netCarbs <= 10) return 'Limit';
    if (netCarbs <= 15) return 'Strictly Limit';
    return 'Avoid';
} 