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
    const isVoucherRoute = path.startsWith('/vouchers')
    
    const isRestrictedVoucherSubRoute = 
      path.startsWith('/vouchers/generate') || 
      path.startsWith('/vouchers/batches') || 
      path.startsWith('/vouchers/distribute') || 
      path.startsWith('/vouchers/return') || 
      path.startsWith('/vouchers/distributors')
    
    const isOpsRoute = path.startsWith('/purchases') || path.startsWith('/manufacturing') || path.startsWith('/inventory') || path.startsWith('/transfer') || path.startsWith('/catalog')
    const isBranchManagerRoute = path.startsWith('/pos') || path.startsWith('/discovery') || path.startsWith('/sales') || path.startsWith('/inventory') || path.startsWith('/transfer') || path.startsWith('/catalog') || path.startsWith('/reports') || path.startsWith('/crm')
    const isSalesRoute = path.startsWith('/discovery') || path.startsWith('/pos') || path.startsWith('/catalog') || path.startsWith('/crm')
    
    // ✨ NEW: Define E-Commerce Route
    const isEcommerceRoute = path.startsWith('/ecommerce')
    const isCashbookRoute = path.startsWith('/cashbook')

    // STRICT DENIALS (Cross-role access prevention)
    // ----------------------------------------------------
    
    if (isMasterRoute || isAdminOverrideRoute) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    if (isCrmRoute && !['crm_manager', 'branch_manager', 'sales_person'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    if (isVoucherRoute) {
      if (role === 'crm_manager') {
        if (isRestrictedVoucherSubRoute) {
          return NextResponse.redirect(new URL('/vouchers', request.url))
        }
      } else if (role !== 'voucher_manager') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    if ((role === 'branch_manager' || role === 'shadow_manager') && !isBranchManagerRoute) {
      // ✨ ALLOW branch managers to access the cashbook route as well
      if (role === 'branch_manager' && isCashbookRoute) {
        return supabaseResponse;
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    
    // Ensure other restricted roles cannot access the cashbook
    if ((role === 'sales_person' || role === 'shadow_sales') && !isSalesRoute) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    
    // If any other role tries to access cashbook (like Operations Manager, Voucher Manager)
    if (isCashbookRoute && !['owner', 'manager', 'branch_manager'].includes(role)) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // ----------------------------------------------------
    // ALLOWLISTS (Keeping roles inside their sandboxes)
    // ----------------------------------------------------
    
    if (role === 'crm_manager') {
      if (!isCrmRoute && !isVoucherRoute) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    if (role === 'voucher_manager') {
      if (!isVoucherRoute) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    // ✨ NEW: E-Commerce Manager Sandbox
    if (role === 'ecommerce_manager') {
      if (!isEcommerceRoute) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    if (role === 'operations_manager' && !isOpsRoute) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    if ((role === 'branch_manager' || role === 'shadow_manager') && !isBranchManagerRoute) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

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