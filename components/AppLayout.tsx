'use client'

import React, { useState } from 'react'
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
  Activity
} from 'lucide-react'

// --- Configuration ---

const coreModules = [
  { href: '/dashboard', label: 'Telemetry', icon: LayoutDashboard },
  { href: '/pos', label: 'Terminal', icon: ShoppingCart },
  { href: '/sales', label: 'Revenue', icon: Banknote },
  { href: '/reports', label: 'Analytics', icon: BarChart3 },
  { href: '/discovery', label: 'Discovery', icon: Gem },
]

const operationModules = [
  { href: '/master', label: 'Master Config', icon: Database },
  { href: '/purchases', label: 'Procurement', icon: ShoppingCart },
  { href: '/manufacturing/job-bags', label: 'Fabrication', icon: Briefcase },
  { href: '/inventory', label: 'Vault Stock', icon: Package },
  { href: '/transfer', label: 'Logistics', icon: ArrowRightLeft },
  { href: '/crm', label: 'CRM', icon: UserCircle },
  { href: '/vouchers', label: 'Vouchers', icon: Ticket },
  { href: '/memo', label: 'Memos', icon: FileText },
]

export function AppLayout({ children, appUser }: { children: React.ReactNode, appUser?: any }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group relative",
          active 
            ? "bg-secondary text-foreground" 
            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
          isMobile && "py-3"
        )}
      >
        {active && !isMobile && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-foreground rounded-r-full" />
        )}
        <item.icon className={cn("w-4 h-4 shrink-0", active ? "text-foreground" : "text-muted-foreground/70")} />
        <span className={cn("text-xs font-semibold tracking-tight mt-0.5", active ? "font-bold" : "font-medium")}>
          {item.label}
        </span>
        {isMobile && <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground/30" />}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      
      {/* ========================================================== */}
      {/* 🖥️ DESKTOP SIDEBAR (Fixed Left - IDE Style)                */}
      {/* ========================================================== */}
      <aside className="hidden md:flex flex-col w-[240px] h-screen fixed left-0 top-0 border-r border-border bg-card z-50 shadow-sm overflow-hidden">
        
        {/* LOGO HEADER */}
        <Link href="/dashboard" className="flex items-center gap-2.5 px-5 h-12 border-b border-border hover:bg-secondary/30 transition-colors shrink-0">
          <div className="h-5 w-5 bg-foreground text-background flex items-center justify-center rounded-sm shrink-0">
             <Command className="h-3.5 w-3.5" />
          </div>
          <span className="font-black text-xs uppercase tracking-[0.2em] text-foreground mt-0.5">
            Biillo<span className="text-muted-foreground/40">_OS</span>
          </span>
        </Link>

        {/* NAVIGATION LIST */}
        <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6 custom-scrollbar">
           
           <div className="space-y-1">
             <p className="px-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-2">Core Core</p>
             {coreModules.map((item) => <NavItem key={item.href} item={item} />)}
           </div>

           <Separator className="bg-border/50 mx-2" />

           <div className="space-y-1">
             <p className="px-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-2">Operations</p>
             {operationModules.map((item) => <NavItem key={item.href} item={item} />)}
           </div>

        </div>

        {/* USER PROFILE FOOTER */}
        <div className="p-3 border-t border-border bg-secondary/10 shrink-0">
          <div className="flex items-center justify-between p-2 rounded-md border border-border/60 bg-card shadow-sm hover:border-border transition-colors">
            <div className="flex items-center gap-2.5 overflow-hidden">
               <div className="h-7 w-7 bg-secondary border border-border rounded flex items-center justify-center shrink-0">
                  <UserCircle className="h-4 w-4 text-muted-foreground" />
               </div>
               <div className="flex flex-col truncate">
                 <span className="text-[10px] font-bold text-foreground truncate">{appUser?.email || 'SYSTEM_USER'}</span>
                 <div className="flex items-center gap-1.5 mt-0.5">
                   <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                   <span className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">Authorized</span>
                 </div>
               </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 shrink-0 rounded" onClick={handleLogout} title="Terminate Session">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ========================================================== */}
      {/* 📱 MOBILE HEADER (Top Bar - High Density)                  */}
      {/* ========================================================== */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-12 bg-background border-b border-border z-50 px-4 flex items-center justify-between shadow-sm">
         <div className="flex items-center gap-2">
            <div className="h-5 w-5 bg-foreground text-background flex items-center justify-center rounded-sm shrink-0">
               <Command className="h-3.5 w-3.5" />
            </div>
            <span className="font-black text-xs uppercase tracking-[0.2em] text-foreground mt-0.5">
              Biillo<span className="text-muted-foreground/40">_OS</span>
            </span>
         </div>
         
         <button 
           onClick={() => setIsMobileMenuOpen(true)}
           className="flex items-center gap-2 p-1 pr-2 rounded border border-border bg-secondary/50 hover:bg-secondary transition-colors"
         >
            <div className="h-5 w-5 rounded bg-muted-foreground/20 text-foreground flex items-center justify-center text-[10px] font-black uppercase">
              {appUser?.email?.[0] || 'U'}
            </div>
            <Menu className="w-4 h-4 text-foreground" />
         </button>
      </header>

      {/* ========================================================== */}
      {/* 📱 MOBILE "MORE" MENU (Slide-over)                         */}
      {/* ========================================================== */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-background flex flex-col animate-in slide-in-from-right-full duration-200">
          
          <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-secondary/30">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded border border-border bg-card flex items-center justify-center font-black text-sm uppercase shadow-sm">
                 {appUser?.email?.[0] || 'U'}
               </div>
               <div>
                 <p className="font-bold text-xs text-foreground">{appUser?.email}</p>
                 <div className="flex items-center gap-1 mt-0.5">
                   <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                   <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{appUser?.role || 'Authorized'}</p>
                 </div>
               </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
            <div>
               <h4 className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest mb-3 px-1">Operations Matrix</h4>
               <div className="space-y-1">
                 {operationModules.map((item) => (
                   <NavItem key={item.href} item={item} isMobile onClick={() => setIsMobileMenuOpen(false)} />
                 ))}
               </div>
            </div>

            <Separator className="bg-border/50" />

            <div>
               <h4 className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest mb-3 px-1">System Controls</h4>
               <Button variant="outline" className="w-full justify-start mb-3 h-10 border-border text-xs font-bold" onClick={() => { setIsMobileMenuOpen(false); router.push('/settings'); }}>
                 <Settings className="w-4 h-4 mr-2 text-muted-foreground" /> Configuration
               </Button>
               <Button 
                 variant="destructive" 
                 className="w-full justify-start h-10 bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20 text-xs font-bold" 
                 onClick={handleLogout}
               >
                 <LogOut className="w-4 h-4 mr-2" /> Terminate Session
               </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 📱 MOBILE BOTTOM NAV (Fixed Bottom)                        */}
      {/* ========================================================== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 h-14 pb-safe safe-area-bottom">
        <div className="grid grid-cols-5 h-full">
            {coreModules.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                        "flex flex-col items-center justify-center gap-1 active:scale-95 transition-all relative",
                        active ? "text-foreground" : "text-muted-foreground"
                    )}
                >
                    {active && <div className="absolute top-0 w-8 h-[2px] bg-foreground rounded-b-full" />}
                    <item.icon className={cn("w-4 h-4", active && "fill-foreground/10")} />
                    <span className={cn("text-[8px] uppercase tracking-wider", active ? "font-black" : "font-semibold")}>
                        {item.label}
                    </span>
                </Link>
              )
            })}
        </div>
      </nav>

      {/* ========================================================== */}
      {/* MAIN CONTENT AREA                                          */}
      {/* ========================================================== */}
      <main className="flex-1 flex flex-col min-h-screen 
        pt-12 pb-14        /* Mobile Padding */
        md:pt-0 md:pb-0    /* Desktop Padding reset */
        md:ml-[240px]      /* Content starts after sidebar */
      ">
        {children}
      </main>

    </div>
  )
}