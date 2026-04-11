'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Home,
  Server,
  MonitorSmartphone,
  QrCode,
  Wallet,
  PieChart,
  Compass,
  SlidersHorizontal,
  ShoppingBag,
  Hammer,
  Box,
  BookOpen,
  Route,
  Users,
  Tag,
  FileSignature,
  LogOut,
  Command,
  Menu,
  X,
  ChevronRight,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react'

// --- Configuration with Unique Icons & Role-Based Access ---
const allCoreModules = [
  { href: '/dashboard', label: 'Dashboard', icon: Home, roles: ['all'] }, 
  { href: '/topology', label: 'Topology', icon: Server, roles: ['owner', 'manager'] },
  { href: '/pos', label: 'Terminal', icon: MonitorSmartphone, roles: ['owner', 'manager', 'branch_manager', 'sales_person'] },
  { href: '/shadow-pos', label: 'SIS Terminal', icon: QrCode, roles: ['owner', 'manager', 'shadow_manager', 'shadow_sales'] },
  { href: '/sales', label: 'Revenue', icon: Wallet, roles: ['owner', 'manager', 'branch_manager'] },
  { href: '/reports', label: 'Analytics', icon: PieChart, roles: ['owner', 'manager'] },
  { href: '/discovery', label: 'Discovery', icon: Compass, roles: ['owner', 'manager', 'branch_manager', 'sales_person'] },
]

const allOperationModules = [
  { href: '/master', label: 'Master Config', icon: SlidersHorizontal, roles: ['owner', 'manager'] },
  { href: '/purchases', label: 'Procurement', icon: ShoppingBag, roles: ['owner', 'manager', 'operations_manager'] },
  { href: '/manufacturing/job-bags', label: 'Fabrication', icon: Hammer, roles: ['owner', 'manager', 'operations_manager'] },
  { href: '/inventory', label: 'Vault Stock', icon: Box, roles: ['owner', 'manager', 'operations_manager', 'branch_manager'] },
  { href: '/catalog', label: 'Catalog', icon: BookOpen, roles: ['owner', 'manager', 'operations_manager', 'branch_manager'] },
  { href: '/transfer', label: 'Logistics', icon: Route, roles: ['owner', 'manager', 'operations_manager', 'branch_manager', 'shadow_manager'] },
  { href: '/crm', label: 'CRM', icon: Users, roles: ['owner', 'manager', 'branch_manager', 'sales_person'] },
  { href: '/vouchers', label: 'Vouchers', icon: Tag, roles: ['owner', 'manager', 'voucher_manager'] },
  { href: '/memo', label: 'Memos', icon: FileSignature, roles: ['owner', 'manager'] },
]

export function AppLayout({ children, appUser }: { children: React.ReactNode, appUser?: any }) {
  const pathname = usePathname()
  const router = useRouter()
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(true) 

  if (pathname?.startsWith('/claim') || pathname?.startsWith('/login')) {
    return <div className="min-h-screen bg-white">{children}</div>
  }

  const userRole = appUser?.role || 'sales_person'
  
  const coreModules = useMemo(() => {
    return allCoreModules.filter(m => m.roles.includes('all') || m.roles.includes(userRole))
  }, [userRole])

  const operationModules = useMemo(() => {
    return allOperationModules.filter(m => m.roles.includes('all') || m.roles.includes(userRole))
  }, [userRole])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (path: string) => pathname?.startsWith(path)

  // MINIMALIST ONE UI NAV ITEM
  const NavItem = ({ item, isMobile = false, onClick }: any) => {
    const active = isActive(item.href)
    return (
      <Link
        href={item.href}
        onClick={onClick}
        title={isCollapsed && !isMobile ? item.label : undefined}
        className={cn(
          "flex items-center rounded-xl transition-all duration-200 group relative",
          isCollapsed && !isMobile ? "justify-center h-10 w-10 mx-auto mb-1.5" : "gap-3.5 px-3.5 py-2.5 mb-1",
          active 
            ? "bg-blue-50/60 text-blue-600" 
            : "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
          isMobile && "py-3.5 rounded-2xl"
        )}
      >
        <item.icon 
          strokeWidth={active ? 2.25 : 1.5} // Thin strokes for inactive, slightly bolder for active
          className={cn(
            "shrink-0 transition-all duration-200",
            isCollapsed && !isMobile ? "h-[18px] w-[18px]" : "h-[18px] w-[18px]",
            active ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
          )} 
        />
        
        {(!isCollapsed || isMobile) && (
          <span className={cn(
            "text-[13px] tracking-tight flex-1",
            active ? "font-bold" : "font-medium"
          )}>
            {item.label}
          </span>
        )}
        
        {isMobile && <ChevronRight className="w-4 h-4 ml-auto text-gray-300" strokeWidth={1.5} />}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col md:flex-row font-sans selection:bg-blue-100">
      
      {/* --- SLEEK SCROLLBAR OVERRIDE --- */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: transparent; border-radius: 10px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #E2E8F0; }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: transparent transparent; transition: scrollbar-color 0.3s; }
        .custom-scrollbar:hover { scrollbar-color: #E2E8F0 transparent; }
      `}} />

      {/* ========================================================== */}
      {/* 🖥️ DESKTOP SIDEBAR (Minimalist)                              */}
      {/* ========================================================== */}
      <aside className={cn(
        "hidden md:flex flex-col h-screen fixed left-0 top-0 border-r border-gray-200/50 bg-white z-50 transition-all duration-300 ease-out",
        isCollapsed ? "w-[76px]" : "w-[260px]"
      )}>
        
        {/* Sidebar Header & Toggle */}
        <div className={cn(
          "flex items-center h-16 shrink-0 px-3 transition-all",
          isCollapsed ? "justify-center" : "justify-between"
        )}>
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden w-full whitespace-nowrap pl-2.5">
              <div className="h-7 w-7 bg-gray-900 text-white flex items-center justify-center rounded-lg shrink-0">
                 <Command className="h-3.5 w-3.5" strokeWidth={2} />
              </div>
              <span className="font-bold text-[15px] tracking-tight text-gray-900">
                Biillo OS
              </span>
            </Link>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className="shrink-0 h-9 w-9 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
          >
            {isCollapsed ? <PanelLeft className="h-[18px] w-[18px]" strokeWidth={1.5} /> : <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.5} />}
          </Button>
        </div>

        {/* Scrollable Nav Area */}
        <div className="flex-1 overflow-y-auto py-3 space-y-6 custom-scrollbar overflow-x-hidden px-3">
           <div className="space-y-0.5">
             {!isCollapsed && (
               <p className="px-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5 whitespace-nowrap">Main</p>
             )}
             {coreModules.map((item) => <NavItem key={item.href} item={item} />)}
           </div>

           {operationModules.length > 0 && (
             <div className="space-y-0.5">
               {isCollapsed ? (
                 <div className="w-6 h-px bg-gray-100 mx-auto my-5" />
               ) : (
                 <>
                  <div className="h-px bg-gray-100/80 mx-3.5 my-5 w-auto" />
                  <p className="px-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5 whitespace-nowrap">Manage</p>
                 </>
               )}
               {operationModules.map((item) => <NavItem key={item.href} item={item} />)}
             </div>
           )}
        </div>

        {/* User Profile Footer */}
        <div className="p-3 shrink-0 bg-white">
          {isCollapsed ? (
            <div className="flex flex-col gap-2 items-center">
              <div 
                className="h-10 w-10 bg-gray-50 text-gray-600 border border-gray-100 rounded-full flex items-center justify-center shrink-0 uppercase font-semibold text-[13px] cursor-pointer hover:bg-gray-100 transition-colors" 
                title={appUser?.full_name || appUser?.email} 
                onClick={() => setIsCollapsed(false)}
              >
                {appUser?.full_name?.[0] || appUser?.email?.[0] || 'U'}
              </div>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full" onClick={handleLogout} title="Sign Out">
                <LogOut className="h-[18px] w-[18px] ml-0.5" strokeWidth={1.5} />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-2.5 rounded-[16px] bg-gray-50/80 hover:bg-gray-100 transition-colors cursor-default border border-transparent hover:border-gray-200/60">
              <div className="flex items-center gap-3 overflow-hidden pl-1">
                 <div className="h-9 w-9 bg-white text-gray-700 rounded-full flex items-center justify-center shrink-0 uppercase font-semibold text-[13px] shadow-sm border border-gray-100">
                   {appUser?.full_name?.[0] || appUser?.email?.[0] || 'U'}
                 </div>
                 <div className="flex flex-col truncate">
                   <span className="text-[13px] font-bold text-gray-900 truncate leading-tight">
                     {appUser?.full_name || appUser?.email?.split('@')[0] || 'User'}
                   </span>
                   <span className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold truncate leading-tight mt-0.5">
                     {appUser?.role?.replace('_', ' ') || 'Authorized'}
                   </span>
                 </div>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0 rounded-full" onClick={handleLogout} title="Sign Out">
                <LogOut className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================== */}
      {/* 📱 MOBILE HEADER                                           */}
      {/* ========================================================== */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white/90 backdrop-blur-md border-b border-gray-200/50 z-50 px-4 flex items-center justify-between shadow-sm">
         <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 bg-gray-900 text-white flex items-center justify-center rounded-lg shrink-0">
               <Command className="h-3.5 w-3.5" strokeWidth={2} />
            </div>
            <span className="font-bold text-[15px] tracking-tight text-gray-900">
              Biillo OS
            </span>
         </div>
         
         <button 
           onClick={() => setIsMobileMenuOpen(true)}
           className="flex items-center gap-2 p-1.5 pr-2.5 rounded-full bg-gray-50 hover:bg-gray-100 transition-colors"
         >
            <div className="h-6 w-6 rounded-full bg-white border border-gray-200 text-gray-700 flex items-center justify-center text-[10px] font-bold uppercase shadow-sm">
              {appUser?.full_name?.[0] || appUser?.email?.[0] || 'U'}
            </div>
            <Menu className="w-[18px] h-[18px] text-gray-600" strokeWidth={1.5} />
         </button>
      </header>

      {/* ========================================================== */}
      {/* 📱 MOBILE "MORE" MENU (Sheet Style)                        */}
      {/* ========================================================== */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-right-full duration-300 ease-out">
          
          <div className="h-16 flex items-center justify-between px-5 bg-white border-b border-gray-100">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full border border-gray-200 bg-gray-50 text-gray-700 flex items-center justify-center font-bold text-sm uppercase shadow-sm">
                 {appUser?.full_name?.[0] || appUser?.email?.[0] || 'U'}
               </div>
               <div>
                 <p className="font-bold text-sm text-gray-900 leading-tight">
                    {appUser?.full_name || appUser?.email}
                 </p>
                 <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-0.5">
                   {appUser?.role?.replace('_', ' ') || 'Authorized'}
                 </p>
               </div>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-gray-50 text-gray-500 hover:text-gray-900" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="w-[18px] h-[18px]" strokeWidth={1.5} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 bg-white custom-scrollbar">
            {operationModules.length > 0 && (
              <div className="bg-gray-50/50 p-2.5 rounded-[24px] border border-gray-100">
                 <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-3 pt-2">Management</h4>
                 <div className="space-y-0.5">
                   {operationModules.map((item) => (
                     <NavItem key={item.href} item={item} isMobile onClick={() => setIsMobileMenuOpen(false)} />
                   ))}
                 </div>
              </div>
            )}

            <div className="px-2">
               <Button 
                 variant="ghost" 
                 className="w-full justify-center h-12 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-none text-[13px] font-bold rounded-2xl" 
                 onClick={handleLogout}
               >
                 <LogOut className="w-[18px] h-[18px] mr-2" strokeWidth={2} /> Sign Out
               </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 📱 MOBILE BOTTOM NAV (Minimalist)                          */}
      {/* ========================================================== */}
      {coreModules.length > 0 && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-200/50 z-40 h-[68px] pb-safe safe-area-bottom">
          <div 
            className="grid h-full px-2" 
            style={{ gridTemplateColumns: `repeat(${coreModules.length}, minmax(0, 1fr))` }}
          >
              {coreModules.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                      key={item.href}
                      href={item.href}
                      className="flex flex-col items-center justify-center gap-1 active:scale-95 transition-all duration-200"
                  >
                      <div className={cn(
                        "p-1.5 rounded-full transition-all duration-300 ease-out",
                        active ? "bg-blue-50/80 text-blue-600 w-12 flex justify-center" : "bg-transparent text-gray-400"
                      )}>
                        <item.icon 
                          strokeWidth={active ? 2.25 : 1.5} 
                          className="w-[18px] h-[18px]" 
                        />
                      </div>
                      <span className={cn(
                        "text-[9px] tracking-tight text-center px-1 truncate w-full", 
                        active ? "font-bold text-blue-700" : "font-medium text-gray-500"
                      )}>
                          {item.label}
                      </span>
                  </Link>
                )
              })}
          </div>
        </nav>
      )}

      {/* ========================================================== */}
      {/* MAIN CONTENT AREA                                          */}
      {/* ========================================================== */}
      <main className={cn(
        "flex-1 flex flex-col min-h-screen transition-all duration-300 ease-out",
        "pt-14 pb-20 md:pt-0 md:pb-0", // Mobile top/bottom padding 
        isCollapsed ? "md:ml-[76px]" : "md:ml-[260px]" // Dynamic desktop left margin
      )}>
        {children}
      </main>

    </div>
  )
}