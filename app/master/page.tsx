'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Building2, 
  Warehouse, 
  Users, 
  Hammer, 
  UsersRound, 
  Landmark, 
  ChevronRight, 
  CheckCircle2, 
  Settings,
  ShieldCheck
} from 'lucide-react'

// --- Menu Configuration ---
// Defined here for easy expansion later
const masterMenu = [
  {
    category: "Organization",
    items: [
      { 
        title: "Company Profile", 
        icon: Building2, 
        href: "/master/company", 
        description: "Manage legal details, logos, and tax configurations." 
      },
      { 
        title: "Warehouses", 
        icon: Warehouse, 
        href: "/master/warehouse", 
        description: "Configure storage locations and inventory points." 
      },
      { 
        title: "Suppliers", 
        icon: Users, 
        href: "/master/suppliers", 
        description: "Manage your suppliers, contacts, and payment terms." 
      },
    ]
  },
  {
    category: "People & Parties",
    items: [
      { 
        title: "Users & Roles", 
        icon: Users, 
        href: "/master/users", 
        description: "Invite team members and assign access permissions." 
      },
      { 
        title: "Karigars (Artisans)", 
        icon: Hammer, 
        href: "/master/karigar", 
        description: "Manage artisans, labor rates, and job work details." 
      },
      { 
        title: "Customers", 
        icon: UsersRound, 
        href: "/master/customer", 
        description: "Customer database, KYC, and credit limits." 
      },
    ]
  }
]

export default function MasterPage() {
  const { appUser, loading } = useAuth()
  const router = useRouter()

  if (loading || !appUser) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground animate-pulse">Loading Master Setup...</div>
  }

  return (
    <div className="min-h-screen bg-muted/40 pb-20">
      
      {/* Top Header Bar */}
      <div className="bg-background border-b sticky top-0 z-20">
        <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Settings className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight leading-none">Master Setup</h1>
                <p className="text-xs text-muted-foreground mt-0.5">System Configuration Hub</p>
              </div>
           </div>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 py-8 space-y-8">
        
        {/* Welcome & Progress Section */}
        <div className="flex flex-col md:flex-row gap-6 md:items-start justify-between">
           <div className="space-y-1 max-w-2xl">
             <h2 className="text-2xl font-bold tracking-tight">Welcome, {appUser.email || 'Admin'}</h2>
             <p className="text-muted-foreground">Manage the core settings and directories for your jewelry business. Ensure all mandatory fields are filled before starting operations.</p>
           </div>
           
           {/* Setup Progress Widget */}
           <Card className="w-full md:w-72 bg-white border-dashed shadow-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-600" /> Setup Health
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                 <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-foreground">Good</span>
                    <span className="text-xs text-muted-foreground">All systems active</span>
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* Menu Grid */}
        <div className="space-y-10">
          {masterMenu.map((section, idx) => (
            <div key={idx} className="space-y-4">
               <div className="flex items-center gap-2">
                 <div className="h-px flex-1 bg-border/60"></div>
                 <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-2">{section.category}</h3>
                 <div className="h-px flex-1 bg-border/60"></div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {section.items.map((item) => (
                    <Link href={item.href} key={item.title} className="group block h-full">
                      <Card className="h-full border bg-card transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer group-hover:-translate-y-1">
                        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                          <div className="p-2.5 bg-muted rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <item.icon className="w-5 h-5" />
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                        </CardHeader>
                        <CardContent>
                          <CardTitle className="text-base font-semibold mb-1 group-hover:text-primary transition-colors">
                            {item.title}
                          </CardTitle>
                          <CardDescription className="line-clamp-2 text-sm">
                            {item.description}
                          </CardDescription>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
               </div>
            </div>
          ))}
        </div>

        {/* Footer Hint */}
        <div className="text-center pt-8 pb-4">
           <p className="text-xs text-muted-foreground">Need help with setup? Contact support or view the documentation.</p>
        </div>

      </div>
    </div>
  )
}