'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

// --- Types ---
export interface AppUser {
  user_id: string
  company_id: string
  role: 'owner' | 'manager' | 'sales' | 'karigar' | 'admin'
  email: string
  full_name?: string
  warehouse_ids?: string[]
}

interface AuthContextType {
  appUser: AppUser | null
  loading: boolean
  error: string | null
  refreshAuth: () => Promise<void>
}

// --- Context Creation ---
const AuthContext = createContext<AuthContextType>({
  appUser: null,
  loading: true,
  error: null,
  refreshAuth: async () => {},
})

// --- Provider Component ---
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname() // Add pathname to prevent loops

  const fetchUser = async () => {
    try {
      setLoading(true)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setAppUser(null)
        // Only redirect if NOT on public pages to avoid infinite loops
        if (!['/login', '/register', '/forgot-password'].includes(pathname || '')) {
             router.push('/login')
        }
        return
      }

      // 1. Fetch App User Profile
      const { data: appUserData, error: appUserError } = await supabase
        .from('app_users')
        .select('user_id, company_id, role')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (appUserError || !appUserData) {
        // User is logged in but has no profile (e.g. half-setup account)
        console.error('Profile missing', appUserError)
        setError('User profile not found')
        return
      }

      // 2. Fetch Warehouse Mappings
      const { data: warehouseData } = await supabase
        .from('user_warehouse_mapping')
        .select('warehouse_id')
        .eq('user_id', session.user.id)

      const warehouse_ids = warehouseData?.map((w: any) => w.warehouse_id) || []

      setAppUser({
        user_id: session.user.id,
        email: session.user.email || '',
        company_id: appUserData.company_id,
        role: appUserData.role,
        full_name: session.user.user_metadata?.full_name,
        warehouse_ids,
      })
      
      setError(null)

    } catch (err: any) {
      console.error('Auth error:', err)
      setError(err.message || 'Unknown auth error')
    } finally {
      setLoading(false)
    }
  }

  // Initial Fetch
  useEffect(() => {
    fetchUser()

    // Listen for auth state changes (e.g. sign out / sign in)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setAppUser(null)
        router.push('/login')
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchUser()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ appUser, loading, error, refreshAuth: fetchUser }}>
      {children}
    </AuthContext.Provider>
  )
}

// --- Hook to use the Context ---
export function useAuth() {
  return useContext(AuthContext)
}