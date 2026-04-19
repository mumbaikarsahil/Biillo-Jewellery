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
  LogOut,
  Command,
  Menu,
  X,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Building2
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
]

export function AppLayout({ children, appUser }: { children: React.ReactNode, appUser?: any }) {
  const pathname = usePathname()
  const router = useRouter()
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(true) 

  if (pathname?.startsWith('/claim') || pathname?.startsWith('/login') || pathname?.startsWith('/storelocations')) {
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
          "flex items-center rounded-lg transition-all duration-200 group relative",
          isCollapsed && !isMobile ? "justify-center h-10 w-10 mx-auto mb-2" : "gap-3 px-3 py-2.5 mb-1",
          active 
            ? "bg-slate-900 text-white shadow-md" 
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
          isMobile && "py-3.5 rounded-xl"
        )}
      >
        <item.icon 
          strokeWidth={active ? 2.5 : 2} 
          className={cn(
            "shrink-0 transition-all duration-200",
            isCollapsed && !isMobile ? "h-[18px] w-[18px]" : "h-4 w-4",
            active ? "text-white" : "text-slate-400 group-hover:text-slate-700"
          )} 
        />
        
        {(!isCollapsed || isMobile) && (
          <span className={cn(
            "text-[13px] flex-1 tracking-wide",
            active ? "font-bold" : "font-medium"
          )}>
            {item.label}
          </span>
        )}
        
        {isMobile && <ChevronRight className="w-4 h-4 ml-auto opacity-30" strokeWidth={2} />}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col md:flex-row font-sans selection:bg-indigo-100">
      
      {/* --- SLEEK SCROLLBAR OVERRIDE --- */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #94a3b8; }
      `}} />

      {/* ========================================================== */}
      {/* 🖥️ DESKTOP SIDEBAR (Seamless Razorpay Style)                 */}
      {/* ========================================================== */}
      <aside className={cn(
        "hidden md:flex flex-col h-screen fixed left-0 top-0 bg-transparent z-50 transition-all duration-300 ease-out",
        isCollapsed ? "w-[72px]" : "w-[240px]"
      )}>
        
        {/* ✨ UNIFIED DARK SIDEBAR HEADER ✨ */}
        <div className={cn(
          "flex items-center h-[60px] shrink-0 px-4 transition-all bg-[#0f172a] text-white border-b border-slate-800 z-10",
          isCollapsed ? "justify-center" : "justify-between"
        )}>
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden w-full whitespace-nowrap">
              <div className="h-6 w-6 bg-gradient-to-br from-[#0052FF] to-indigo-600 text-white flex items-center justify-center rounded shadow-sm shrink-0">
                 <Building2 className="h-3.5 w-3.5" strokeWidth={2.5} />
              </div>
              <span className="font-black text-[15px] tracking-tight text-white leading-none mt-0.5 animate-in fade-in duration-300">
                Biillo <span className="font-normal text-slate-400">OS</span>
              </span>
            </Link>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className="shrink-0 h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          >
            {isCollapsed ? <PanelLeft className="h-[18px] w-[18px]" strokeWidth={2} /> : <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={2} />}
          </Button>
        </div>

        {/* ✨ LOWER WHITE SECTION (Border moved here!) ✨ */}
        <div className="flex-1 flex flex-col bg-white border-r border-slate-200/60 overflow-hidden">
          {/* Scrollable Nav Area */}
          <div className="flex-1 overflow-y-auto py-4 space-y-6 custom-scrollbar overflow-x-hidden px-3 pt-6">
             <div className="space-y-0.5">
               {!isCollapsed && (
                 <p className="px-3 text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 whitespace-nowrap animate-in fade-in">Main Menu</p>
               )}
               {coreModules.map((item) => <NavItem key={item.href} item={item} />)}
             </div>

             {operationModules.length > 0 && (
               <div className="space-y-0.5">
                 {isCollapsed ? (
                   <div className="w-6 h-px bg-slate-200 mx-auto my-6" />
                 ) : (
                   <div className="animate-in fade-in">
                    <div className="h-px bg-slate-100 mx-3 my-6 w-auto" />
                    <p className="px-3 text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 whitespace-nowrap">Operations</p>
                   </div>
                 )}
                 {operationModules.map((item) => <NavItem key={item.href} item={item} />)}
               </div>
             )}
          </div>

          {/* User Profile Footer */}
          <div className="p-3 shrink-0 border-t border-slate-100">
            {isCollapsed ? (
              <div className="flex flex-col gap-2 items-center">
                <div 
                  className="h-9 w-9 bg-indigo-50 text-indigo-700 rounded-full flex items-center justify-center shrink-0 uppercase font-bold text-[13px] cursor-pointer hover:bg-indigo-100 transition-colors" 
                  title={appUser?.full_name || appUser?.email} 
                  onClick={() => setIsCollapsed(false)}
                >
                  {appUser?.full_name?.[0] || appUser?.email?.[0] || 'U'}
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full" onClick={handleLogout} title="Sign Out">
                  <LogOut className="h-[16px] w-[16px] ml-0.5" strokeWidth={2} />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors cursor-default group animate-in fade-in duration-300">
                <div className="flex items-center gap-3 overflow-hidden pl-1.5">
                   <div className="h-8 w-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center shrink-0 uppercase font-bold text-[12px]">
                     {appUser?.full_name?.[0] || appUser?.email?.[0] || 'U'}
                   </div>
                   <div className="flex flex-col truncate">
                     <span className="text-[12px] font-bold text-slate-900 truncate leading-none">
                       {appUser?.full_name || appUser?.email?.split('@')[0] || 'User'}
                     </span>
                     <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold truncate mt-1">
                       {appUser?.role?.replace('_', ' ') || 'Authorized'}
                     </span>
                   </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-rose-600 hover:bg-rose-50 shrink-0 rounded-md transition-all" onClick={handleLogout} title="Sign Out">
                  <LogOut className="h-[16px] w-[16px]" strokeWidth={2} />
                </Button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ========================================================== */}
      {/* 📱 MOBILE HEADER (Unified Dark Theme)                      */}
      {/* ========================================================== */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#0f172a] text-white border-b border-slate-800 z-50 px-4 flex items-center justify-between shadow-md">
         <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-gradient-to-br from-[#0052FF] to-indigo-600 text-white flex items-center justify-center rounded shrink-0">
               <Building2 className="h-3.5 w-3.5" strokeWidth={2.5} />
            </div>
            <span className="font-black text-[15px] tracking-tight leading-none mt-0.5">
              Biillo <span className="font-normal text-slate-400">OS</span>
            </span>
         </div>
         
         <button 
           onClick={() => setIsMobileMenuOpen(true)}
           className="flex items-center justify-center h-8 w-8 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
         >
           <Menu className="w-5 h-5" strokeWidth={2} />
         </button>
      </header>

      {/* ========================================================== */}
      {/* 📱 MOBILE "MORE" MENU (Sheet Style)                        */}
      {/* ========================================================== */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-right-full duration-300 ease-out">
          
          {/* Mobile Profile Header - Dark Theme */}
          <div className="h-20 flex items-center justify-between px-5 bg-[#0f172a] text-white shadow-md">
            <div className="flex items-center gap-3">
               <div className="w-11 h-11 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center font-bold text-sm uppercase shadow-sm">
                 {appUser?.full_name?.[0] || appUser?.email?.[0] || 'U'}
               </div>
               <div>
                 <p className="font-bold text-sm leading-none mb-1.5">
                    {appUser?.full_name || appUser?.email}
                 </p>
                 <p className="text-[10px] font-bold text-[#0052FF] bg-blue-500/10 px-2 py-0.5 rounded-sm uppercase tracking-widest leading-none inline-block">
                   {appUser?.role?.replace('_', ' ') || 'Authorized'}
                 </p>
               </div>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-slate-400 hover:text-white hover:bg-white/10" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="w-5 h-5" strokeWidth={2} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 bg-white custom-scrollbar pb-10">
            
            {coreModules.length > 0 && (
              <div>
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Main Menu</h4>
                 <div className="space-y-0.5">
                   {coreModules.map((item) => (
                     <NavItem key={item.href} item={item} isMobile onClick={() => setIsMobileMenuOpen(false)} />
                   ))}
                 </div>
              </div>
            )}

            {operationModules.length > 0 && (
              <div>
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Operations</h4>
                 <div className="space-y-0.5">
                   {operationModules.map((item) => (
                     <NavItem key={item.href} item={item} isMobile onClick={() => setIsMobileMenuOpen(false)} />
                   ))}
                 </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100">
               <Button 
                 variant="ghost" 
                 className="w-full justify-start h-12 text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-[14px] font-bold rounded-xl px-4" 
                 onClick={handleLogout}
               >
                 <LogOut className="w-4 h-4 mr-3" strokeWidth={2.5} /> Sign Out
               </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 📱 MOBILE BOTTOM NAV (Clean Dock Style)                      */}
      {/* ========================================================== */}
      {coreModules.length > 0 && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 z-40 h-[72px] pb-safe safe-area-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <div 
            className="grid h-full px-2" 
            style={{ gridTemplateColumns: `repeat(${Math.min(coreModules.length, 5)}, minmax(0, 1fr))` }}
          >
              {coreModules.slice(0, 5).map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                      key={item.href}
                      href={item.href}
                      className="flex flex-col items-center justify-center gap-1.5 pt-1 active:scale-95 transition-all duration-200 relative group"
                  >
                      {active && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#0052FF] rounded-b-full shadow-[0_2px_8px_rgba(0,82,255,0.5)] animate-in fade-in zoom-in-50 duration-300"></div>
                      )}
                      
                      <div className={cn(
                        "p-1 rounded-full transition-all duration-300",
                        active ? "text-slate-900 -translate-y-0.5" : "text-slate-400 group-hover:text-slate-600"
                      )}>
                        <item.icon strokeWidth={active ? 2.5 : 2} className="w-5 h-5" />
                      </div>
                      
                      <span className={cn(
                        "text-[10px] tracking-tight text-center px-1 truncate w-full transition-colors", 
                        active ? "font-bold text-slate-900" : "font-medium text-slate-400"
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
      {/* MAIN CONTENT AREA                                            */}
      {/* ========================================================== */}
      <main className={cn(
        "flex-1 flex flex-col min-h-screen",
        // Fluid spring transition matching the sidebar
        "transition-[margin] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        // Critical Mobile Spacing: pt-14 (header), pb-[80px] (bottom nav)
        "pt-14 pb-[80px] md:pt-0 md:pb-0", 
        isCollapsed ? "md:ml-[72px]" : "md:ml-[240px]"
      )}>
        {children}
      </main>

    </div>
  )
}