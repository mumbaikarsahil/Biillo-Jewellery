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
  Undo2 // ✨ NEW ICON FOR RETURNS
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
      accent: "text-blue-600 bg-blue-50 border-blue-200 group-hover:bg-blue-600 group-hover:text-white",
    },
    {
      title: "Ingest Inventory",
      description: "Scan and register printed batches.",
      icon: QrCode,
      href: "/vouchers/batches",
      accent: "text-indigo-600 bg-indigo-50 border-indigo-200 group-hover:bg-indigo-600 group-hover:text-white",
    },
    {
      title: "Partner Directory",
      description: "Manage distributor networks.",
      icon: Store,
      href: "/vouchers/distributors",
      accent: "text-purple-600 bg-purple-50 border-purple-200 group-hover:bg-purple-600 group-hover:text-white",
    },
    {
      title: "Issue & Transfer",
      description: "Allocate stock to partners.",
      icon: Send,
      href: "/vouchers/distribute",
      accent: "text-emerald-600 bg-emerald-50 border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white",
    },
    // ✨ NEW MODULE ADDED HERE
    {
      title: "Returns & Recovery",
      description: "Recall unsold stock to central vault.",
      icon: Undo2,
      href: "/vouchers/return",
      accent: "text-rose-600 bg-rose-50 border-rose-200 group-hover:bg-rose-600 group-hover:text-white",
    },
    {
      title: "Audit Trail",
      description: "Track full voucher lifecycles.",
      icon: Search,
      href: "/vouchers/track",
      accent: "text-slate-700 bg-slate-100 border-slate-200 group-hover:bg-slate-800 group-hover:text-white",
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] font-sans selection:bg-blue-100 pb-24">
      
      {/* --- ENTERPRISE HEADER --- */}
      <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center sticky top-0 z-40 box-border shadow-sm">
        <div className="w-full max-w-7xl mx-auto flex justify-between items-center gap-4">
          
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-slate-900 text-white flex items-center justify-center rounded-lg shadow-sm">
              <TicketPercent className="w-4 h-4" strokeWidth={2.5} />
            </div>
            <h1 className="text-lg font-medium text-slate-900 tracking-tight leading-none">
              Voucher Desk
            </h1>
            <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 border border-emerald-100 ml-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">System Active</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 px-3 text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              onClick={fetchStats}
            >
              <RefreshCw className={`h-4 w-4 sm:mr-2 ${isLoading ? 'animate-spin text-[#0052FF]' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">Sync Data</span>
            </Button>
            <div className="w-px h-5 bg-slate-200" />
            <Link href="/vouchers/track">
              <Button size="sm" className="h-9 text-xs font-bold px-4 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg shadow-sm transition-all">
                <Database className="h-4 w-4 mr-2 text-slate-400" />
                View Database
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* --- ANALYTICS METRICS (RAZORPAY STYLE) --- */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Live Telemetry
            </h2>
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            
            {/* Vault Stock */}
            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow bg-white rounded-2xl overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity group-hover:scale-110 transform duration-500">
                <Package className="w-20 h-20" />
              </div>
              <CardContent className="p-5 relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                    <Database className="w-4 h-4 text-slate-600" />
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Vault Stock</p>
                </div>
                <div className="flex items-baseline gap-2">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-slate-300" /> : (
                    <p className="text-3xl font-bold tracking-tight text-slate-900">{stats.inStock.toLocaleString()}</p>
                  )}
                </div>
                <p className="text-[10px] font-medium text-slate-400 mt-2">Unissued physical/digital stock</p>
              </CardContent>
            </Card>

            {/* Active Distributed */}
            <Card className="border-blue-100 shadow-sm hover:shadow-md transition-shadow bg-blue-50/30 rounded-2xl overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity group-hover:scale-110 transform duration-500">
                <Send className="w-20 h-20 text-blue-600" />
              </div>
              <CardContent className="p-5 relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200">
                    <Send className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">Active In Market</p>
                </div>
                <div className="flex items-baseline gap-2">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-blue-300" /> : (
                    <p className="text-3xl font-bold tracking-tight text-slate-900">{stats.active.toLocaleString()}</p>
                  )}
                </div>
                <p className="text-[10px] font-medium text-blue-500/70 mt-2">Distributed & Registered (Valid)</p>
              </CardContent>
            </Card>

            {/* Redeemed */}
            <Card className="border-emerald-100 shadow-sm hover:shadow-md transition-shadow bg-emerald-50/30 rounded-2xl overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity group-hover:scale-110 transform duration-500">
                <ShieldCheck className="w-20 h-20 text-emerald-600" />
              </div>
              <CardContent className="p-5 relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest">Total Redeemed</p>
                </div>
                <div className="flex items-baseline gap-2">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-emerald-300" /> : (
                    <p className="text-3xl font-bold tracking-tight text-emerald-600">{stats.redeemed.toLocaleString()}</p>
                  )}
                </div>
                <p className="text-[10px] font-medium text-emerald-500/70 mt-2">Successfully claimed at stores</p>
              </CardContent>
            </Card>

            {/* Expired / Denied */}
            <Card className="border-rose-100 shadow-sm hover:shadow-md transition-shadow bg-rose-50/30 rounded-2xl overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity group-hover:scale-110 transform duration-500">
                <AlertCircle className="w-20 h-20 text-rose-600" />
              </div>
              <CardContent className="p-5 relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center border border-rose-200">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  </div>
                  <p className="text-[11px] font-bold text-rose-600 uppercase tracking-widest">Cycle Denied</p>
                </div>
                <div className="flex items-baseline gap-2">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-rose-300" /> : (
                    <p className="text-3xl font-bold tracking-tight text-rose-600">{stats.denied.toLocaleString()}</p>
                  )}
                </div>
                <p className="text-[10px] font-medium text-rose-500/70 mt-2">Expired or manually voided</p>
              </CardContent>
            </Card>

          </div>
        </section>

        {/* --- MODULE GRID (UPDATED GRID COLS TO FIT 6 CARDS) --- */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Database className="w-4 h-4" /> Core Operations
          </h2>
          
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {voucherModules.map((module) => (
              <Link href={module.href} key={module.title} className="block group outline-none h-full">
                <div className="h-full bg-white border border-slate-200 rounded-2xl p-5 transition-all duration-300 hover:border-slate-400 hover:shadow-lg flex flex-col relative group-focus-visible:ring-2 group-focus-visible:ring-[#0052FF] group-focus-visible:ring-offset-2">
                  
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center mb-4 transition-colors duration-300", module.accent)}>
                    <module.icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  
                  <h3 className="text-[14px] font-bold text-slate-900 mb-1.5">{module.title}</h3>
                  <p className="text-[12px] font-medium text-slate-500 leading-relaxed mb-4">{module.description}</p>
                  
                  <div className="mt-auto flex items-center text-[11px] font-bold text-slate-400 group-hover:text-slate-900 transition-colors uppercase tracking-widest pt-2 border-t border-slate-100">
                    Open Module <ArrowRight className="w-3.5 h-3.5 ml-1.5 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* --- SYSTEM INFO BANNER --- */}
        <div className="flex items-start gap-4 p-5 rounded-2xl bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border border-blue-100/50 mt-8 shadow-sm">
          <div className="bg-white p-2 rounded-xl shadow-sm shrink-0 border border-blue-100">
            <Info className="h-5 w-5 text-[#0052FF]" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col pt-0.5">
            <h4 className="text-sm font-bold text-slate-900 tracking-tight mb-1">Smart Expiry Control Protocol</h4>
            <p className="text-[13px] text-slate-600 font-medium leading-relaxed max-w-4xl">
              Vouchers are initially valid for 6 months. Upon customer registration, validity automatically shrinks to exactly 1 month from the registration date to accelerate conversion and footfall.
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}