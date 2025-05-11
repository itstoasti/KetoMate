## Deploying New Supabase Functions

### Food Search Function

To deploy the new food search function for the shared database search feature:

1. Make sure Docker Desktop is running
2. Open a terminal in the project root
3. Run the following command:

```bash
npx supabase functions deploy food-search
```

This will deploy the function to your Supabase project, enabling users to search for food items in the shared database. 