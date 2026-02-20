'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from '@/hooks/useAuth' // Adjust path if needed
import { AppLayout } from '@/components/AppLayout'

// List of public routes where Sidebar should NOT appear
const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password']

function InnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { appUser, loading } = useAuth()
  
  // Check if current page is a public route
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route))

  // 1. Show Loading State
  if (loading) {
     return <div className="h-screen w-full flex items-center justify-center bg-gray-50 text-muted-foreground">Loading ERP...</div>
  }

  // 2. If on Login page, just render content (No Sidebar)
  if (isPublicRoute) {
    return <>{children}</>
  }

  // 3. Otherwise, render the App Layout (Sidebar + Header)
  return (
    <AppLayout appUser={appUser}>
       {children}
    </AppLayout>
  )
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
       <InnerLayout>{children}</InnerLayout>
       <Toaster position="top-right" />
    </AuthProvider>
  )
}