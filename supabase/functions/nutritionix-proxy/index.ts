import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Define the expected structure for the Nutritionix API response and our Food type
// (Should match the types used in the main app if possible, simplify if needed)
type NutritionixMacro = {
  carbs: number | null;
  protein: number | null;
  fat: number | null;
  calories: number | null;
};

type NutritionixFood = {
  id: string;
  name: string;
  brand: string | null;
  servingSize: string;
  macros: NutritionixMacro;
  barcode?: string;
  dateAdded: string;
  isKetoFriendly: boolean;
};

// Basic keto check helper (duplicate from foodService for now, ideally share types/logic)
const isKetoFriendly = (macros: NutritionixMacro): boolean => {
  const carbs = macros.carbs ?? 0;
  const fat = macros.fat ?? 0;
  const protein = macros.protein ?? 0;
  return carbs <= 5 && fat > 0 && fat >= protein;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Retrieve both App ID and API Key from secrets
    const appId = Deno.env.get("NUTRITIONIX_APP_ID");
    const apiKey = Deno.env.get("NUTRITIONIX_API_KEY");
    
    if (!appId) {
      throw new Error("Missing environment variable NUTRITIONIX_APP_ID");
    }
    if (!apiKey) {
      throw new Error("Missing environment variable NUTRITIONIX_API_KEY");
    }

    const { query, barcode } = await req.json();
    const baseUrl = "https://api.nutritionix.com/v1_1";
    let apiUrl = "";
    let isSearch = false;

    if (query) {
      // Use correct appId and appKey parameters
      apiUrl = `${baseUrl}/search/${encodeURIComponent(query)}?appId=${appId}&appKey=${apiKey}&fields=item_name,brand_name,nf_calories,nf_total_fat,nf_protein,nf_total_carbohydrate,nf_serving_size_qty,nf_serving_size_unit&limit=10`;
      isSearch = true;
    } else if (barcode) {
      // Use correct appId and appKey parameters
      apiUrl = `${baseUrl}/item?upc=${encodeURIComponent(barcode)}&appId=${appId}&appKey=${apiKey}`;
      isSearch = false;
    } else {
      throw new Error("Request body must contain either 'query' or 'barcode'.");
    }

    console.log(`[nutritionix-proxy] Calling Nutritionix API: ${apiUrl}`);
    const nutritionixResponse = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!nutritionixResponse.ok) {
      const errorBody = await nutritionixResponse.text();
      console.error(`[nutritionix-proxy] Nutritionix API error (${nutritionixResponse.status}): ${errorBody}`);
      throw new Error(`Nutritionix API request failed with status ${nutritionixResponse.status}`);
    }

    const data = await nutritionixResponse.json();
    console.log("[nutritionix-proxy] Received data from Nutritionix.");

    let results: NutritionixFood[] = [];

    if (isSearch && data.hits) {
      // Transform search results
      results = data.hits.map((item: any): NutritionixFood => {
        const macros: NutritionixMacro = {
          carbs: item.fields.nf_total_carbohydrate ?? null,
          protein: item.fields.nf_protein ?? null,
          fat: item.fields.nf_total_fat ?? null,
          calories: item.fields.nf_calories ?? null,
        };
        return {
          id: item._id,
          name: item.fields.item_name,
          brand: item.fields.brand_name ?? null,
          servingSize: `${item.fields.nf_serving_size_qty ?? ''} ${item.fields.nf_serving_size_unit ?? ''}`.trim(),
          macros,
          dateAdded: new Date().toISOString(),
          isKetoFriendly: isKetoFriendly(macros),
        };
      });
    } else if (!isSearch && data) {
      // Transform single item result (barcode lookup)
      const item = data;
      const macros: NutritionixMacro = {
        carbs: item.nf_total_carbohydrate ?? null,
        protein: item.nf_protein ?? null,
        fat: item.nf_total_fat ?? null,
        calories: item.nf_calories ?? null,
      };
      results.push({
        id: item._id || `barcode_${barcode}`,
        name: item.item_name,
        brand: item.brand_name ?? null,
        servingSize: `${item.nf_serving_size_qty ?? ''} ${item.nf_serving_size_unit ?? ''}`.trim(),
        macros,
        barcode: barcode,
        dateAdded: new Date().toISOString(),
        isKetoFriendly: isKetoFriendly(macros),
      });
    }

    console.log(`[nutritionix-proxy] Returning ${results.length} processed results.`);
    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[nutritionix-proxy] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}); 