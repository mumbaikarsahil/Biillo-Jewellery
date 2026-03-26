import { createBrowserClient } from '@supabase/ssr'

// By using createBrowserClient instead of the standard createClient, 
// Supabase will automatically sync your session to browser Cookies 
// so the middleware can actually see it!
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)