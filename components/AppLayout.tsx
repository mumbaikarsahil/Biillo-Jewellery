'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Home, Server, Monitor, QrCode, Wallet, PieChart, Compass,
  SlidersHorizontal, ShoppingBag, Hammer, Layers, BookOpen, Route, Users,
  TicketPercent, LogOut, Menu, X, ChevronRight, PanelLeft, Building2, Box, MessageSquare, Brain, ShoppingCart, Briefcase
} from 'lucide-react'

// --- Configuration with Premium Icons ---
const allCoreModules = [
  { href: '/dashboard', label: 'Dashboard', icon: Home, roles: ['all'] }, 
  { href: '/ai-assistant', label: 'Ask AI', icon: Brain, roles: ['owner'] },
  { href: '/topology', label: 'Topology', icon: Server, roles: ['owner', 'manager'] },
  { href: '/pos', label: 'Terminal', icon: Monitor, roles: ['owner', 'manager', 'branch_manager', 'sales_person'] },
  { href: '/sales', label: 'Revenue', icon: Wallet, roles: ['owner', 'manager', 'branch_manager'] },
  { href: '/reports', label: 'Analytics', icon: PieChart, roles: ['owner', 'manager', 'branch_manager'] },
  { href: '/discovery', label: 'Discovery', icon: Compass, roles: ['owner', 'manager', 'branch_manager', 'sales_person'] },
  { href: '/ecommerce', label: 'E-Commerce', icon: SlidersHorizontal, roles: ['owner', 'manager'] },
  { href: '/dworkspace', label: 'D-Workspace', icon: Briefcase, roles: ['owner']},
]

const allOperationModules = [
  { href: '/master', label: 'Master Config', icon: SlidersHorizontal, roles: ['owner', 'manager'] },
  { href: '/purchases', label: 'Procurement', icon: ShoppingBag, roles: ['owner', 'manager', 'operations_manager'] },
  { href: '/manufacturing/job-bags', label: 'Fabrication', icon: Hammer, roles: ['owner', 'manager', 'operations_manager'] },
  { href: '/inventory', label: 'Vault Stock', icon: Layers, roles: ['owner', 'manager', 'operations_manager', 'branch_manager'] },
  { href: '/catalog', label: 'Catalog', icon: BookOpen, roles: ['owner', 'manager', 'operations_manager', 'branch_manager'] },
  { href: '/transfer', label: 'Logistics', icon: Route, roles: ['owner', 'manager', 'operations_manager', 'branch_manager', 'shadow_manager'] },
  { href: '/crm', label: 'CRM', icon: Users, roles: ['owner', 'manager', 'crm_manager', 'branch_manager','sales_person'] },
  { href: '/whatsapp', label: 'Whatsapp API', icon: MessageSquare, roles: ['owner', 'manager'] },
  { href: '/vouchers', label: 'Vouchers', icon: TicketPercent, roles: ['owner', 'manager', 'crm_manager'] },
]

export function AppLayout({ children, appUser }: { children: React.ReactNode, appUser?: any }) {
  const pathname = usePathname()
  const router = useRouter()
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false) 

  const normalizedPath = pathname?.toLowerCase() || ''
  
  // ✨ Check if we are on the AI page to trigger the dark theme
  const isAiPage = normalizedPath.startsWith('/ai-assistant')
  
  const isPublicPage = 
    normalizedPath.startsWith('/claim') || 
    normalizedPath.startsWith('/login') || 
    normalizedPath.startsWith('/storelocations') || 
    normalizedPath.startsWith('/event')

  if (isPublicPage) {
    return <>{children}</>
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
  const initial = appUser?.full_name ? appUser.full_name.charAt(0).toUpperCase() : 'U'

  // --- SIDEBAR NAVIGATION ITEM ---
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
          
          // ✨ Dynamic Theme Switching for Nav Items
          active 
            ? isAiPage 
              ? "bg-[#1e1f20] text-slate-200 border border-white/5" // AI Active
              : "bg-[#090E17] text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-slate-800" // Light Active
            : isAiPage
              ? "text-slate-400 hover:bg-white/5 hover:text-slate-200" // AI Inactive
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900", // Light Inactive
              
          isMobile && "py-3.5 rounded-xl"
        )}
      >
        <item.icon 
          strokeWidth={active ? 2.5 : 2} 
          className={cn(
            "shrink-0 transition-all duration-200",
            isCollapsed && !isMobile ? "h-[18px] w-[18px]" : "h-[18px] w-[18px]",
            active 
              ? isAiPage ? "text-[#4285F4]" : "text-[#0052FF]" // Gemini blue vs Brand blue
              : isAiPage ? "text-slate-500 group-hover:text-slate-300" : "text-slate-400 group-hover:text-slate-700"
          )} 
        />
        {(!isCollapsed || isMobile) && (
          <span className={cn("text-[13px] flex-1 tracking-wide", active ? "font-bold" : "font-medium")}>
            {item.label}
          </span>
        )}
        {isMobile && <ChevronRight className="w-4 h-4 ml-auto opacity-30" strokeWidth={2} />}
      </Link>
    )
  }

  // --- TOP NAVIGATION TAB ---
  const TopNavLink = ({ href, label, icon: Icon }: { href: string, label: string, icon: any }) => {
    const active = isActive(href)
    return (
      <Link href={href} className="relative flex items-center h-full px-4 group">
        <div className="flex items-center gap-2.5 relative z-20">
          <Icon className={cn("w-[16px] h-[16px] transition-colors", active ? "text-white" : "text-slate-400 group-hover:text-slate-300")} strokeWidth={2} />
          <span className={cn(
            "text-[14px] transition-colors",
            active ? "font-bold text-white" : "font-medium text-slate-400 group-hover:text-slate-200"
          )}>
            {label}
          </span>
        </div>
        {active && (
          <>
            <div className={cn("absolute bottom-0 left-1/2 -translate-x-1/2 w-[140%] h-[36px] blur-[18px] opacity-100 z-0 pointer-events-none rounded-t-full", isAiPage ? "bg-[#4285F4]" : "bg-[#0052FF]")}></div>
            <div className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-white z-10 shadow-[0_-2px_10px_rgba(255,255,255,0.8)]"></div>
          </>
        )}
      </Link>
    )
  }

  return (
    <div className={cn("min-h-screen flex flex-col font-sans selection:bg-blue-100", isAiPage ? "bg-[#131314]" : "bg-[#02040A]")}>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #94a3b8; }
      `}} />

      {/* ========================================================== */}
      {/* 🚀 GLOBAL TOP NAVIGATION BAR                                 */}
      {/* ========================================================== */}
      <header className={cn("fixed top-0 left-0 right-0 h-[56px] z-[60] flex items-center justify-between px-4 sm:px-6 shadow-sm",
        isAiPage ? "bg-[#131314] text-slate-200 border-b border-white/5" : "bg-[#02040A] text-white border-b border-white/10"
      )}>
        
        <div className="flex items-center h-full">
           <button 
             onClick={() => setIsCollapsed(!isCollapsed)} 
             className="hidden md:flex items-center justify-center text-slate-400 hover:text-white transition-colors mr-5 pl-1"
           >
             <PanelLeft className="w-[18px] h-[18px]" strokeWidth={1.5} />
           </button>

           <Link href="/dashboard" className="flex items-center gap-2.5 mr-6">
              <div className={cn("h-5 w-5 rounded-sm flex items-center justify-center", isAiPage ? "bg-slate-800" : "bg-white shadow-[0_0_10px_rgba(255,255,255,0.15)]")}>
                <Box className={cn("w-[14px] h-[14px]", isAiPage ? "text-slate-200" : "text-[#02040A]")} strokeWidth={3} />
              </div>
              <h1 className="text-[17px] font-bold tracking-tight leading-none pt-0.5">
                Biillo <span className={cn("font-normal", isAiPage ? "text-slate-500" : "text-slate-400")}>OS</span>
              </h1>
           </Link>
           
           <nav className="hidden md:flex items-center h-full border-l border-white/10 pl-2">
              <TopNavLink href="/dashboard" label="Home" icon={Building2} />
              <TopNavLink href="/inventory" label="Inventory" icon={Layers} />
              <TopNavLink href="/sales" label="sales+" icon={Wallet} />
           </nav>
        </div>

        <div className="flex items-center gap-4 h-full">
          <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden flex items-center justify-center text-slate-300 hover:text-white transition-colors">
            <Menu className="w-5 h-5" strokeWidth={1.5} />
          </button>
          
          <div className={cn("hidden md:flex items-center gap-2 border rounded-full pl-3 pr-1 py-1 cursor-pointer transition-colors shadow-sm",
            isAiPage ? "bg-white/5 border-white/5 hover:bg-white/10" : "bg-white/5 border-white/10 hover:bg-white/10"
          )}>
            <span className="text-[12px] font-medium text-slate-300 pr-1 hidden xl:block tracking-wide">{appUser?.full_name?.split(' ')[0] || 'User'}</span>
            <div className="h-[26px] w-[26px] bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-inner">
              {initial}
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================== */}
      {/* 🖥️ DESKTOP SIDEBAR                                           */}
      {/* ========================================================== */}
      <aside className={cn(
        "hidden md:flex flex-col fixed left-0 bottom-0 z-40 shadow-[4px_0_24px_rgba(0,0,0,0.02)]",
        "transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        "top-[56px] h-[calc(100vh-56px)]", 
        "md:rounded-tl-[24px]",
        isAiPage ? "bg-[#131314] border-r border-white/5" : "bg-white border-r border-slate-200/80",
        isCollapsed ? "w-[72px]" : "w-[240px]"
      )}>
        <div className="flex-1 overflow-y-auto py-4 space-y-6 custom-scrollbar overflow-x-hidden px-3 pt-6">
           <div className="space-y-0.5">
             {!isCollapsed && (
               <p className={cn("px-3 text-[9px] font-black uppercase tracking-widest mb-3 whitespace-nowrap animate-in fade-in", isAiPage ? "text-slate-600" : "text-slate-400")}>Main Menu</p>
             )}
             {coreModules.map((item) => <NavItem key={item.href} item={item} />)}
           </div>

           {operationModules.length > 0 && (
             <div className="space-y-0.5">
               {isCollapsed ? (
                 <div className={cn("w-6 h-px mx-auto my-6", isAiPage ? "bg-white/10" : "bg-slate-200")} />
               ) : (
                 <div className="animate-in fade-in">
                  <div className={cn("h-px mx-3 my-6 w-auto", isAiPage ? "bg-white/5" : "bg-slate-100")} />
                  <p className={cn("px-3 text-[9px] font-black uppercase tracking-widest mb-3 whitespace-nowrap", isAiPage ? "text-slate-600" : "text-slate-400")}>Operations</p>
                 </div>
               )}
               {operationModules.map((item) => <NavItem key={item.href} item={item} />)}
             </div>
           )}
        </div>

        {/* User Profile Footer */}
        <div className={cn("p-3 shrink-0 border-t", isAiPage ? "border-white/5" : "border-slate-100")}>
          {isCollapsed ? (
            <div className="flex flex-col gap-2 items-center">
              <Button variant="ghost" size="icon" className={cn("h-9 w-9 rounded-full", isAiPage ? "text-slate-500 hover:text-rose-400 hover:bg-rose-500/10" : "text-slate-400 hover:text-rose-600 hover:bg-rose-50")} onClick={handleLogout} title="Sign Out">
                <LogOut className="h-[16px] w-[16px] ml-0.5" strokeWidth={2} />
              </Button>
            </div>
          ) : (
            <div className={cn("flex items-center justify-between p-2 rounded-xl border transition-colors cursor-default group animate-in fade-in duration-300",
              isAiPage ? "bg-[#1e1f20] border-white/5 hover:border-white/10" : "bg-slate-50 border-slate-100 hover:border-slate-200"
            )}>
              <div className="flex items-center gap-3 overflow-hidden pl-1.5">
                 <div className="h-8 w-8 bg-[#090E17] text-white rounded-full flex items-center justify-center shrink-0 uppercase font-bold text-[12px]">
                   {initial}
                 </div>
                 <div className="flex flex-col truncate">
                   <span className={cn("text-[12px] font-bold truncate leading-none", isAiPage ? "text-slate-300" : "text-slate-900")}>
                     {appUser?.full_name || appUser?.email?.split('@')[0] || 'User'}
                   </span>
                   <span className={cn("text-[9px] uppercase tracking-widest font-bold truncate mt-1", isAiPage ? "text-slate-500" : "text-slate-400")}>
                     {appUser?.role?.replace('_', ' ') || 'Authorized'}
                   </span>
                 </div>
              </div>
              <Button variant="ghost" size="icon" className={cn("h-8 w-8 opacity-0 group-hover:opacity-100 shrink-0 rounded-md transition-all",
                isAiPage ? "text-slate-500 hover:text-rose-400 hover:bg-rose-500/10" : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
              )} onClick={handleLogout} title="Sign Out">
                <LogOut className="h-[16px] w-[16px]" strokeWidth={2} />
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================== */}
      {/* 📱 MOBILE "MORE" MENU                                        */}
      {/* ========================================================== */}
      {isMobileMenuOpen && (
        <div className={cn("md:hidden fixed inset-0 z-[70] flex flex-col animate-in slide-in-from-right-full duration-300 ease-out", isAiPage ? "bg-[#131314]" : "bg-white")}>
          <div className="h-[56px] flex items-center justify-between px-5 bg-[#02040A] text-white shadow-md shrink-0">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                 {initial}
               </div>
               <div>
                 <p className="font-bold text-sm leading-none mb-1">
                    {appUser?.full_name || appUser?.email}
                 </p>
                 <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest leading-none">
                   {appUser?.role?.replace('_', ' ') || 'Authorized'}
                 </p>
               </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-400 hover:text-white hover:bg-white/10" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="w-5 h-5" strokeWidth={1.5} />
            </Button>
          </div>

          <div className={cn("flex-1 overflow-y-auto px-4 py-6 space-y-8 custom-scrollbar pb-24", isAiPage ? "bg-[#131314]" : "bg-white")}>
            {coreModules.length > 0 && (
              <div>
                 <h4 className={cn("text-[10px] font-black uppercase tracking-widest mb-3 px-2", isAiPage ? "text-slate-600" : "text-slate-400")}>Main Menu</h4>
                 <div className="space-y-0.5">
                   {coreModules.map((item) => (
                     <NavItem key={item.href} item={item} isMobile onClick={() => setIsMobileMenuOpen(false)} />
                   ))}
                 </div>
              </div>
            )}
            {operationModules.length > 0 && (
               <div>
                 <h4 className={cn("text-[10px] font-black uppercase tracking-widest mb-3 px-2", isAiPage ? "text-slate-600" : "text-slate-400")}>Operations</h4>
                 <div className="space-y-0.5">
                   {operationModules.map((item) => (
                     <NavItem key={item.href} item={item} isMobile onClick={() => setIsMobileMenuOpen(false)} />
                   ))}
                 </div>
              </div>
            )}
            <div className={cn("pt-4 border-t", isAiPage ? "border-white/5" : "border-slate-100")}>
               <Button variant="ghost" className={cn("w-full justify-start h-12 text-[14px] font-bold rounded-xl px-4",
                 isAiPage ? "text-rose-500 hover:bg-rose-500/10 hover:text-rose-400" : "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
               )} onClick={handleLogout}>
                 <LogOut className="w-4 h-4 mr-3" strokeWidth={2.5} /> Sign Out
               </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 📱 MOBILE BOTTOM NAV                                         */}
      {/* ========================================================== */}
      {coreModules.length > 0 && (
        <nav className={cn(
          "md:hidden fixed bottom-0 left-0 right-0 backdrop-blur-md border-t z-40 h-[72px] pb-safe safe-area-bottom",
          isAiPage ? "bg-[#131314]/95 border-white/5 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]" : "bg-white/95 border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"
        )}>
          <div className="grid h-full px-2" style={{ gridTemplateColumns: `repeat(${Math.min(coreModules.length, 5)}, minmax(0, 1fr))` }}>
              {coreModules.slice(0, 5).map((item) => {
                const active = isActive(item.href)
                return (
                  <Link key={item.href} href={item.href} className="flex flex-col items-center justify-center gap-1.5 pt-1 active:scale-95 transition-all duration-200 relative group">
                      {active && (
                        <div className={cn("absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 rounded-b-full animate-in fade-in duration-300", 
                          isAiPage ? "bg-[#4285F4] shadow-[0_2px_8px_rgba(66,133,244,0.6)]" : "bg-[#0052FF] shadow-[0_2px_8px_rgba(0,82,255,0.8)]"
                        )}></div>
                      )}
                      <div className={cn("p-1 rounded-full transition-all duration-300", 
                        active 
                          ? isAiPage ? "text-[#4285F4] -translate-y-0.5" : "text-[#0052FF] -translate-y-0.5" 
                          : isAiPage ? "text-slate-500 group-hover:text-slate-300" : "text-slate-400 group-hover:text-slate-600"
                      )}>
                        <item.icon strokeWidth={active ? 2.5 : 2} className="w-5 h-5" />
                      </div>
                      <span className={cn("text-[10px] tracking-tight text-center px-1 truncate w-full transition-colors", 
                        active 
                          ? isAiPage ? "font-bold text-slate-200" : "font-bold text-slate-900" 
                          : isAiPage ? "font-medium text-slate-500" : "font-medium text-slate-400"
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
        "flex-1 flex flex-col h-full",
        "transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        "mt-[56px] pb-[80px] md:pb-0", 
        "md:rounded-tr-[24px]", 
        isAiPage ? "bg-[#131314]" : "bg-[#f8f9fb]", // ✨ Matches AI background seamlessly
        isCollapsed ? "md:ml-[72px]" : "md:ml-[240px]"
      )}>
        {children}
      </main>

    </div>
  )
}