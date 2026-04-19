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
  Megaphone, // Added for notice
  X          // Added for close button
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button" 

// --- CENTRALIZED ROLE-BASED ACCESS CONTROL (RBAC) ---
const APP_MODULES = [
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
    title: "Vault Inventory",
    description: "Manage branch stock",
    href: "/inventory",
    icon: Package,
    color: "bg-emerald-500",
    shadow: "shadow-emerald-500/20",
    roles: ["owner", "manager", "operations_manager", "branch_manager"]
  },
  {
    title: "Logistics",
    description: "Stock transfers & approvals",
    href: "/transfer",
    icon: ArrowRightLeft,
    color: "bg-amber-500",
    shadow: "shadow-amber-500/20",
    roles: ["owner", "manager", "operations_manager"]
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
  },
  {
    title: "Daily Accounts",
    description: "Cashbook & daily closing",
    href: "/accounts",
    icon: Wallet,
    color: "bg-teal-500",
    shadow: "shadow-teal-500/20",
    roles: ["owner", "manager", "branch_manager", "shadow_manager"]
  }
]

export default function MainDashboard() {
  const { appUser, loading: authLoading } = useAuth()
  const { isHQ } = useStoreLocation() 
  const [greeting, setGreeting] = useState("")
  const [showNotice, setShowNotice] = useState(true) // Control notice visibility

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting("Good morning")
    else if (hour < 18) setGreeting("Good afternoon")
    else setGreeting("Good evening")
  }, [])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] p-6 flex flex-col space-y-6">
        <Skeleton className="h-16 w-full max-w-5xl mx-auto rounded-md" />
        <Skeleton className="h-64 w-full max-w-5xl mx-auto rounded-xl" />
      </div>
    )
  }

  if (!appUser) return null

  const permittedModules = APP_MODULES.filter(module => 
    module.roles.includes(appUser.role || "sales_person")
  )

  const initial = appUser.full_name ? appUser.full_name.charAt(0).toUpperCase() : 'U'

  return (
    <div className="min-h-screen bg-[#fafafa] pb-24 font-sans selection:bg-indigo-100">
      
      {/* 1. Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 sm:py-5 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="h-10 w-10 sm:h-11 sm:w-11 bg-gradient-to-tr from-slate-200 to-slate-100 border border-slate-200 rounded-full flex items-center justify-center text-slate-700 font-semibold shadow-sm shrink-0">
              {initial}
            </div>
            
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight leading-none">
                  {appUser.full_name || 'Team Member'}
                </h1>
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider leading-none">
                  {appUser.role?.replace('_', ' ')}
                </span>
              </div>
              
              <p className="text-[11px] sm:text-xs text-slate-500 mt-1.5 font-medium flex items-center gap-1.5 leading-none">
                <Clock className="w-3 h-3 text-slate-400" /> {greeting} 
                <span className="text-slate-300 mx-0.5">•</span> 
                {isHQ ? "Headquarters" : "Branch Terminal"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/master">
              <Button variant="outline" size="sm" className="h-8 sm:h-9 px-3 sm:px-4 text-xs font-medium text-slate-700 border-slate-200 shadow-none hover:bg-slate-50 transition-none">
                <Settings className="w-3.5 h-3.5 sm:mr-2" /> 
                <span className="hidden sm:inline">Settings</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. SYSTEM NOTICE BAR (Below Header) */}
      {showNotice && (
        <div className="bg-indigo-50 border-b border-indigo-100 animate-in slide-in-from-top duration-500">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="bg-indigo-100 p-1.5 rounded-md">
                <Megaphone className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-indigo-900 leading-tight">
                <span className="font-bold uppercase mr-1">Notice:</span> 
              All systems normal. No issues reported. Currently updation of the claim page and voucher functionality is in progress.
              </p>
            </div>
            <button 
              onClick={() => setShowNotice(false)}
              className="text-indigo-400 hover:text-indigo-600 transition-colors p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Quick Action "App" Grid */}
      <main className="px-4 sm:px-5 pt-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
            Your Workspace
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {permittedModules.map((module) => (
            <Link key={module.title} href={module.href}>
              <div className="bg-white rounded-2xl p-4 h-full border border-slate-200/60 shadow-sm hover:shadow-md transition-all active:scale-[0.98] group flex flex-col justify-between cursor-pointer relative overflow-hidden">
                
                <div className={`absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-10 group-hover:opacity-20 transition-opacity ${module.color} blur-xl`} />

                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white mb-3 sm:mb-4 ${module.color} ${module.shadow} shadow-lg`}>
                  <module.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                
                <div>
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
      </main>

    </div>
  )
}