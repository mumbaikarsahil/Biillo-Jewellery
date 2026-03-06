'use client'

import React from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Building2, 
  Warehouse, 
  Users, 
  Hammer, 
  UsersRound, 
  ChevronRight, 
  Settings2,
  ShieldCheck,
  Activity,
  LayoutGrid,
  Info
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
      <div className="flex flex-col h-screen bg-background">
        <div className="h-12 border-b border-border bg-card px-4 flex items-center"><Skeleton className="h-4 w-32" /></div>
        <div className="p-8 space-y-8 max-w-5xl mx-auto w-full">
           <Skeleton className="h-10 w-64" />
           <div className="grid grid-cols-3 gap-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      
      {/* --- SYSTEM TOOLBAR --- */}
      <header className="sticky top-0 z-40 w-full bg-card border-b border-border px-4 h-12 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <Separator orientation="vertical" className="h-4" />
          <nav className="flex items-center gap-2 text-sm">
            <span className="font-bold text-foreground tracking-tight uppercase text-xs">Configuration Hub</span>
          </nav>
        </div>

        <div className="flex items-center gap-4">
           <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded border border-emerald-200/50 bg-emerald-500/5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Registry Sync Active</span>
           </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-10 max-w-[1200px] w-full mx-auto space-y-12 animate-in fade-in duration-500">
        
        {/* HERO SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
           <div className="space-y-1.5">
              <h1 className="text-2xl font-black tracking-tight text-foreground uppercase">System Registry</h1>
              <p className="text-sm text-muted-foreground max-w-xl">Configure core operational nodes, define artisan rates, and manage the legal architecture of your business.</p>
           </div>
           
           <div className="flex items-center gap-3 bg-secondary/30 p-4 rounded-xl border border-border shrink-0 w-full md:w-auto">
              <div className="h-10 w-10 rounded-lg bg-card border border-border flex items-center justify-center">
                 <ShieldCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1.5">Setup Health</p>
                 <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-foreground leading-none tracking-tight">OPERATIONAL</span>
                    <Badge className="bg-emerald-500 text-white border-none text-[8px] h-4">v1.0.4</Badge>
                 </div>
              </div>
           </div>
        </div>

        {/* CATEGORY GRID */}
        <div className="space-y-16">
          {masterMenu.map((section, idx) => (
            <div key={idx} className="space-y-6">
               <div className="flex items-center gap-4">
                  <div className="p-2 bg-secondary rounded-md border border-border">
                    <section.icon className="h-4 w-4 text-slate-700" />
                  </div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-foreground">{section.category}</h3>
                  <div className="h-px flex-1 bg-border/60"></div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {section.items.map((item) => (
                    <Link href={item.href} key={item.title} className="group block">
                      <Card className="h-full border-2 border-border/40 bg-card hover:border-foreground/20 hover:shadow-xl transition-all duration-200 cursor-pointer overflow-hidden rounded-sm relative active:scale-[0.98]">
                        
                        {/* Hover Accent */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-secondary group-hover:bg-foreground/10 transition-colors" />

                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-4">
                             <div className="p-2.5 bg-secondary/50 rounded border border-border group-hover:bg-foreground group-hover:text-background transition-all">
                                <item.icon className="w-5 h-5" />
                             </div>
                             <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-foreground transition-all group-hover:translate-x-1" />
                          </div>
                          
                          <div className="space-y-1.5">
                             <h4 className="text-sm font-bold text-foreground uppercase tracking-tight group-hover:text-primary transition-colors">
                                {item.title}
                             </h4>
                             <p className="text-[11px] leading-relaxed text-muted-foreground font-medium">
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
        <div className="flex items-start gap-3 px-5 py-4 rounded-xl bg-secondary/20 border border-border/60 mt-12">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-relaxed">
            Registry modifications require administrative privileges. All changes to company profile or warehouse configurations are permanently recorded in the <span className="text-foreground underline underline-offset-4 decoration-border">System Audit Trail</span>.
          </p>
        </div>

      </main>
    </div>
  )
}