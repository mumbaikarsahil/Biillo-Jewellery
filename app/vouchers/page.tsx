"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Printer, 
  Store, 
  Send, 
  Search, 
  PlusCircle,
  Loader2,
  RefreshCw,
  Database,
  Info,
  TicketPercent,
  CheckCircle2,
  AlertCircle,
  Package,
  QrCode,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  Undo2,
  CalendarClock
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function VouchersDashboard() {
  const { appUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    inStock: 0,
    active: 0,
    redeemed: 0,
    denied: 0,
  });

  const fetchStats = async () => {
    if (!appUser?.company_id) return;
    setIsLoading(true);
    
    try {
      let allVouchers: any[] = [];
      let more = true;
      let page = 0;
      const pageSize = 1000;

      while (more) {
        const { data, error } = await supabase
          .from('vouchers')
          .select('status, expiry_date, voucher_batches!inner(company_id)')
          .eq('voucher_batches.company_id', appUser.company_id)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        
        allVouchers.push(...(data || []));
        if (data.length < pageSize) more = false;
        page++;
      }

      const now = new Date();
      let inStock = 0;
      let active = 0;
      let redeemed = 0;
      let denied = 0;

      allVouchers.forEach(v => {
        const isExpired = v.expiry_date && new Date(v.expiry_date) < now;

        if (v.status === 'redeemed') {
          redeemed++;
        } else if (v.status === 'voided' || v.status === 'expired' || isExpired) {
          denied++;
        } else if (v.status === 'distributed' || v.status === 'registered' || v.status === 'unclaimed') {
          active++;
        } else if (v.status === 'in_stock' || v.status === 'pending_print') {
          inStock++;
        }
      });

      setStats({
        inStock,
        active,
        redeemed,
        denied,
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
      title: "Generate Batches",
      description: "Create and export new voucher series.",
      icon: PlusCircle,
      href: "/vouchers/generate",
    },
    {
      title: "Pre-Orders (Bookings)",
      description: "Manage partner demands and requests.",
      icon: CalendarClock,
      href: "/vouchers/bookings",
    },
    {
      title: "Ingest Inventory",
      description: "Scan and register printed batches.",
      icon: QrCode,
      href: "/vouchers/batches",
    },
    {
      title: "Issue & Transfer",
      description: "Allocate stock to fulfill bookings.",
      icon: Send,
      href: "/vouchers/distribute",
    },
    {
      title: "Partner Directory",
      description: "Manage distributor networks.",
      icon: Store,
      href: "/vouchers/distributors",
    },
    {
      title: "Returns & Recovery",
      description: "Recall unsold stock to central vault.",
      icon: Undo2,
      href: "/vouchers/return",
    },
    {
      title: "Audit Trail",
      description: "Track full voucher lifecycles.",
      icon: Search,
      href: "/vouchers/track",
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 font-sans selection:bg-zinc-200 pb-24">
      
      {/* --- MINIMALIST HEADER --- */}
      <header className="h-14 bg-white border-b border-zinc-200 px-4 sm:px-6 flex items-center sticky top-0 z-40 box-border">
        <div className="w-full max-w-6xl mx-auto flex justify-between items-center gap-4">
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <TicketPercent className="w-5 h-5 text-zinc-900" strokeWidth={2} />
              <h1 className="text-sm font-semibold text-zinc-900 tracking-tight hidden sm:block">
                Voucher Desk
              </h1>
            </div>
            <div className="h-4 w-px bg-zinc-200 mx-1 hidden sm:block" />
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-medium text-zinc-600">Production</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-3 text-xs font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
              onClick={fetchStats}
            >
              <RefreshCw className={`h-3.5 w-3.5 sm:mr-2 ${isLoading ? 'animate-spin text-zinc-900' : 'text-zinc-400'}`} />
              <span className="hidden sm:inline">Sync</span>
            </Button>
            <Link href="/vouchers/track">
              <Button size="sm" className="h-8 text-xs font-medium px-3 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700 shadow-sm transition-all">
                <Database className="h-3.5 w-3.5 sm:mr-2 text-zinc-400 shrink-0" />
                <span className="hidden sm:inline">Database</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6 lg:p-8 max-w-6xl w-full mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* --- ANALYTICS METRICS (VERCEL STYLE) --- */}
        <section className="space-y-4">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            
            {/* Vault Stock */}
            <Card className="border border-zinc-200 shadow-sm bg-white rounded-xl overflow-hidden hover:border-zinc-300 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2 text-zinc-500">
                  <Package className="w-4 h-4" />
                  <p className="text-xs font-medium">Vault Stock</p>
                </div>
                <div className="flex items-baseline gap-2">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-zinc-300" /> : (
                    <p className="text-3xl font-semibold tracking-tight text-zinc-900">{stats.inStock.toLocaleString()}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Active Distributed */}
            <Card className="border border-zinc-200 shadow-sm bg-white rounded-xl overflow-hidden hover:border-zinc-300 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2 text-zinc-500">
                  <Send className="w-4 h-4" />
                  <p className="text-xs font-medium">Active In Market</p>
                </div>
                <div className="flex items-baseline gap-2">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-zinc-300" /> : (
                    <p className="text-3xl font-semibold tracking-tight text-zinc-900">{stats.active.toLocaleString()}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Redeemed */}
            <Card className="border border-zinc-200 shadow-sm bg-white rounded-xl overflow-hidden hover:border-zinc-300 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2 text-zinc-500">
                  <ShieldCheck className="w-4 h-4" />
                  <p className="text-xs font-medium">Redeemed</p>
                </div>
                <div className="flex items-baseline gap-2">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-zinc-300" /> : (
                    <p className="text-3xl font-semibold tracking-tight text-zinc-900">{stats.redeemed.toLocaleString()}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Expired / Denied */}
            <Card className="border border-zinc-200 shadow-sm bg-white rounded-xl overflow-hidden hover:border-zinc-300 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2 text-zinc-500">
                  <AlertCircle className="w-4 h-4" />
                  <p className="text-xs font-medium">Cycle Denied</p>
                </div>
                <div className="flex items-baseline gap-2">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-zinc-300" /> : (
                    <p className="text-3xl font-semibold tracking-tight text-zinc-900">{stats.denied.toLocaleString()}</p>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>
        </section>

        {/* --- MODULE GRID --- */}
        <section className="space-y-4 pt-2">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {voucherModules.map((module) => (
              <Link href={module.href} key={module.title} className="block group outline-none h-full">
                <div className="h-full bg-white border border-zinc-200 rounded-xl p-5 transition-all duration-200 hover:border-zinc-300 hover:shadow-sm flex flex-col focus-visible:ring-2 focus-visible:ring-zinc-800 focus-visible:ring-offset-2">
                  
                  <div className="h-8 w-8 rounded-lg border border-zinc-200 bg-zinc-50 flex items-center justify-center mb-4 text-zinc-600 group-hover:text-zinc-900 transition-colors">
                    <module.icon className="h-4 w-4" strokeWidth={2} />
                  </div>
                  
                  <h3 className="text-sm font-semibold text-zinc-900 mb-1 flex items-center justify-between">
                    {module.title}
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-300 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </h3>
                  <p className="text-xs font-medium text-zinc-500 leading-relaxed">{module.description}</p>
                  
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* --- SYSTEM INFO BANNER --- */}
        <div className="flex items-start gap-4 p-4 rounded-xl bg-white border border-zinc-200 mt-8 shadow-sm">
          <div className="shrink-0 pt-0.5">
            <Info className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="flex flex-col">
            <h4 className="text-sm font-semibold text-zinc-900 mb-1">Expiry Protocol</h4>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed max-w-4xl">
              Vouchers are initially valid for 6 months. Upon customer registration, validity automatically shrinks to exactly 1 month from the registration date to accelerate conversion and footfall.
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}