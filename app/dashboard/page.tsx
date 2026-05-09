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
  Wallet,
  ScanLine,
  Megaphone,
  X,
  Sparkles,
  PieChart,
  SlidersHorizontal,
  ShoppingBag,
  Hammer,
  BookOpen
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"

// --- CENTRALIZED ROLE-BASED ACCESS CONTROL (RBAC) & MODULE REGISTRY ---
const APP_MODULES = [
  // Core Modules
  {
    title: "POS Register",
    description: "Start a new billing session",
    href: "/pos",
    icon: ShoppingCart,
    color: "bg-indigo-500",
    shadow: "shadow-indigo-500/20",
    roles: ["owner", "manager", "branch_manager", "sales_person"]
  },
  {
    title: "Shadow POS",
    description: "SIS Unbilled Checkout",
    href: "/shadow-pos",
    icon: ScanLine,
    color: "bg-cyan-600",
    shadow: "shadow-cyan-600/20",
    roles: ["owner", "manager", "shadow_manager", "shadow_sales"]
  },
  {
    title: "Discovery",
    description: "Scan & quote products",
    href: "/discovery",
    icon: Search,
    color: "bg-blue-500",
    shadow: "shadow-blue-500/20",
    roles: ["owner", "manager", "branch_manager", "sales_person", "shadow_manager", "shadow_sales"]
  },
  {
    title: "Master Topology",
    description: "Global HQ network canvas",
    href: "/topology", 
    icon: Server,
    color: "bg-slate-800",
    shadow: "shadow-slate-800/20",
    roles: ["owner", "manager"]
  },
  {
    title: "Revenue",
    description: "Sales ledger & cashbook",
    href: "/sales",
    icon: Wallet,
    color: "bg-teal-500",
    shadow: "shadow-teal-500/20",
    roles: ["owner", "manager", "branch_manager"]
  },
  {
    title: "Analytics",
    description: "Intelligence & reporting",
    href: "/reports",
    icon: PieChart,
    color: "bg-fuchsia-500",
    shadow: "shadow-fuchsia-500/20",
    roles: ["owner", "manager", "branch_manager"]
  },

  // Operations Modules
  {
    title: "Master Config",
    description: "System & branch settings",
    href: "/master", 
    icon: SlidersHorizontal,
    color: "bg-zinc-600",
    shadow: "shadow-zinc-600/20",
    roles: ["owner", "manager"]
  },
  {
    title: "Procurement",
    description: "Vendor orders & intake",
    href: "/purchases",
    icon: ShoppingBag,
    color: "bg-orange-500",
    shadow: "shadow-orange-500/20",
    roles: ["owner", "manager", "operations_manager"]
  },
  {
    title: "Fabrication",
    description: "Manufacturing job bags",
    href: "/manufacturing/job-bags",
    icon: Hammer,
    color: "bg-yellow-600",
    shadow: "shadow-yellow-600/20",
    roles: ["owner", "manager", "operations_manager"]
  },
  {
    title: "Vault Stock",
    description: "Manage branch stock",
    href: "/inventory",
    icon: Package,
    color: "bg-emerald-500",
    shadow: "shadow-emerald-500/20",
    roles: ["owner", "manager", "operations_manager", "branch_manager"]
  },
  {
    title: "Catalog",
    description: "Digital product catalog",
    href: "/catalog",
    icon: BookOpen,
    color: "bg-pink-500",
    shadow: "shadow-pink-500/20",
    roles: ["owner", "manager", "operations_manager", "branch_manager"]
  },
  {
    title: "Logistics",
    description: "Stock transfers & approvals",
    href: "/transfer",
    icon: ArrowRightLeft,
    color: "bg-amber-500",
    shadow: "shadow-amber-500/20",
    roles: ["owner", "manager", "operations_manager", "branch_manager", "shadow_manager"]
  },
  {
    title: "Customer CRM",
    description: "Client history & rewards",
    href: "/crm",
    icon: Users,
    color: "bg-rose-500",
    shadow: "shadow-rose-500/20",
    roles: ["owner", "manager", "branch_manager", "sales_person", "shadow_manager", "shadow_sales"]
  },
  {
    title: "Voucher Desk",
    description: "Issue & redeem vouchers",
    href: "/vouchers",
    icon: Ticket,
    color: "bg-purple-500",
    shadow: "shadow-purple-500/20",
    roles: ["owner", "manager", "voucher_manager"]
  }
]

export default function MainDashboard() {
  const { appUser, loading: authLoading } = useAuth()
  const { isHQ } = useStoreLocation() 
  const [greeting, setGreeting] = useState("")
  const [showNotice, setShowNotice] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting("Good morning")
    else if (hour < 18) setGreeting("Good afternoon")
    else setGreeting("Good evening")
  }, [])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] p-6 flex flex-col space-y-6">
        <Skeleton className="h-32 w-full max-w-5xl mx-auto rounded-xl mt-12" />
        <Skeleton className="h-64 w-full max-w-5xl mx-auto rounded-xl" />
      </div>
    )
  }

  if (!appUser) return null

  // 1. Determine which modules the user is allowed to see
  const permittedModules = APP_MODULES.filter(module => 
    module.roles.includes(appUser.role || "sales_person")
  )

  // 2. Filter those allowed modules based on the search query
  const filteredModules = permittedModules.filter(module => 
    module.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    module.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="relative min-h-screen bg-[#fafafa] pb-24 font-sans selection:bg-indigo-100 overflow-hidden">
      
      {/* ✨ 1. THE GEMINI AI AURA BACKGROUND ✨ */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-gradient-to-r from-[#4285F4]/15 via-[#9b72cb]/15 to-[#d96570]/15 blur-[100px] rounded-full pointer-events-none -z-10" />

      {/* ✨ 2. UPGRADED FLUID GRADIENT ANIMATION ✨ */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes geminiTextPan {
          0% { background-position: 0% center; }
          100% { background-position: -200% center; }
        }
        .gemini-text {
          background: linear-gradient(
            to right,
            #4285f4 0%,
            #9b72cb 30%,
            #d96570 50%,
            #9b72cb 70%,
            #4285f4 100%
          );
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: geminiTextPan 4s linear infinite;
        }
      `}} />

      {/* 3. THE AI GREETING SECTION */}
      <section className="px-4 sm:px-6 pt-8 sm:pt-12 pb-6 max-w-5xl mx-auto relative z-20">
        <div className="flex items-center gap-2 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <Sparkles className="w-5 h-5 text-[#4285F4] animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            {isHQ ? "Headquarters Terminal" : "Branch Terminal"}
          </span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-medium tracking-tight text-slate-800 animate-in fade-in slide-in-from-bottom-3 duration-700">
          <span className="gemini-text font-semibold">{greeting}, {appUser.full_name?.split(' ')[0] || 'Team'}</span><br />
          How can I help you today?
        </h1>
      </section>

      {/* 4. FLOATING GLASSMORPHISM NOTICE PILL */}
      {showNotice && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 relative z-20">
          <div className="bg-white/70 backdrop-blur-xl border border-white/60 p-1.5 rounded-2xl flex items-center justify-between gap-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center gap-3 pl-2">
              <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-1.5 rounded-full shadow-inner">
                <Megaphone className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-xs font-medium text-slate-700 leading-tight">
                <span className="font-bold text-slate-900 mr-1">Notice:</span> 
                All systems normal. Updation of the claim page and voucher functionality is in progress.
              </p>
            </div>
            <button 
              onClick={() => setShowNotice(false)}
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-200/50 text-slate-400 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 5. GEMINI INSPIRED SEARCH BAR */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-10 relative z-20 animate-in fade-in slide-in-from-bottom-5 duration-700 delay-200">
        <div className="relative w-full max-w-2xl group">
          <div className="absolute -inset-[2px] rounded-full bg-gradient-to-r from-[#4285F4] via-[#9b72cb] to-[#d96570] blur-md opacity-0 group-focus-within:opacity-25 transition-opacity duration-500"></div>
          <div className="relative flex items-center bg-white/90 backdrop-blur-xl rounded-full ring-1 ring-slate-200 shadow-sm p-1.5 z-10 transition-all focus-within:ring-0 focus-within:border-transparent">
            <div className="pl-4 pr-2 text-[#0052FF]">
              <Sparkles className="w-5 h-5" />
            </div>
            <Input
              placeholder="Search apps and modules..."
              className="flex-1 h-12 border-0 outline-none ring-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-[15px] font-medium placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <div className="pr-3">
                <button 
                  onClick={() => setSearchQuery('')}
                  className="p-1.5 text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6. WORKSPACE GRID */}
      <main className="px-4 sm:px-6 max-w-5xl mx-auto relative z-20 animate-in fade-in slide-in-from-bottom-5 duration-700 delay-300">
        <div className="flex items-center justify-between mb-5 px-1">
          <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
            Your Workspace
          </h3>
        </div>

        {filteredModules.length === 0 ? (
          <div className="text-center py-12 bg-white/50 backdrop-blur-sm border border-slate-200/60 rounded-3xl">
            <p className="text-sm font-medium text-slate-500">No modules found matching "{searchQuery}"</p>
            <button 
              type="button"
              onClick={() => setSearchQuery('')} 
              className="mt-3 text-indigo-600 hover:text-indigo-800 font-bold text-xs transition-colors"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {filteredModules.map((module) => (
              <Link key={module.title} href={module.href}>
                <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 h-full border border-slate-200/60 shadow-sm hover:shadow-md transition-all active:scale-[0.98] group flex flex-col justify-between cursor-pointer relative overflow-hidden">
                  
                  <div className={`absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-10 group-hover:opacity-20 transition-opacity ${module.color} blur-xl`} />

                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white mb-3 sm:mb-4 ${module.color} ${module.shadow} shadow-lg relative z-10`}>
                    <module.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  
                  <div className="relative z-10">
                    <h3 className="font-bold text-slate-800 text-xs sm:text-sm group-hover:text-indigo-600 transition-colors">
                      {module.title}
                    </h3>
                    <p className="text-[9px] sm:text-[10px] text-slate-500 mt-1 font-medium leading-tight line-clamp-2">
                      {module.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

    </div>
  )
}