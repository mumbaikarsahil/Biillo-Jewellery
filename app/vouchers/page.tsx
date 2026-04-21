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
  AlertCircle
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

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
      title: "Generate Batches",
      description: "Create and export new voucher series.",
      icon: PlusCircle,
      href: "/vouchers/generate",
      accent: "text-[#0052FF] bg-[#0052FF]/10 border-[#0052FF]/20",
    },
    {
      title: "Ingest Inventory",
      description: "Scan and register printed batches.",
      icon: Printer,
      href: "/vouchers/batches",
      accent: "text-slate-700 bg-slate-100 border-slate-200",
    },
    {
      title: "Partner Directory",
      description: "Manage distributor networks.",
      icon: Store,
      href: "/vouchers/distributors",
      accent: "text-slate-700 bg-slate-100 border-slate-200",
    },
    {
      title: "Issue & Transfer",
      description: "Allocate stock to partners.",
      icon: Send,
      href: "/vouchers/distribute",
      accent: "text-slate-700 bg-slate-100 border-slate-200",
    },
    {
      title: "Audit Trail",
      description: "Track full voucher lifecycles.",
      icon: Search,
      href: "/vouchers/track",
      accent: "text-slate-700 bg-slate-100 border-slate-200",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-transparent font-sans selection:bg-blue-100">
      
      {/* --- ENTERPRISE SECONDARY HEADER --- */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center sticky top-0 z-40 box-border">
        <div className="w-full max-w-7xl mx-auto flex justify-between items-center gap-4">
          
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 bg-slate-900 text-white flex items-center justify-center rounded shadow-sm">
              <TicketPercent className="w-3.5 h-3.5" strokeWidth={2.5} />
            </div>
            <h1 className="text-[15px] font-bold text-slate-900 tracking-tight leading-none">
              Voucher Desk
            </h1>
            <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-emerald-50 border border-emerald-200 ml-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">System Active</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
              onClick={fetchStats}
            >
              <RefreshCw className={`h-3.5 w-3.5 sm:mr-2 ${isLoading ? 'animate-spin text-[#0052FF]' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">Sync Data</span>
            </Button>
            <div className="w-px h-4 bg-slate-200" />
            <Button size="sm" className="h-8 text-xs font-bold px-4 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md shadow-sm transition-all">
              <Database className="h-3.5 w-3.5 mr-2 text-slate-400" />
              View Database
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-7xl w-full mx-auto space-y-8">
        
        {/* --- MODULE GRID (RAZORPAY STYLE) --- */}
        <section className="space-y-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Core Operations</h2>
          
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {voucherModules.map((module) => (
              <Link href={module.href} key={module.title} className="block group outline-none">
                <div className="h-full bg-white border border-slate-200 rounded-lg p-4 transition-all duration-200 hover:border-[#0052FF] hover:shadow-[0_2px_12px_rgba(0,82,255,0.08)] flex flex-col relative group-focus-visible:ring-2 group-focus-visible:ring-[#0052FF] group-focus-visible:ring-offset-2">
                  
                  <div className={cn("h-8 w-8 rounded-md flex items-center justify-center mb-3 border", module.accent)}>
                    <module.icon className="h-4 w-4" strokeWidth={2} />
                  </div>
                  
                  <h3 className="text-[13px] font-bold text-slate-900 mb-1">{module.title}</h3>
                  <p className="text-[12px] font-medium text-slate-500 leading-snug">{module.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* --- ANALYTICS METRICS (RAZORPAY STYLE) --- */}
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Live Telemetry</h2>
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            
            {/* Vault Stock */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Vault Stock</p>
                <Database className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-baseline gap-2">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-slate-300" /> : (
                  <p className="text-2xl font-bold tracking-tight text-slate-900">{stats.inStock.toLocaleString()}</p>
                )}
              </div>
            </div>

            {/* Active Distributed */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Active In Market</p>
                <Send className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-baseline gap-2">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-slate-300" /> : (
                  <p className="text-2xl font-bold tracking-tight text-slate-900">{stats.distributed.toLocaleString()}</p>
                )}
              </div>
            </div>

            {/* Redeemed */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Total Redeemed</p>
                <CheckCircle2 className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-baseline gap-2">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-slate-300" /> : (
                  <p className="text-2xl font-bold tracking-tight text-slate-900">{stats.redeemed.toLocaleString()}</p>
                )}
              </div>
            </div>

            {/* Expired / Denied */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold text-rose-500 uppercase tracking-widest">Cycle Denied</p>
                <AlertCircle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="flex items-baseline gap-2">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-rose-300" /> : (
                  <p className="text-2xl font-bold tracking-tight text-rose-600">{stats.expired.toLocaleString()}</p>
                )}
              </div>
            </div>

          </div>
        </section>

        {/* --- SYSTEM INFO BANNER (RAZORPAY STYLE) --- */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 border-l-4 border-l-[#0052FF] border-y border-r border-slate-200">
          <Info className="h-4 w-4 text-[#0052FF] shrink-0 mt-0.5" strokeWidth={2.5} />
          <div className="flex flex-col">
            <h4 className="text-[12px] font-bold text-slate-900 uppercase tracking-wider mb-0.5">Smart Expiry Control</h4>
            <p className="text-[13px] text-slate-600 font-medium leading-relaxed">
              Vouchers are initially valid for 6 months. Upon customer registration, validity automatically shrinks to exactly 2 months to accelerate conversion.
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}