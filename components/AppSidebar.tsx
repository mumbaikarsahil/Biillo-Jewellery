'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Database,
  Package,
  ArrowRightLeft,
  Briefcase,
  ShoppingCart,
  FileText,
  Banknote,
  BarChart3,
  LogOut,
  UserCircle,
  Menu,
  X,
  ChevronRight,
  Settings
} from 'lucide-react'

// --- Configuration ---

// 1. PRIMARY ITEMS: Appear in Desktop Sidebar AND Mobile Bottom Bar
const primaryNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pos', label: 'POS', icon: ShoppingCart },
  { href: '/sales', label: 'Sales', icon: Banknote },
  { href: '/purchases', label: 'Purchases', icon: ShoppingCart },
  { href: '/inventory', label: 'Inventory', icon: Package },
]

// 2. SECONDARY ITEMS: Appear in Desktop Sidebar BUT hidden in Mobile Bottom Bar (Moved to Header Menu)
const secondaryNav = [
  { href: '/master', label: 'Master Setup', icon: Database },
  { href: '/purchases', label: 'Purchases', icon: ShoppingCart },
  { href: '/transfer', label: 'Transfers', icon: ArrowRightLeft },
  { href: '/job-bags', label: 'Job Bags', icon: Briefcase },
  { href: '/memo', label: 'Memo', icon: FileText },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
]

// Combine for Desktop Sidebar
const allDesktopItems = [...primaryNav, ...secondaryNav]

export function AppLayout({ children, appUser }: { children: React.ReactNode, appUser?: any }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (path: string) => pathname?.startsWith(path)

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col md:flex-row">
      
      {/* ========================================================== */}
      {/* 🖥️ DESKTOP SIDEBAR (Fixed Left)                           */}
      {/* ========================================================== */}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 border-r bg-white z-50 shadow-sm">
        <div className="h-16 flex items-center px-6 border-b">
           <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
              💎 <span className="text-foreground">Biillo</span>Jewel
           </Link>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
           {allDesktopItems.map((item) => (
             <Link
               key={item.href}
               href={item.href}
               className={cn(
                 "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 group",
                 isActive(item.href) 
                   ? "bg-primary/10 text-primary" 
                   : "text-muted-foreground hover:bg-muted hover:text-foreground"
               )}
             >
               <item.icon className={cn("w-4 h-4", isActive(item.href) ? "text-primary" : "text-muted-foreground")} />
               {item.label}
             </Link>
           ))}
        </div>

        <div className="p-4 border-t bg-gray-50/50">
            <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <UserCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{appUser?.email || 'User'}</p>
                    <p className="text-xs text-muted-foreground capitalize">{appUser?.role || 'Staff'}</p>
                </div>
            </div>
            <Button 
                variant="outline" 
                className="w-full justify-start text-muted-foreground hover:text-red-600 hover:bg-red-50 hover:border-red-100" 
                onClick={handleLogout}
            >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
            </Button>
        </div>
      </aside>

      {/* ========================================================== */}
      {/* 📱 MOBILE HEADER (Top Bar)                                */}
      {/* ========================================================== */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b z-50 px-4 flex items-center justify-between shadow-sm">
         <div className="flex items-center gap-2 font-bold text-lg">
            💎 Biillo Jewel
         </div>
         
         {/* User Profile Trigger - Opens the "More" Menu */}
         <button 
           onClick={() => setIsMobileMenuOpen(true)}
           className="flex items-center gap-2 p-1 pr-3 rounded-full border bg-gray-50 hover:bg-gray-100 transition-colors"
         >
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
              {appUser?.email?.[0].toUpperCase() || 'U'}
            </div>
            <Menu className="w-4 h-4 text-gray-500" />
         </button>
      </header>

      {/* ========================================================== */}
      {/* 📱 MOBILE "MORE" MENU (Slide-over / Full Screen)          */}
      {/* ========================================================== */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-right-full duration-200">
          
          {/* Menu Header */}
          <div className="h-16 border-b flex items-center justify-between px-4 bg-gray-50">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-lg">
                 {appUser?.email?.[0].toUpperCase() || 'U'}
               </div>
               <div>
                  <p className="font-semibold text-sm">{appUser?.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{appUser?.role || 'Staff Member'}</p>
               </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="w-6 h-6" />
            </Button>
          </div>

          {/* Menu Links - Specifically the Secondary Ones */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {/* Group 1: Quick Actions (Secondary Nav) */}
            <div>
               <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Menu</h4>
               <div className="space-y-1">
                 {secondaryNav.map((item) => (
                   <Link
                     key={item.href}
                     href={item.href}
                     onClick={() => setIsMobileMenuOpen(false)}
                     className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all"
                   >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-md">
                          <item.icon className="w-5 h-5" />
                        </div>
                        <span className="font-medium text-gray-700">{item.label}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                   </Link>
                 ))}
               </div>
            </div>

            {/* Group 2: Account */}
            <div>
               <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Account</h4>
               <Button variant="outline" className="w-full justify-start mb-2" onClick={() => router.push('/settings')}>
                 <Settings className="w-4 h-4 mr-2" /> Settings
               </Button>
               <Button 
                 variant="destructive" 
                 className="w-full justify-start bg-red-50 text-red-600 hover:bg-red-100 border-red-100 hover:border-red-200" 
                 onClick={handleLogout}
               >
                 <LogOut className="w-4 h-4 mr-2" /> Sign Out
               </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 📱 MOBILE BOTTOM NAV (Fixed Bottom)                       */}
      {/* ========================================================== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-40 h-16 pb-safe safe-area-bottom">
        <div className="grid grid-cols-4 h-full">
            {primaryNav.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                        "flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform",
                        isActive(item.href) ? "text-indigo-600" : "text-gray-400"
                    )}
                >
                    <item.icon className={cn("w-6 h-6", isActive(item.href) && "fill-current/10")} />
                    <span className="text-[10px] font-medium">
                        {item.label}
                    </span>
                </Link>
            ))}
        </div>
      </nav>

      {/* ========================================================== */}
      {/* MAIN CONTENT AREA                                         */}
      {/* ========================================================== */}
      <main className="flex-1 min-h-screen 
        pt-20 pb-20 px-4       /* Mobile Padding */
        md:pt-8 md:pb-8 md:px-8 /* Desktop Padding */
        md:ml-64               /* Push content right on desktop */
      ">
        {children}
      </main>

    </div>
  )
}