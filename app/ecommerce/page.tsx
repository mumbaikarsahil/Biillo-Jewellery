"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { 
  ShoppingCart, PackageSearch, MapPin, ArrowRight, 
  Zap, Globe, Package, Loader2, AlertCircle, TrendingUp,
  Clock, Hammer,
  CheckCircle2
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function EcommerceDashboard() {
  const { appUser } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [stats, setStats] = useState({
    pendingOrders: 0,
    inFabrication: 0,
    liveProducts: 0,
    todayRevenue: 0
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!appUser?.company_id) return;
      setIsLoading(true);
      try {
        // 1. Get stats for Pending & Manufacturing Orders
        const { data: orderStats, error: orderErr } = await supabase
          .from("ecommerce_orders")
          .select("status, final_total, created_at")
          .eq("company_id", appUser.company_id);

        if (orderErr) throw orderErr;

        // 2. Get Live Products Count
        const { count: liveCount, error: prodErr } = await supabase
          .from("ecommerce_products")
          .select("*", { count: 'exact', head: true })
          .eq("company_id", appUser.company_id)
          .eq("is_live", true);

        if (prodErr) throw prodErr;

        // Calculate KPIs
        let pending = 0;
        let fabricating = 0;
        let revenueToday = 0;
        const todayStr = new Date().toISOString().split('T')[0];

        const recentPending: any[] = [];

        (orderStats || []).forEach(o => {
          if (o.status === "pending_approval") {
            pending++;
            recentPending.push(o);
          }
          if (o.status === "sent_to_manufacturing") fabricating++;
          if (o.created_at.startsWith(todayStr)) revenueToday += Number(o.final_total);
        });

        // Sort recent pending orders by newest first and take top 5
        recentPending.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Fetch detailed info for the recent pending orders notifier
        if (recentPending.length > 0) {
          const top5Ids = recentPending.slice(0, 5).map(o => o.id);
          const { data: detailedRecent } = await supabase
            .from("ecommerce_orders")
            .select("id, order_number, final_total, created_at, customers(full_name)")
            .in("id", top5Ids)
            .order("created_at", { ascending: false });
            
          if (detailedRecent) setRecentOrders(detailedRecent);
        }

        setStats({
          pendingOrders: pending,
          inFabrication: fabricating,
          liveProducts: liveCount || 0,
          todayRevenue: revenueToday
        });

      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [appUser]);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-zinc-900">E-Commerce Command Center</h1>
        <p className="text-sm font-medium text-zinc-500 mt-1">Manage your digital storefront, route live orders, and track fulfillment.</p>
      </div>

      {/* KPI STATS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
        <Card className="shadow-sm border-amber-200/60 bg-amber-50/30 rounded-2xl">
          <CardContent className="p-5">
            <p className="text-[11px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5" /> Awaiting Route
            </p>
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-amber-300" /> : (
              <p className="text-3xl font-black text-amber-700">{stats.pendingOrders}</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-indigo-200/60 bg-indigo-50/30 rounded-2xl">
          <CardContent className="p-5">
            <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <Hammer className="w-3.5 h-3.5" /> In Fabrication
            </p>
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-indigo-300" /> : (
              <p className="text-3xl font-black text-indigo-700">{stats.inFabrication}</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-emerald-200/60 bg-emerald-50/30 rounded-2xl">
          <CardContent className="p-5">
            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <Globe className="w-3.5 h-3.5" /> Live Catalog
            </p>
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-emerald-300" /> : (
              <p className="text-3xl font-black text-emerald-700">{stats.liveProducts}</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-zinc-200/60 bg-white rounded-2xl">
          <CardContent className="p-5">
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-zinc-400" /> Today's Sales
            </p>
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-zinc-300" /> : (
              <p className="text-3xl font-black text-zinc-900">₹{stats.todayRevenue.toLocaleString()}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: ACTION REQUIRED NOTIFIER */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" /> Action Required
            </h2>
          </div>

          <Card className="shadow-sm border-zinc-200/80 bg-white rounded-2xl overflow-hidden flex flex-col h-[350px]">
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-300" />
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-sm font-bold text-zinc-700">Inbox Zero!</p>
                <p className="text-xs font-medium text-zinc-500 mt-1">All online orders have been routed.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar p-0 divide-y divide-zinc-100">
                {recentOrders.map(order => (
                  <div key={order.id} className="p-4 hover:bg-zinc-50 transition-colors flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-black text-zinc-900">{order.order_number}</span>
                        <Badge className="bg-amber-100 text-amber-700 border-none uppercase tracking-widest text-[9px] font-bold shadow-none">Pending</Badge>
                      </div>
                      <p className="text-xs font-bold text-zinc-700">{order.customers?.full_name || 'Online Guest'}</p>
                      <p className="text-[10px] font-medium text-zinc-500 mt-0.5">{format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a')}</p>
                    </div>
                    <Link href="/ecommerce/orders">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
            {stats.pendingOrders > 5 && (
              <div className="bg-zinc-50 p-3 border-t border-zinc-100 text-center">
                <Link href="/ecommerce/orders" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                  + {stats.pendingOrders - 5} More Pending Orders
                </Link>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN: MODULE NAVIGATION */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-900">System Modules</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Orders Module */}
            <Link href="/ecommerce/orders" className="block outline-none">
              <Card className="shadow-sm border-zinc-200/80 bg-white rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group h-full">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-zinc-900 tracking-tight">Orders & Approval Queue</h3>
                  <p className="text-xs font-medium text-zinc-500 mt-2 leading-relaxed">
                    Review incoming website orders, check live physical stock availability, and route fulfillment directly to branches or manufacturing.
                  </p>
                </CardContent>
              </Card>
            </Link>

            {/* Catalog Module */}
            <Link href="/ecommerce/catalog" className="block outline-none">
              <Card className="shadow-sm border-zinc-200/80 bg-white rounded-2xl hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group h-full">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <PackageSearch className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-zinc-900 tracking-tight">Master Catalog</h3>
                  <p className="text-xs font-medium text-zinc-500 mt-2 leading-relaxed">
                    Control your public storefront display. Add new product lines, manage images, and link website listings to internal ERP design SKUs.
                  </p>
                </CardContent>
              </Card>
            </Link>

            {/* Pincode Routing Module */}
            <Link href="/ecommerce/routing" className="block outline-none sm:col-span-2">
              <Card className="shadow-sm border-zinc-200/80 bg-white rounded-2xl hover:border-rose-300 hover:shadow-md transition-all cursor-pointer group h-full">
                <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-black text-zinc-900 tracking-tight">Pincode Routing Engine</h3>
                    <p className="text-xs font-medium text-zinc-500 mt-2 leading-relaxed max-w-[400px]">
                      Map geographical delivery zones to your physical store locations. Controls the logistics engine used to calculate dynamic delivery ETAs.
                    </p>
                  </div>
                  <Button variant="ghost" className="hidden sm:flex text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold text-xs uppercase tracking-widest">
                    Configure Map <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </CardContent>
              </Card>
            </Link>

          </div>
        </div>
      </div>
    </div>
  );
}