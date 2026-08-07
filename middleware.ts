import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

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

  // ALLOW PUBLIC PAGES TO BYPASS AUTHENTICATION
  if (
    path.startsWith('/api') || 
    path.startsWith('/_next') || 
    path.startsWith('/claim') ||
    path.startsWith('/storelocations') ||
    path.startsWith('/event') || 
    path.includes('.') 
  ) {
    return supabaseResponse
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && path !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && path === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role

    if (role === 'owner' || role === 'manager') {
      return supabaseResponse
    }

    if (path === '/dashboard' || path === '/') {
      return supabaseResponse
    }

    // ----------------------------------------------------
    // ROUTE DEFINITIONS
    // ----------------------------------------------------
    const isMasterRoute = path.startsWith('/master')
    const isAdminOverrideRoute = path.startsWith('/transfer/direct')
    
    const isCrmRoute = path.startsWith('/crm')
    
    // ✨ NEW: Split the Voucher routes to apply different rules
    const isVoucherTrackRoute = path.startsWith('/vouchers/track')
    const isGeneralVoucherRoute = path === '/vouchers' || (path.startsWith('/vouchers') && !isVoucherTrackRoute)
    
    const isOpsRoute = path.startsWith('/purchases') || path.startsWith('/manufacturing') || path.startsWith('/inventory') || path.startsWith('/transfer') || path.startsWith('/catalog')
    const isBranchManagerRoute = path.startsWith('/pos') || path.startsWith('/discovery') || path.startsWith('/sales') || path.startsWith('/inventory') || path.startsWith('/transfer') || path.startsWith('/catalog') || path.startsWith('/reports')
    const isSalesRoute = path.startsWith('/discovery') || path.startsWith('/pos') || path.startsWith('/catalog')

    // ----------------------------------------------------
    // STRICT DENIALS (Cross-role access prevention)
    // ----------------------------------------------------
    
    if (isMasterRoute || isAdminOverrideRoute) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Block non-CRM managers from the CRM module
    if (isCrmRoute && role !== 'crm_manager') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Block non-Voucher managers from the main Voucher module (Creation/Settings)
    if (isGeneralVoucherRoute && role !== 'voucher_manager') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // /vouchers/track is shared between Voucher Manager & CRM Manager ONLY
    if (isVoucherTrackRoute && role !== 'voucher_manager' && role !== 'crm_manager') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // ----------------------------------------------------
    // ALLOWLISTS (Keeping roles inside their sandboxes)
    // ----------------------------------------------------
    
    // ✨ Rule: CRM Manager
    // They are ONLY allowed in /crm OR /vouchers/track
    if (role === 'crm_manager') {
      if (!isCrmRoute && !isVoucherTrackRoute) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    // ✨ Rule: Voucher Manager
    // They are allowed in ALL /vouchers/* routes (General + Track)
    if (role === 'voucher_manager') {
      if (!isGeneralVoucherRoute && !isVoucherTrackRoute) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
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

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|api|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}