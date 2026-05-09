import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Initialize the response object
  let supabaseResponse = NextResponse.next({
    request,
  })

  // 2. Create the Supabase client for the Edge Runtime
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const path = request.nextUrl.pathname

  // ✨ ALLOW PUBLIC PAGES TO BYPASS AUTHENTICATION
  if (
    path.startsWith('/api') || 
    path.startsWith('/_next') || 
    path.startsWith('/claim') ||
    path.startsWith('/storelocations') ||
    path.startsWith('/event') || // ✨ NEW: Allows /event/A, /event/B, etc.
    path.includes('.') // bypasses files like favicon.ico, images, etc.
  ) {
    return supabaseResponse
  }

  // 3. Check for an active user session
  const { data: { user } } = await supabase.auth.getUser()

  // If not logged in and trying to access anything other than login, kick them out
  if (!user && path !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If logged in and trying to access the login page, send to dashboard
  if (user && path === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // 4. Role-Based Route Protection
  if (user) {
    // Fetch the user's role from the profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role

    // Owners and Managers get a free pass to everything
    if (role === 'owner' || role === 'manager') {
      return supabaseResponse
    }

    // Define route groups
    const isMasterRoute = path.startsWith('/master')
    
    // --- NEW: Identify the admin override routes ---
    const isAdminOverrideRoute = path.startsWith('/transfer/direct')
    
    const isVoucherRoute = path.startsWith('/vouchers')
    const isOpsRoute = path.startsWith('/purchases') || path.startsWith('/manufacturing') || path.startsWith('/inventory') || path.startsWith('/transfer') || path.startsWith('/catalog')
    
    // ✨ FIX: Added path.startsWith('/reports') to the Branch Manager route group
    const isBranchManagerRoute = path.startsWith('/pos') || path.startsWith('/discovery') || path.startsWith('/sales') || path.startsWith('/inventory') || path.startsWith('/crm') || path.startsWith('/transfer') || path.startsWith('/catalog') || path.startsWith('/reports')
    
    const isSalesRoute = path.startsWith('/discovery') || path.startsWith('/pos') || path.startsWith('/crm') || path.startsWith('/catalog')
    
    // Everyone is allowed on the dashboard
    if (path === '/dashboard' || path === '/') {
      return supabaseResponse
    }

    // --- UPDATED STRICT DENY ---
    // No one except Owner/Manager can access Master settings OR Admin Overrides
    if (isMasterRoute || isAdminOverrideRoute) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Rule: Voucher Manager
    if (role === 'voucher_manager' && !isVoucherRoute) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Rule: Operations Manager
    if (role === 'operations_manager' && !isOpsRoute) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Rule: Branch Manager & Shadow Manager
    if ((role === 'branch_manager' || role === 'shadow_manager') && !isBranchManagerRoute) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Rule: Sales Person & Shadow Sales
    if ((role === 'sales_person' || role === 'shadow_sales') && !isSalesRoute) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

// Ensure the middleware runs on all routes except static files
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}