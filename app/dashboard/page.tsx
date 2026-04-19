"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import { useStoreLocation } from "@/hooks/useStoreLocation"
import { 
  ShoppingCart, 
  Search, 
  Package, 
  ArrowRightLeft, 
  Users, 
  Server, 
  Ticket,
  Settings,
  Wallet,
  Clock,
  ScanLine,
  X,
  ChevronRight,
  TrendingUp,
  Activity,
  Sparkles,
  ArrowRight,
  Building2,
  Box,
  Store,
  Truck,
  CalendarDays,
  ChevronDown,
  Wrench,
  Database
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button" 
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

// --- CENTRALIZED ROLE-BASED ACCESS CONTROL (RBAC) ---
const APP_MODULES = [
  {
    title: "POS Register",
    description: "Start a new billing session",
    href: "/pos",
    icon: ShoppingCart,
    color: "text-[#0052FF] bg-blue-50",
    roles: ["owner", "manager", "branch_manager", "sales_person"]
  },
  {
    title: "Shadow POS",
    description: "SIS Unbilled Checkout",
    href: "/shadow-pos",
    icon: ScanLine,
    color: "text-cyan-600 bg-cyan-50",
    roles: ["owner", "manager", "shadow_manager", "shadow_sales"]
  },
  {
    title: "Discovery",
    description: "Scan & quote products",
    href: "/discovery",
    icon: Search,
    color: "text-indigo-600 bg-indigo-50",
    roles: ["owner", "manager", "branch_manager", "sales_person", "shadow_manager", "shadow_sales"]
  },
  {
    title: "Vault Inventory",
    description: "Manage branch stock",
    href: "/inventory",
    icon: Package,
    color: "text-emerald-600 bg-emerald-50",
    roles: ["owner", "manager", "operations_manager", "branch_manager"]
  },
  {
    title: "Logistics",
    description: "Stock transfers & approvals",
    href: "/transfer",
    icon: ArrowRightLeft,
    color: "text-amber-600 bg-amber-50",
    roles: ["owner", "manager", "operations_manager"]
  },
  {
    title: "Customer CRM",
    description: "Client history & rewards",
    href: "/crm",
    icon: Users,
    color: "text-rose-600 bg-rose-50",
    roles: ["owner", "manager", "branch_manager", "sales_person", "shadow_manager", "shadow_sales"]
  },
  {
    title: "Daily Accounts",
    description: "Cashbook & closing",
    href: "/accounts",
    icon: Wallet,
    color: "text-teal-600 bg-teal-50",
    roles: ["owner", "manager", "branch_manager", "shadow_manager"]
  },
  {
    title: "Voucher Desk",
    description: "Issue & redeem vouchers",
    href: "/vouchers",
    icon: Ticket,
    color: "text-purple-600 bg-purple-50",
    roles: ["owner", "manager", "voucher_manager"]
  },
  {
    title: "Master Topology",
    description: "Global network canvas",
    href: "/topology", 
    icon: Server,
    color: "text-slate-700 bg-slate-100",
    roles: ["owner", "manager"]
  }
]

export default function MainDashboard() {
  const { appUser, loading: authLoading } = useAuth()
  const { isHQ } = useStoreLocation() 
  const [greeting, setGreeting] = useState("")
  const [showNotice, setShowNotice] = useState(true) 

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting("Good morning")
    else if (hour < 18) setGreeting("Good afternoon")
    else setGreeting("Good evening")
  }, [])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] p-4 sm:p-8 flex flex-col space-y-6">
        <Skeleton className="h-14 w-full max-w-[1200px] mx-auto rounded-lg" />
        <Skeleton className="h-32 w-full max-w-[1200px] mx-auto rounded-2xl" />
        <Skeleton className="h-64 w-full max-w-[1200px] mx-auto rounded-2xl mt-4" />
      </div>
    )
  }

  if (!appUser) return null

  const permittedModules = APP_MODULES.filter(module => 
    module.roles.includes(appUser.role || "sales_person")
  )

  const firstName = appUser.full_name?.split(' ')[0] || 'there'
  const initial = appUser.full_name ? appUser.full_name.charAt(0).toUpperCase() : 'U'
  
  // Security Flag for Business Analytics Section
  const canViewBusinessOverview = ['owner', 'manager', 'operations_manager'].includes(appUser.role || "");

  return (
    <div className="min-h-screen bg-[#f8f9fb] pb-24 font-sans selection:bg-indigo-100">
      
      {/* 1. PREMIUM HEADER (Seamlessly aligned with sidebar) */}
      <header className="hidden sm:flex items-center h-[60px] bg-[#0f172a] text-white px-8 sticky top-0 z-30 border-b border-slate-800">
        <div className="max-w-[1200px] mx-auto flex w-full items-center justify-between">
          
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2">
                <div className="h-6 w-6 bg-white rounded flex items-center justify-center">
                  <Box className="w-4 h-4 text-[#0f172a]" />
                </div>
                <h1 className="text-[15px] font-bold tracking-tight leading-none">
                  Biillo <span className="font-normal text-slate-400">OS</span>
                </h1>
             </div>
             
             <nav className="flex items-center gap-6 text-[13px] font-medium text-slate-300 h-[60px]">
                <Link href="/" className="text-white flex items-center h-full gap-2 border-b-[3px] border-[#0052FF]">
                   <Building2 className="w-3.5 h-3.5" /> Home
                </Link>
                <Link href="/inventory" className="hover:text-white transition-colors flex items-center h-full gap-2 border-b-[3px] border-transparent hover:border-slate-600">
                   <Package className="w-3.5 h-3.5" /> Inventory
                </Link>
                <Link href="/accounts" className="hover:text-white transition-colors flex items-center h-full gap-2 border-b-[3px] border-transparent hover:border-slate-600">
                   <Wallet className="w-3.5 h-3.5" /> Revenue+
                </Link>
             </nav>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-800 text-[13px] h-8">
              <Search className="w-3.5 h-3.5 mr-2" /> Search...
            </Button>
            <div className="h-8 w-8 bg-slate-800 rounded-full flex items-center justify-center text-sm font-bold border border-slate-700 cursor-pointer hover:bg-slate-700 transition-colors">
              {initial}
            </div>
          </div>
        </div>
      </header>

      {/* 2. SLIM NEWS TICKER (Attached to header bottom) */}
      {showNotice && (
        <div className="bg-indigo-50 border-b border-indigo-100 px-4 sm:px-8 py-2 flex items-center justify-between z-20 sticky top-0 sm:top-[52px]">
          <div className="max-w-[1200px] mx-auto w-full flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 overflow-hidden text-ellipsis whitespace-nowrap">
              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-200/50 px-2 py-0.5 rounded-sm shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> System
              </span>
              <span className="text-[12px] font-medium text-indigo-900 truncate">
                You're all caught up, {firstName}. There are no actions that need your attention on Biillo today.
              </span>
            </div>
            <button onClick={() => setShowNotice(false)} className="text-indigo-400 hover:text-indigo-700 shrink-0 transition-colors p-0.5 rounded-full hover:bg-indigo-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <main className="px-4 sm:px-8 pt-6 sm:pt-8 max-w-[1200px] mx-auto space-y-10">

        {/* 3. RECOMMENDED FOR YOU (Horizontal Sleek Pills) */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4 tracking-tight">Recommended for you</h2>
          
          <div className="flex overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap gap-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <style dangerouslySetInnerHTML={{__html: `::-webkit-scrollbar { display: none; }`}} />
            
            {permittedModules.map((module) => (
              <Link key={module.title} href={module.href} className="flex-shrink-0">
                <div className="bg-white rounded-xl p-3 sm:p-4 w-[140px] sm:w-[150px] border border-slate-200 shadow-sm hover:shadow-md hover:border-[#0052FF]/30 transition-all active:scale-[0.98] flex flex-col gap-3 cursor-pointer group h-full">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${module.color}`}>
                    <module.icon className="w-4 h-4" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-700 text-[13px] leading-tight group-hover:text-[#0052FF] transition-colors">
                      {module.title}
                    </h3>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 4. BUSINESS OVERVIEW (Grid Layout, Secure Access) */}
        {canViewBusinessOverview && (
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
               <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Your business with Biillo</h2>
                  <Badge variant="outline" className="bg-white text-slate-500 font-medium text-[10px] px-2 py-0 h-5 border-slate-200 hidden sm:flex items-center gap-1 shadow-none">
                    <Clock className="w-2.5 h-2.5" /> Updated just now
                  </Badge>
               </div>
               
               <Select defaultValue="today">
                  <SelectTrigger className="h-8 text-xs font-semibold bg-white border-slate-200 w-[130px] shadow-sm">
                    <SelectValue placeholder="Timeframe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last 7 Days</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                  </SelectContent>
               </Select>
            </div>

            {/* Clean Grid Setup */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
               
               {/* Card 1: Vault Overview */}
               <div className="bg-white border border-slate-200 rounded-[16px] p-6 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] flex flex-col justify-between hover:border-slate-300 transition-colors group relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-10 opacity-50 group-hover:bg-emerald-100 transition-colors"></div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><Database className="w-3.5 h-3.5"/> Active Vault</span>
                      <Activity className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="flex items-end gap-2.5 mb-1">
                       <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter leading-none">₹14.2<span className="text-xl sm:text-2xl text-slate-400 font-bold tracking-normal">M</span></h3>
                    </div>
                    <div className="flex items-center text-[11px] font-bold text-emerald-600 mb-6">
                      <TrendingUp className="w-3 h-3 mr-1" /> 2.4% vs last week
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-100">
                     <div className="flex justify-between items-center text-[12px] font-medium text-slate-600">
                       <span className="flex items-center gap-1.5"><Store className="w-4 h-4 text-slate-400"/> Main Office</span>
                       <span className="font-bold text-slate-900">₹12.0M</span>
                     </div>
                     <Link href="/inventory" className="flex justify-between items-center text-[12px] font-bold text-[#0052FF] hover:text-blue-800 transition-colors group/link">
                       <span className="flex items-center gap-1.5"><Truck className="w-4 h-4"/> In Transit</span>
                       <span className="flex items-center">₹2.2M <ChevronRight className="w-3.5 h-3.5 ml-1 group-hover/link:translate-x-1 transition-transform" /></span>
                     </Link>
                  </div>
               </div>

               {/* Card 2: Action Center / Sales */}
               <div className="bg-white border border-slate-200 rounded-[16px] p-6 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] flex flex-col justify-between hover:border-slate-300 transition-colors">
                  <div className="space-y-4">
                    <Link href="/transfer" className="block">
                      <div className="bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl p-3.5 flex items-center justify-between transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="bg-amber-100 text-amber-700 p-1.5 rounded-lg"><ArrowRightLeft className="w-4 h-4" /></div>
                          <span className="text-[13px] font-bold text-slate-800 group-hover:text-[#0052FF] transition-colors">Pending Transfers</span>
                        </div>
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white shadow-none border-none">3</Badge>
                      </div>
                    </Link>
                    
                    <Link href="/repairs" className="block">
                      <div className="bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl p-3.5 flex items-center justify-between transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="bg-rose-100 text-rose-700 p-1.5 rounded-lg"><Wrench className="w-4 h-4" /></div>
                          <span className="text-[13px] font-bold text-slate-800 group-hover:text-[#0052FF] transition-colors">Overdue Repairs</span>
                        </div>
                        <Badge className="bg-rose-500 hover:bg-rose-600 text-white shadow-none border-none">1</Badge>
                      </div>
                    </Link>
                  </div>

                  <div className="mt-6 pt-5 border-t border-slate-100">
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                       <Wallet className="w-3.5 h-3.5" /> Today's Sales
                     </p>
                     <h4 className="text-2xl font-black text-slate-900 tracking-tight">₹45,210</h4>
                  </div>
               </div>

               {/* Card 3: Discovery/AI Feature Box */}
               <div className="bg-[#0f172a] rounded-[16px] p-6 shadow-lg relative overflow-hidden group border border-slate-800 flex flex-col justify-between">
                  <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-[#0052FF] rounded-full blur-3xl opacity-30 group-hover:opacity-50 transition-opacity duration-500 pointer-events-none"></div>
                  
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                      <div className="bg-white/10 p-2 rounded-lg backdrop-blur-md">
                        <Search className="w-5 h-5 text-blue-300" />
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1 flex items-center gap-1.5"><Sparkles className="w-3 h-3"/> AI Engine</span>
                    <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Smart Discovery</h3>
                    <p className="text-[12px] text-slate-400 leading-relaxed line-clamp-3">
                      Use natural language to instantly locate specific SKUs, check purities, and filter inventory across your entire network.
                    </p>
                  </div>

                  <Button className="w-full bg-white text-slate-900 hover:bg-slate-100 h-10 text-[13px] font-bold mt-6 relative z-10" asChild>
                    <Link href="/discovery">Launch Discovery <ArrowRight className="w-4 h-4 ml-2"/></Link>
                  </Button>
               </div>
            </div>
          </section>
        )}

        {/* 5. PROMO BANNER (Razorpay 'Key Updates' Style) */}
        <section className="pt-4 pb-12">
          <div className="bg-gradient-to-r from-[#002147] via-[#00388A] to-[#0052FF] rounded-[16px] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8 relative overflow-hidden shadow-md border border-[#002147]">
             
             {/* Graphic Elements */}
             <div className="absolute right-10 bottom-0 opacity-20 pointer-events-none">
               <Box className="w-48 h-48 text-white rotate-12" />
             </div>
             
             <div className="relative z-10 max-w-lg">
                <h2 className="text-xl sm:text-[22px] font-bold text-white tracking-tight mb-3">
                  Biillo OS v2.4 Update is Live!
                </h2>
                <p className="text-blue-100 text-[13px] font-medium leading-relaxed mb-6 max-w-md">
                  We've rolled out the new Natural Language AI Search Engine and bulk thermal printing tools. Your workflow just got significantly faster.
                </p>
                <Button className="bg-[#00D09C] hover:bg-[#00B88A] text-white font-bold text-[13px] h-10 px-6 rounded-lg border-none shadow-none transition-colors">
                  Read Release Notes
                </Button>
             </div>

             <div className="relative z-10 hidden lg:flex flex-col gap-4 text-white min-w-[220px]">
                <div className="flex items-center gap-3 group cursor-pointer">
                  <div className="text-[13px] font-medium text-blue-200 group-hover:text-white transition-colors flex-1">Instant Speed Boost</div>
                  <div className="text-[13px] font-bold text-[#00D09C]">85%</div>
                </div>
                <div className="h-px w-full bg-white/10"></div>
                <div className="flex items-center gap-3 group cursor-pointer">
                  <div className="text-[13px] font-medium text-blue-200 group-hover:text-white transition-colors flex-1">New Features</div>
                  <div className="text-[13px] font-bold text-white">AI Search</div>
                </div>
                <div className="h-px w-full bg-white/10"></div>
                <div className="flex items-center gap-3 group cursor-pointer">
                  <div className="text-[13px] font-medium text-blue-200 group-hover:text-white transition-colors flex-1">System Status</div>
                  <div className="text-[13px] font-bold text-[#00D09C] flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00D09C] animate-pulse"></div> Stable
                  </div>
                </div>
             </div>
          </div>
        </section>

      </main>
    </div>
  )
}