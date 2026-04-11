'use client'

import React from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { 
  Building2, 
  Warehouse, 
  Users, 
  Hammer, 
  UsersRound, 
  ChevronRight, 
  Settings2,
  ShieldCheck,
  LayoutGrid,
  Info,
  LayoutDashboard,
  Database
} from 'lucide-react'

const masterMenu = [
  {
    category: "Organization Registry",
    icon: LayoutGrid,
    items: [
      { 
        title: "Company Profile", 
        icon: Building2, 
        href: "/master/company", 
        description: "Legal entities, tax IDs, and brand configurations." 
      },
      { 
        title: "Vaults & Warehouses", 
        icon: Warehouse, 
        href: "/master/warehouse", 
        description: "Physical storage locations and inventory nodes." 
      },
      { 
        title: "Supply Chain", 
        icon: Users, 
        href: "/master/suppliers", 
        description: "External vendors, procurement terms, and contacts." 
      },
    ]
  },
  {
    category: "Entity Management",
    icon: UsersRound,
    items: [
      { 
        title: "Internal Users", 
        icon: Users, 
        href: "/master/users", 
        description: "Access control, roles, and session permissions." 
      },
      { 
        title: "Karigars (Artisans)", 
        icon: Hammer, 
        href: "/master/karigar", 
        description: "Workshop management and labor rate tables." 
      },
      { 
        title: "Client Directory", 
        icon: UsersRound, 
        href: "/master/customer", 
        description: "Customer KYC, credit ledgers, and trade history." 
      },
    ]
  }
]

export default function MasterPage() {
  const { appUser, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-[#F8F9FA]">
        <div className="h-14 border-b border-gray-200/60 bg-white/80 px-4 flex items-center"><Skeleton className="h-4 w-32 rounded-full bg-gray-200" /></div>
        <div className="p-6 md:p-8 space-y-8 max-w-[1200px] mx-auto w-full">
           <Skeleton className="h-10 w-64 rounded-2xl bg-gray-200" />
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
             <Skeleton className="h-36 w-full rounded-[24px] bg-gray-200" />
             <Skeleton className="h-36 w-full rounded-[24px] bg-gray-200 hidden sm:block" />
             <Skeleton className="h-36 w-full rounded-[24px] bg-gray-200 hidden md:block" />
           </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA] font-sans">
      
      {/* --- MINIMAL HEADER --- */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-200/60 px-4 h-14 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
              <LayoutDashboard className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-5 bg-gray-200" />
          <nav className="flex items-center gap-1.5 text-[13px] whitespace-nowrap overflow-hidden">
            <span className="text-gray-500 font-medium hidden sm:inline">Administration</span>
            <ChevronRight className="h-3.5 w-3.5 text-gray-400 hidden sm:inline" strokeWidth={1.5} />
            <span className="font-bold text-gray-900 tracking-tight">Configuration Hub</span>
          </nav>
        </div>

        <div className="flex items-center gap-4">
           <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Registry Sync Active</span>
           </div>
           {/* Mobile Indicator */}
           <div className="sm:hidden h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-emerald-100" />
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10 max-w-[1200px] w-full mx-auto space-y-8 md:space-y-10 animate-in fade-in duration-500 pb-20">
        
        {/* HERO SECTION */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
           <div className="space-y-1.5 md:space-y-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">System Registry</h1>
              <p className="text-[13px] text-gray-500 font-medium max-w-xl leading-relaxed">Configure core operational nodes, define artisan rates, and manage the legal architecture of your business.</p>
           </div>
           
           <div className="flex items-center gap-3.5 bg-white p-3.5 md:p-4 rounded-[20px] border border-gray-200/60 shadow-sm shrink-0 w-full sm:w-auto">
              <div className="h-10 w-10 md:h-11 md:w-11 rounded-[12px] bg-emerald-50 flex items-center justify-center border border-emerald-100 shrink-0">
                 <ShieldCheck className="h-5 w-5 text-emerald-600" strokeWidth={2} />
              </div>
              <div className="flex flex-col justify-center">
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1.5">Setup Health</p>
                 <div className="flex items-center gap-2">
                    <span className="text-[14px] md:text-[15px] font-black text-gray-900 leading-none tracking-tight">OPERATIONAL</span>
                    <Badge variant="outline" className="border-emerald-200 text-emerald-600 bg-emerald-50 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0 hidden sm:inline-flex">v1.0.4</Badge>
                 </div>
              </div>
           </div>
        </div>

        {/* CATEGORY GRID */}
        <div className="space-y-10 md:space-y-12">
          {masterMenu.map((section, idx) => (
            <div key={idx} className="space-y-4 md:space-y-5">
               
               {/* SECTION HEADER */}
               <div className="flex items-center gap-3">
                  <div className="h-7 w-7 md:h-8 md:w-8 bg-gray-100 rounded-[10px] flex items-center justify-center border border-gray-200/60 shrink-0">
                    <section.icon className="h-3.5 w-3.5 md:h-4 md:w-4 text-gray-500" strokeWidth={2} />
                  </div>
                  <h3 className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-gray-400 truncate">{section.category}</h3>
                  <div className="h-px flex-1 bg-gray-200/60 ml-2"></div>
               </div>

               {/* CARDS */}
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-5">
                  {section.items.map((item) => (
                    <Link href={item.href} key={item.title} className="group block outline-none">
                      <Card className="h-full border border-gray-200/60 bg-white hover:border-blue-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 cursor-pointer overflow-hidden rounded-[20px] md:rounded-[24px] active:scale-[0.98]">
                        <CardContent className="p-4 md:p-5 lg:p-6 flex flex-col h-full">
                          <div className="flex items-start justify-between mb-4 md:mb-5">
                             <div className="h-9 w-9 md:h-10 md:w-10 bg-gray-50 rounded-[10px] md:rounded-[12px] flex items-center justify-center border border-gray-100 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-colors text-gray-500 shrink-0">
                                <item.icon className="w-4 h-4 md:w-4.5 md:h-4.5" strokeWidth={2} />
                             </div>
                             <div className="h-8 w-8 rounded-full flex items-center justify-center bg-transparent group-hover:bg-gray-50 transition-colors shrink-0">
                               <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-900 transition-colors" strokeWidth={2} />
                             </div>
                          </div>
                          
                          <div className="space-y-1 md:space-y-1.5 flex-1">
                             <h4 className="text-[14px] md:text-[15px] font-bold text-gray-900 tracking-tight group-hover:text-blue-600 transition-colors">
                                {item.title}
                             </h4>
                             <p className="text-xs md:text-[13px] leading-relaxed text-gray-500 font-medium">
                                {item.description}
                             </p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
               </div>
            </div>
          ))}
        </div>

        {/* SYSTEM LOG HINT */}
        <div className="flex items-start gap-3 p-4 md:p-5 rounded-[20px] bg-white border border-gray-200/60 mt-8 md:mt-10 shadow-sm">
          <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
            <Info className="h-4 w-4 text-blue-500" strokeWidth={2} />
          </div>
          <p className="text-[10px] md:text-[11px] text-gray-500 font-medium tracking-widest uppercase leading-relaxed pt-1 sm:pt-1.5">
            Registry modifications require administrative privileges. All changes to company profile or warehouse configurations are permanently recorded in the <span className="text-gray-900 font-bold underline decoration-gray-300 underline-offset-4 cursor-help">System Audit Trail</span>.
          </p>
        </div>

      </main>
    </div>
  )
}