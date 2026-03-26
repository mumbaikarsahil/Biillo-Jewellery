'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
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
  Settings,
  Gem,
  Ticket,
  Command,
  Server,
  ScanLine,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react'

// --- Configuration with Role-Based Access ---
const allCoreModules = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['all'] }, 
  { href: '/topology', label: 'Topology', icon: Server, roles: ['owner', 'manager'] },
  { href: '/pos', label: 'Terminal', icon: ShoppingCart, roles: ['owner', 'manager', 'branch_manager', 'sales_person'] },
  { href: '/shadow-pos', label: 'SIS Terminal', icon: ScanLine, roles: ['owner', 'manager', 'shadow_manager', 'shadow_sales'] },
  { href: '/sales', label: 'Revenue', icon: Banknote, roles: ['owner', 'manager', 'branch_manager'] },
  { href: '/reports', label: 'Analytics', icon: BarChart3, roles: ['owner', 'manager'] },
  { href: '/discovery', label: 'Discovery', icon: Gem, roles: ['owner', 'manager', 'branch_manager', 'sales_person'] },
]

const allOperationModules = [
  { href: '/master', label: 'Master Config', icon: Database, roles: ['owner', 'manager'] },
  { href: '/purchases', label: 'Procurement', icon: ShoppingCart, roles: ['owner', 'manager', 'operations_manager'] },
  { href: '/manufacturing/job-bags', label: 'Fabrication', icon: Briefcase, roles: ['owner', 'manager', 'operations_manager'] },
  { href: '/inventory', label: 'Vault Stock', icon: Package, roles: ['owner', 'manager', 'operations_manager', 'branch_manager'] },
  { href: '/transfer', label: 'Logistics', icon: ArrowRightLeft, roles: ['owner', 'manager', 'operations_manager'] },
  { href: '/crm', label: 'CRM', icon: UserCircle, roles: ['owner', 'manager', 'branch_manager', 'sales_person'] },
  { href: '/vouchers', label: 'Vouchers', icon: Ticket, roles: ['owner', 'manager', 'voucher_manager'] },
  { href: '/memo', label: 'Memos', icon: FileText, roles: ['owner', 'manager'] },
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

  const NavItem = ({ item, isMobile = false, onClick }: any) => {
    const active = isActive(item.href)
    return (
      <Link
        href={item.href}
        onClick={onClick}
        title={isCollapsed && !isMobile ? item.label : undefined}
        className={cn(
          "flex items-center rounded-md transition-colors duration-200 group relative",
          isCollapsed && !isMobile ? "justify-center h-10 w-10 mx-auto mb-1" : "gap-3 px-3 py-2 mb-0.5",
          active 
            ? "bg-slate-100 text-slate-900 font-semibold" 
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium",
          isMobile && "py-3"
        )}
      >
        <item.icon className={cn(
          "shrink-0 transition-colors",
          isCollapsed && !isMobile ? "h-5 w-5" : "h-4 w-4",
          active ? "text-slate-900" : "text-slate-400 group-hover:text-slate-600"
        )} />
        
        {(!isCollapsed || isMobile) && (
          <span className="text-xs tracking-tight">
            {item.label}
          </span>
        )}
        
        {(!isCollapsed || isMobile) && active && !isMobile && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-slate-900" />
        )}
        {isMobile && <ChevronRight className="w-4 h-4 ml-auto text-slate-300" />}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col md:flex-row font-sans selection:bg-indigo-100">
      
      {/* --- SLEEK SCROLLBAR OVERRIDE --- */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 4px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: #cbd5e1; /* slate-300 */
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
          transition: scrollbar-color 0.3s;
        }
        .custom-scrollbar:hover {
          scrollbar-color: #cbd5e1 transparent;
        }
      `}} />

      {/* ========================================================== */}
      {/* 🖥️ DESKTOP SIDEBAR (Collapsible)                            */}
      {/* ========================================================== */}
      <aside className={cn(
        "hidden md:flex flex-col h-screen fixed left-0 top-0 border-r border-slate-200 bg-white z-50 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-[72px]" : "w-[240px]"
      )}>
        
        {/* Sidebar Header & Toggle */}
        <div className={cn(
          "flex items-center h-14 border-b border-slate-200 shrink-0 px-3 transition-all",
          isCollapsed ? "justify-center" : "justify-between"
        )}>
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden w-full whitespace-nowrap">
              <div className="h-6 w-6 bg-slate-900 text-white flex items-center justify-center rounded-md shrink-0">
                 <Command className="h-3.5 w-3.5" />
              </div>
              <span className="font-bold text-sm tracking-tight text-slate-900">
                Biillo_OS
              </span>
            </Link>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className="shrink-0 h-8 w-8 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-none"
          >
            {isCollapsed ? <PanelLeft className="h-4.5 w-4.5" /> : <PanelLeftClose className="h-4.5 w-4.5" />}
          </Button>
        </div>

        {/* Scrollable Nav Area */}
        <div className="flex-1 overflow-y-auto py-5 space-y-6 custom-scrollbar overflow-x-hidden">
           <div className="space-y-1 px-2">
             {!isCollapsed && (
               <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 whitespace-nowrap">Workspace</p>
             )}
             {coreModules.map((item) => <NavItem key={item.href} item={item} />)}
           </div>

           {operationModules.length > 0 && (
             <div className="space-y-1 px-2">
               {isCollapsed ? (
                 <div className="w-6 h-px bg-slate-200 mx-auto my-4" />
               ) : (
                 <>
                  <Separator className="bg-slate-100 mx-2 my-2 w-auto" />
                  <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 whitespace-nowrap">Management</p>
                 </>
               )}
               {operationModules.map((item) => <NavItem key={item.href} item={item} />)}
             </div>
           )}
        </div>

        {/* User Profile Footer */}
        <div className="p-3 border-t border-slate-200 shrink-0 bg-white">
          {isCollapsed ? (
            <div className="flex flex-col gap-2 items-center">
              <div 
                className="h-10 w-10 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center shrink-0 uppercase font-semibold text-xs text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors" 
                title={appUser?.full_name || appUser?.email} 
                onClick={() => setIsCollapsed(false)}
              >
                {appUser?.full_name?.[0] || appUser?.email?.[0] || 'U'}
              </div>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" onClick={handleLogout} title="Sign Out">
                <LogOut className="h-4.5 w-4.5 ml-1" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-default">
              <div className="flex items-center gap-2.5 overflow-hidden">
                 <div className="h-8 w-8 bg-white border border-slate-200 rounded-full flex items-center justify-center shrink-0 uppercase font-semibold text-xs text-slate-600 shadow-sm">
                   {appUser?.full_name?.[0] || appUser?.email?.[0] || 'U'}
                 </div>
                 <div className="flex flex-col truncate">
                   <span className="text-xs font-bold text-slate-900 truncate leading-tight">
                     {appUser?.full_name || appUser?.email?.split('@')[0] || 'User'}
                   </span>
                   <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold truncate leading-tight mt-0.5">
                     {appUser?.role?.replace('_', ' ') || 'Authorized'}
                   </span>
                 </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0 rounded-lg bg-white border border-slate-200 shadow-sm" onClick={handleLogout} title="Sign Out">
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================== */}
      {/* 📱 MOBILE HEADER                                           */}
      {/* ========================================================== */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 z-50 px-4 flex items-center justify-between shadow-sm">
         <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-slate-900 text-white flex items-center justify-center rounded-md shrink-0">
               <Command className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-900">
              Biillo_OS
            </span>
         </div>
         
         <button 
           onClick={() => setIsMobileMenuOpen(true)}
           className="flex items-center gap-2 p-1.5 pr-2.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors shadow-sm"
         >
            <div className="h-5 w-5 rounded-full bg-white border border-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold uppercase">
              {appUser?.full_name?.[0] || appUser?.email?.[0] || 'U'}
            </div>
            <Menu className="w-4 h-4 text-slate-600" />
         </button>
      </header>

      {/* ========================================================== */}
      {/* 📱 MOBILE "MORE" MENU                                      */}
      {/* ========================================================== */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-right-full duration-200">
          
          <div className="h-16 border-b border-slate-200 flex items-center justify-between px-5 bg-slate-50">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center font-bold text-sm text-slate-700 uppercase shadow-sm">
                 {appUser?.full_name?.[0] || appUser?.email?.[0] || 'U'}
               </div>
               <div>
                 <p className="font-bold text-sm text-slate-900 leading-tight">
                    {appUser?.full_name || appUser?.email}
                 </p>
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                   {appUser?.role?.replace('_', ' ') || 'Authorized'}
                 </p>
               </div>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-slate-900" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 bg-white custom-scrollbar">
            {operationModules.length > 0 && (
              <div>
                 <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Management</h4>
                 <div className="space-y-1">
                   {operationModules.map((item) => (
                     <NavItem key={item.href} item={item} isMobile onClick={() => setIsMobileMenuOpen(false)} />
                   ))}
                 </div>
              </div>
            )}

            <Separator className="bg-slate-100" />

            <div>
               <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">System Control</h4>
               <Button 
                 variant="destructive" 
                 className="w-full justify-start h-11 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-xs font-bold rounded-lg shadow-sm" 
                 onClick={handleLogout}
               >
                 <LogOut className="w-4 h-4 mr-2" /> Sign Out of Biillo
               </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 📱 MOBILE BOTTOM NAV                                       */}
      {/* ========================================================== */}
      {coreModules.length > 0 && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 h-16 pb-safe safe-area-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
          <div 
            className="grid h-full" 
            style={{ gridTemplateColumns: `repeat(${coreModules.length}, minmax(0, 1fr))` }}
          >
              {coreModules.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                          "flex flex-col items-center justify-center gap-1 active:scale-95 transition-colors relative",
                          active ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
                      )}
                  >
                      {active && <div className="absolute top-0 w-8 h-1 bg-slate-900 rounded-b-full" />}
                      <item.icon className={cn("w-5 h-5 mt-1", active && "fill-slate-900/5")} />
                      <span className={cn("text-[9px] tracking-tight text-center px-1 truncate w-full", active ? "font-bold" : "font-medium")}>
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
        "flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out",
        "pt-14 pb-16 md:pt-0 md:pb-0", // Mobile top/bottom padding 
        isCollapsed ? "md:ml-[72px]" : "md:ml-[240px]" // Dynamic desktop left margin
      )}>
        {children}
      </main>

    </div>
  )
}