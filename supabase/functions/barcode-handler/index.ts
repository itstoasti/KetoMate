import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Define the expected structure for saving data
interface SavePayload {
  barcode: string;
  name: string;
  serving_size?: string;
  calories?: number;
  carbs?: number;
  protein?: number;
  fat?: number;
}

console.log(`Function "barcode-handler" up and running!`);

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
    console.log(`[barcode-handler] Received Authorization Header: ${authHeader ? 'Present' : 'Missing'}`);
    if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing Authorization Header' }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
        });
    }

    // Create client using helper function (uses ANON key)
    const supabase = getSupabaseClient(req);

    // --- Get User ID (needed for INSERT check) --- 
    // We still need to verify the user is valid before proceeding
    const { data: { user }, error: getUserError } = await supabase.auth.getUser(); 
    
    if (getUserError) {
        console.error("[barcode-handler] Error calling getUser:", getUserError.message);
        return new Response(JSON.stringify({ error: `Authentication error: ${getUserError.message}` }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
        });
    }
    if (!user) {
        console.error("[barcode-handler] User object is null, authentication failed.");
        return new Response(JSON.stringify({ error: 'User not authenticated' }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
        });
    }
    const userId = user.id;
    console.log(`[barcode-handler] Authenticated user ID: ${userId}`);
    // --- End Get User ID --- 

    if (req.method === 'GET') {
        // --- LOOKUP Logic ---
        console.log(`[barcode-handler] Entered GET handler.`);
        const url = new URL(req.url);
        console.log(`[barcode-handler] Parsed URL: ${url.pathname}${url.search}`);
        const barcode = url.searchParams.get('barcode');
        console.log(`[barcode-handler] Extracted barcode parameter: ${barcode}`);

        if (!barcode) {
            console.log(`[barcode-handler] Barcode parameter is missing.`);
            return new Response(JSON.stringify({ error: 'Missing barcode parameter' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }
        console.log(`[barcode-handler] Lookup request for barcode: ${barcode}`);
        
        // Query using the user-context client (respects RLS)
        console.log(`[barcode-handler] Attempting Supabase lookup...`);
        const { data, error } = await supabase
            .from('shared_barcode_data')
            .select('name, serving_size, calories, carbs, protein, fat')
            .eq('barcode', barcode)
            .maybeSingle(); 

        if (error) {
            console.error("[barcode-handler] Supabase lookup error:", error.message);
            throw new Error(`Supabase lookup failed: ${error.message}`);
        }

        console.log(`[barcode-handler] Supabase lookup finished. Data found: ${!!data}`);

        if (data) {
            console.log(`[barcode-handler] Found data for barcode ${barcode}`);
            // Found data, return it in a format similar to Food type
            const foodData = {
                status: 'found_shared', // Indicate source
                name: data.name,
                brand: 'User Submitted', // Or could store submitter name/ID if desired
                servingSize: data.serving_size || 'N/A',
                macros: {
                    calories: data.calories || 0,
                    carbs: data.carbs || 0,
                    protein: data.protein || 0,
                    fat: data.fat || 0,
                },
                 // We can add isKetoFriendly logic here if needed, based on shared data
                 // isKetoFriendly: isKetoFriendly({carbs: data.carbs || 0, ...})
            };
             return new Response(JSON.stringify(foodData), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        } else {
             console.log(`[barcode-handler] No shared data found for barcode ${barcode}`);
            // Not found in shared data
            return new Response(JSON.stringify({ status: 'not_found' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200, // Return 200 even if not found, client checks status
            });
        }

    } else if (req.method === 'POST') {
        // --- SAVE Logic ---
        const payload: SavePayload = await req.json();
        console.log(`[barcode-handler] Save request for barcode: ${payload.barcode}`);

        if (!payload.barcode || !payload.name) {
             return new Response(JSON.stringify({ error: 'Missing required fields: barcode, name' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }
        
        const dataToUpsert = {
            barcode: payload.barcode,
            name: payload.name,
            serving_size: payload.serving_size,
            calories: payload.calories,
            carbs: payload.carbs,
            protein: payload.protein,
            fat: payload.fat,
            submitted_by_user_id: userId, // We have the userId from getUser() above
        };

        // Upsert using the user-context client (RLS check requires submitted_by_user_id)
        const { error } = await supabase
            .from('shared_barcode_data')
            .upsert(dataToUpsert, { onConflict: 'barcode' }); 

        if (error) {
            console.error("Supabase upsert error:", error); // Log RLS errors here if they happen
            if (error.message.includes('violates row-level security policy')) {
                 return new Response(JSON.stringify({ error: 'Permission denied to save data.' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 403, // Forbidden
                });
            }
            throw error; 
        }

        console.log(`[barcode-handler] Successfully saved/updated data for barcode ${payload.barcode}`);
        return new Response(JSON.stringify({ status: 'saved' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 201, // 201 Created (or 200 OK if updated)
        });

    } else {
         return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 405,
        });
    }

  } catch (error) {
    console.error("[barcode-handler] Caught error in main handler:", error?.message || String(error));
    console.error("[barcode-handler] Error details (stringified):", JSON.stringify(error, null, 2));

    return new Response(JSON.stringify({ error: error?.message || 'An unexpected error occurred.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
