"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { 
  ShoppingCart, PackageSearch, MapPin, ArrowRight, 
  Globe, Loader2, AlertCircle, TrendingUp,
  Clock, Hammer, CheckCircle2
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
        const { data: orderStats, error: orderErr } = await supabase
          .from("ecommerce_orders")
          .select("id,status, final_total, created_at")
          .eq("company_id", appUser.company_id);

        if (orderErr) throw orderErr;

        const { count: liveCount, error: prodErr } = await supabase
          .from("ecommerce_products")
          .select("*", { count: 'exact', head: true })
          .eq("company_id", appUser.company_id)
          .eq("is_live", true);

        if (prodErr) throw prodErr;

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

        recentPending.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
    <div className="flex flex-col min-h-screen bg-[#fafafa] font-sans pb-20 w-full">
      
      {/* VERCEL-STYLE HEADER */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-zinc-200 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-md bg-zinc-900 flex items-center justify-center shadow-sm border border-zinc-800">
            <Globe className="h-4 w-4 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-zinc-900 tracking-tight text-sm">E-Commerce OS</h1>
            <span className="text-zinc-300">/</span>
            <p className="text-sm font-medium text-zinc-500">Digital Storefront & Routing</p>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto w-full flex-1 flex flex-col gap-6 animate-in fade-in duration-500">
        
        {/* VERCEL-STYLE KPI STATS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          
          <Card className="shadow-sm border-zinc-200 bg-white rounded-xl">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex justify-between items-center pb-2">
                <p className="text-sm font-medium text-zinc-500 tracking-tight">Awaiting Route</p>
                <Clock className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="flex items-baseline gap-2">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-zinc-300" /> : (
                  <p className="text-3xl font-semibold text-zinc-900 tracking-tight leading-none">{stats.pendingOrders}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-zinc-200 bg-white rounded-xl">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex justify-between items-center pb-2">
                <p className="text-sm font-medium text-zinc-500 tracking-tight">In Fabrication</p>
                <Hammer className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="flex items-baseline gap-2">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-zinc-300" /> : (
                  <p className="text-3xl font-semibold text-zinc-900 tracking-tight leading-none">{stats.inFabrication}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-zinc-200 bg-white rounded-xl">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex justify-between items-center pb-2">
                <p className="text-sm font-medium text-zinc-500 tracking-tight">Live Catalog</p>
                <Globe className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="flex items-baseline gap-2">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-zinc-300" /> : (
                  <p className="text-3xl font-semibold text-zinc-900 tracking-tight leading-none">{stats.liveProducts}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-zinc-200 bg-white rounded-xl">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex justify-between items-center pb-2">
                <p className="text-sm font-medium text-zinc-500 tracking-tight">Today's Sales</p>
                <TrendingUp className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="flex items-baseline gap-2">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-zinc-300" /> : (
                  <p className="text-3xl font-semibold text-zinc-900 tracking-tight leading-none">₹{stats.todayRevenue.toLocaleString()}</p>
                )}
              </div>
            </CardContent>
          </Card>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN: ACTION REQUIRED NOTIFIER */}
          <div className="lg:col-span-1 h-full flex flex-col">
            <Card className="shadow-sm border-zinc-200 bg-white rounded-xl overflow-hidden flex flex-col h-[400px]">
              <div className="px-5 py-4 border-b border-zinc-200 bg-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Action Required</h2>
                  {stats.pendingOrders > 0 && (
                    <span className="flex h-2 w-2 rounded-full bg-rose-500"></span>
                  )}
                </div>
              </div>
              
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-300" />
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-10 h-10 border border-zinc-200 rounded-full flex items-center justify-center mb-3 bg-zinc-50">
                    <CheckCircle2 className="w-5 h-5 text-zinc-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-900">Inbox Zero</p>
                  <p className="text-sm text-zinc-500 mt-1">All orders have been routed.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-0 divide-y divide-zinc-100">
                  {recentOrders.map(order => (
                    <Link href="/ecommerce/orders" key={order.id} className="p-4 hover:bg-zinc-50 transition-colors flex items-center justify-between group block outline-none">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-medium text-zinc-900">{order.order_number}</span>
                          <span className="px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 text-[10px] font-medium tracking-tight">Pending</span>
                        </div>
                        <p className="text-sm font-medium text-zinc-700">{order.customers?.full_name || 'Online Guest'}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{format(new Date(order.created_at), 'MMM dd, HH:mm')}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-600 transition-colors" />
                    </Link>
                  ))}
                </div>
              )}
              {stats.pendingOrders > 5 && (
                <div className="bg-zinc-50/50 p-3 border-t border-zinc-200 text-center">
                  <Link href="/ecommerce/orders" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">
                    View all {stats.pendingOrders} pending orders
                  </Link>
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT COLUMN: MODULE NAVIGATION */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 px-1">System Modules</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Orders Module */}
              <Link href="/ecommerce/orders" className="block outline-none">
                <Card className="shadow-sm border-zinc-200 bg-white rounded-xl hover:border-zinc-300 hover:shadow-md transition-all cursor-pointer group h-full">
                  <CardContent className="p-6">
                    <div className="w-10 h-10 border border-zinc-200 bg-white text-zinc-600 shadow-sm rounded-lg flex items-center justify-center mb-5 transition-colors group-hover:border-zinc-300">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-semibold text-zinc-900 tracking-tight">Orders Queue</h3>
                    <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
                      Review incoming website orders, check live physical stock availability, and route fulfillment to branches or manufacturing.
                    </p>
                  </CardContent>
                </Card>
              </Link>

              {/* Catalog Module */}
              <Link href="/ecommerce/catalog" className="block outline-none">
                <Card className="shadow-sm border-zinc-200 bg-white rounded-xl hover:border-zinc-300 hover:shadow-md transition-all cursor-pointer group h-full">
                  <CardContent className="p-6">
                    <div className="w-10 h-10 border border-zinc-200 bg-white text-zinc-600 shadow-sm rounded-lg flex items-center justify-center mb-5 transition-colors group-hover:border-zinc-300">
                      <PackageSearch className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-semibold text-zinc-900 tracking-tight">Master Catalog</h3>
                    <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
                      Control storefront display. Add new product lines, manage images, and link website listings to internal design SKUs.
                    </p>
                  </CardContent>
                </Card>
              </Link>

              {/* Pincode Routing Module */}
              <Link href="/ecommerce/routing" className="block outline-none sm:col-span-2">
                <Card className="shadow-sm border-zinc-200 bg-white rounded-xl hover:border-zinc-300 hover:shadow-md transition-all cursor-pointer group h-full">
                  <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="w-10 h-10 border border-zinc-200 bg-white text-zinc-600 shadow-sm rounded-lg flex items-center justify-center mb-5 transition-colors group-hover:border-zinc-300">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <h3 className="text-base font-semibold text-zinc-900 tracking-tight">Pincode Routing Engine</h3>
                      <p className="text-sm text-zinc-500 mt-2 leading-relaxed max-w-md">
                        Map geographical delivery zones to physical store locations. Controls logistics engine for dynamic ETAs.
                      </p>
                    </div>
                    <Button variant="outline" className="hidden sm:flex bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50 font-medium text-sm h-9 rounded-lg shadow-sm">
                      Configure Map <ArrowRight className="w-4 h-4 ml-1.5 text-zinc-500" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}