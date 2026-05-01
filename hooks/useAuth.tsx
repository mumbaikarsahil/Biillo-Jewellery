'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

// --- Restored AppUser Interface ---
// We keep user_id and company_id so it doesn't break the rest of your ERP!
export interface AppUser {
  id: string
  user_id: string          // Restored for backward compatibility
  company_id: string       // Restored for backward compatibility
  email: string
  full_name: string
  role: string
  warehouse_id: string | null
  warehouse_ids?: string[] // Restored for backward compatibility
}

interface AuthContextType {
  appUser: AppUser | null
  loading: boolean
  error: string | null
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  appUser: null,
  loading: true,
  error: null,
  refreshAuth: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const pathname = usePathname()

  const fetchUser = async () => {
    try {
      setLoading(true)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setAppUser(null)
        
        // ✨ FIX: Robust check for public routes, including dynamic ones like /event/A
        const isPublicRoute = pathname && (
          ['/login', '/register', '/forgot-password', '/claim'].includes(pathname) ||
          pathname.startsWith('/storelocations') ||
          pathname.startsWith('/event')
        );

        if (!isPublicRoute) {
          router.push('/login')
        }
        return 
      }

      // 1. Fetch from our NEW profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profileError || !profileData) {
        console.error('Profile missing', profileError)
        setError('User profile not found. Please contact admin.')
        return
      }

      if (profileData.is_active === false) {
         setError('Your account has been suspended.')
         await supabase.auth.signOut()
         router.push('/login')
         return
      }

      // 2. Fetch Legacy company_id (so older pages don't break)
      const { data: legacyData } = await supabase
        .from('app_users')
        .select('company_id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      // 3. Set the global AppUser state with backward-compatible fields
      setAppUser({
        id: session.user.id,
        user_id: session.user.id, // Maps id to user_id for older pages
        company_id: legacyData?.company_id || '', // Restores company_id
        email: session.user.email || '',
        full_name: profileData.full_name || '',
        role: profileData.role,
        warehouse_id: profileData.warehouse_id,
        warehouse_ids: profileData.warehouse_id ? [profileData.warehouse_id] : [],
      })
      
      setError(null)

    } catch (err: any) {
      console.error('Auth error:', err)
      setError(err.message || 'Unknown auth error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setAppUser(null)
        // Ensure they are not pushed to login if they just signed out from a public page
        const isPublicRoute = pathname && (
          ['/login', '/register', '/forgot-password', '/claim'].includes(pathname) ||
          pathname.startsWith('/storelocations') ||
          pathname.startsWith('/event')
        );
        if (!isPublicRoute) router.push('/login')
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchUser()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) 

  return (
    <AuthContext.Provider value={{ appUser, loading, error, refreshAuth: fetchUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}