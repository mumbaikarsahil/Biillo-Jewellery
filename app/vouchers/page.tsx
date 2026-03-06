"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Printer, 
  Store, 
  Send, 
  Search, 
  ArrowRight,
  PlusCircle,
  Loader2,
  TrendingUp,
  ChevronRight,
  RefreshCw,
  LayoutDashboard,
  Database,
  Info
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { 
  Card, 
  CardContent, 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function VouchersDashboard() {
  const { appUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    inStock: 0,
    distributed: 0,
    redeemed: 0,
    expired: 0,
  });

  const fetchStats = async () => {
    if (!appUser?.company_id) return;
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .select('status, voucher_batches!inner(company_id)')
        .eq('voucher_batches.company_id', appUser.company_id);

      if (error) throw error;

      const counts = (data || []).reduce((acc: any, curr: any) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
      }, {});

      setStats({
        inStock: counts['in_stock'] || 0,
        distributed: counts['distributed'] || 0,
        redeemed: counts['redeemed'] || 0,
        expired: counts['expired'] || 0,
      });

    } catch (error) {
      console.error("Failed to load voucher stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [appUser]);

  const voucherModules = [
    {
      title: "Generate",
      description: "Batch creation & export",
      icon: PlusCircle,
      href: "/vouchers/generate",
    },
    {
      title: "Batches",
      description: "Inventory ingestion",
      icon: Printer,
      href: "/vouchers/batches",
    },
    {
      title: "Distributors",
      description: "Partner management",
      icon: Store,
      href: "/vouchers/distributors",
    },
    {
      title: "Issue",
      description: "Transfer to partners",
      icon: Send,
      href: "/vouchers/distribute",
    },
    {
      title: "Audit",
      description: "Lifecycle tracking",
      icon: Search,
      href: "/vouchers/track",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* --- COMPACT IDE-STYLE TOOLBAR HEADER --- */}
      <header className="sticky top-0 z-40 w-full bg-background border-b border-border px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md">
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
            </Button>
          </Link>
          
          <Separator orientation="vertical" className="h-4" />
          
          <nav className="flex items-center gap-1.5 text-sm whitespace-nowrap overflow-hidden">
            <span className="text-muted-foreground font-medium">ERP</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground select-none">Voucher Management</span>
            
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary border border-border">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Active</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-2 text-xs font-medium text-muted-foreground"
            onClick={fetchStats}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="outline" size="sm" className="h-8 text-xs font-semibold px-3 border-border">
            <Database className="h-3.5 w-3.5 mr-1.5" />
            Voucher DB
          </Button>
        </div>
      </header>

      <main className="p-6 md:p-10 max-w-[1200px] w-full mx-auto space-y-10">
        
        {/* Module Grid - Clean, Vercel-like list */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tools & Operations</h2>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {voucherModules.map((module) => (
              <Link href={module.href} key={module.title} className="block group">
                <Card className="h-full border-border bg-card transition-all hover:bg-accent/50 hover:border-primary/30 shadow-none">
                  <CardContent className="p-4 flex flex-col items-start">
                    <div className="p-2 rounded-md bg-secondary mb-3 text-muted-foreground group-hover:text-primary transition-colors">
                      <module.icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">{module.title}</h3>
                    <p className="text-xs text-muted-foreground leading-snug">{module.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <Separator />

        {/* Analytics Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Live Inventory Metrics</h2>
            <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Updates automatically
            </div>
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 rounded-lg border border-border bg-card space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Warehouse Stock</p>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/30" /> : (
                <p className="text-2xl font-bold tracking-tight text-foreground">{stats.inStock.toLocaleString()}</p>
              )}
            </div>

            <div className="p-4 rounded-lg border border-border bg-card space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Active in Market</p>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/30" /> : (
                <p className="text-2xl font-bold tracking-tight text-foreground">{stats.distributed.toLocaleString()}</p>
              )}
            </div>

            <div className="p-4 rounded-lg border border-border bg-card space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Total Redeemed</p>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/30" /> : (
                <p className="text-2xl font-bold tracking-tight text-foreground">{stats.redeemed.toLocaleString()}</p>
              )}
            </div>

            <div className="p-4 rounded-lg border border-red-200/50 bg-red-50/10 space-y-1">
              <p className="text-xs font-medium text-red-600/70">Cycle Denied</p>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/30" /> : (
                <p className="text-2xl font-bold tracking-tight text-red-600">{stats.expired.toLocaleString()}</p>
              )}
            </div>
          </div>
        </section>

        {/* System Info - Subtler Vercel style footer note */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary/50 border border-border">
          <Info className="h-4 w-4 text-muted-foreground" />
          <p className="text-[11px] text-muted-foreground font-medium">
            <span className="text-foreground font-semibold">Automatic Expiry Control:</span> Vouchers transition to 'Expired' status exactly 90 days post-distribution.
          </p>
        </div>

      </main>
    </div>
  );
}