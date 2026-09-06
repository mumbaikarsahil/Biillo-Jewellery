"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfMonth, startOfDay, endOfDay } from "date-fns";
import { Loader2, ArrowRight, ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CustomOrdersWidget({ overrideData }: { overrideData?: any[] } = {}) {
  const { appUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("30d"); 
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [orders, setOrders] = useState<any[]>([]);

  // Pagination State
  const [isExpandedView, setIsExpandedView] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    if (overrideData) {
      setOrders(overrideData);
      setIsLoading(false);
      return;
    }
    if (!appUser?.company_id) return;
    if (timeframe === "custom" && (!customStart || !customEnd)) return; // Wait for dates

    const fetchOrdersData = async () => {
      setIsLoading(true);
      try {
        const now = new Date();
        let startDate = new Date();
        let endDate = endOfDay(now);

        if (timeframe === "today") {
          startDate = startOfDay(now);
        } else if (timeframe === "yesterday") {
          startDate = startOfDay(subDays(now, 1));
          endDate = endOfDay(subDays(now, 1));
        } else if (timeframe === "7d") {
          startDate = startOfDay(subDays(now, 7));
        } else if (timeframe === "30d") {
          startDate = startOfDay(subDays(now, 30));
        } else if (timeframe === "month") {
          startDate = startOfMonth(now);
        } else if (timeframe === "custom") {
          startDate = startOfDay(new Date(customStart));
          endDate = endOfDay(new Date(customEnd));
        }

        const { data, error } = await supabase
          .from("custom_orders")
          .select(`
            id, order_number, estimated_value, advance_paid, status, created_at,
            customers(full_name)
          `)
          .eq("company_id", appUser.company_id)
          .neq("status", "CANCELLED")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString())
          .order("created_at", { ascending: false });

        if (error) throw error;
        setOrders(data || []);
        setPage(1); // Reset pagination
      } catch (err) {
        console.error("Failed to fetch custom orders:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrdersData();
  }, [appUser, timeframe, customStart, customEnd]);

  // --- CALCULATIONS ---
  const metrics = useMemo(() => {
    let totalValue = 0;
    let advanceCollected = 0;
    let statusCounts: Record<string, number> = {};

    orders.forEach(ord => {
      totalValue += Number(ord.estimated_value) || 0;
      advanceCollected += Number(ord.advance_paid) || 0;
      
      const stat = (ord.status || 'UNKNOWN').replace(/_/g, ' ').toUpperCase();
      statusCounts[stat] = (statusCounts[stat] || 0) + 1;
    });

    return { 
      totalValue, 
      advanceCollected, 
      pendingBalance: Math.max(0, totalValue - advanceCollected),
      count: orders.length, 
      statusCounts 
    };
  }, [orders]);

  // Pagination Logic
  const totalPages = Math.ceil(orders.length / pageSize);
  const paginatedOrders = isExpandedView 
    ? orders.slice((page - 1) * pageSize, page * pageSize)
    : orders.slice(0, 5); // Default collapsed view shows top 5

  if (isLoading && orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full min-h-[250px] text-zinc-400">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Compiling Pipeline...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full space-y-4">
      
      {/* Widget Header & Filters */}
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-purple-700" />
          <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">Custom Orders Pipeline</h3>
        </div>
        
        <div className="flex items-center gap-2">
          {timeframe === 'custom' && (
            <div className="flex items-center gap-1">
              <Input type="date" className="h-7 text-[10px] py-0 px-2 w-[110px] border-zinc-300" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span className="text-zinc-400 text-[10px]">-</span>
              <Input type="date" className="h-7 text-[10px] py-0 px-2 w-[110px] border-zinc-300" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          )}
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="h-7 w-[130px] text-[11px] font-semibold bg-white border-zinc-300 rounded-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* EXCEL-STYLE FINANCIAL SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* KPI Table */}
        <table className="w-full border-collapse border border-zinc-300 text-[11px]">
          <thead>
            <tr className="bg-zinc-100">
              <th className="border border-zinc-300 p-1.5 text-left font-bold text-zinc-700 uppercase">Metric</th>
              <th className="border border-zinc-300 p-1.5 text-right font-bold text-zinc-700 uppercase">Value (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-zinc-300 p-1.5 text-zinc-600 font-medium">Total Active Orders</td>
              <td className="border border-zinc-300 p-1.5 text-right font-mono font-bold text-zinc-900">{metrics.count}</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-1.5 text-zinc-600 font-medium">Est. Pipeline Value</td>
              <td className="border border-zinc-300 p-1.5 text-right font-mono font-bold text-purple-700">{metrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-1.5 text-zinc-600 font-medium">Advances Secured</td>
              <td className="border border-zinc-300 p-1.5 text-right font-mono text-emerald-700">{metrics.advanceCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-1.5 text-zinc-600 font-medium">Pending Balances</td>
              <td className="border border-zinc-300 p-1.5 text-right font-mono text-amber-600">{metrics.pendingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        {/* Status Breakdown Table */}
        <table className="w-full border-collapse border border-zinc-300 text-[11px]">
          <thead>
            <tr className="bg-zinc-100">
              <th className="border border-zinc-300 p-1.5 text-left font-bold text-zinc-700 uppercase">Production Status</th>
              <th className="border border-zinc-300 p-1.5 text-right font-bold text-zinc-700 uppercase">Count</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(metrics.statusCounts).sort((a,b) => b[1] - a[1]).map(([status, count]) => (
              <tr key={status}>
                <td className="border border-zinc-300 p-1.5 text-zinc-600 font-bold uppercase">{status}</td>
                <td className="border border-zinc-300 p-1.5 text-right font-mono text-zinc-900">
                  {count}
                </td>
              </tr>
            ))}
            {Object.keys(metrics.statusCounts).length === 0 && (
              <tr>
                <td colSpan={2} className="border border-zinc-300 p-1.5 text-center text-zinc-400 italic">No statuses found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* EXCEL-STYLE TRANSACTIONS LEDGER */}
      <div className="pt-2 flex-1 flex flex-col min-h-0">
        <div className="flex justify-between items-end mb-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Pipeline Ledger</p>
          {!isExpandedView && orders.length > 5 && (
            <span 
              className="text-[10px] font-bold text-indigo-600 flex items-center cursor-pointer hover:underline"
              onClick={() => setIsExpandedView(true)}
            >
              View All ({orders.length}) <ArrowRight className="w-3 h-3 ml-1" />
            </span>
          )}
        </div>
        
        <div className="border border-zinc-300 overflow-x-auto flex-1 custom-scrollbar bg-white">
          <table className="w-full border-collapse text-[10px] whitespace-nowrap">
            <thead className="sticky top-0 bg-zinc-100 shadow-[0_1px_0_#d4d4d8]">
              <tr>
                <th className="p-1.5 text-left font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[110px]">Date</th>
                <th className="p-1.5 text-left font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[110px]">Order No</th>
                <th className="p-1.5 text-left font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 min-w-[130px]">Customer</th>
                <th className="p-1.5 text-left font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[130px]">Status</th>
                <th className="p-1.5 text-right font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[90px]">Est. Total (₹)</th>
                <th className="p-1.5 text-right font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[90px]">Advance (₹)</th>
                <th className="p-1.5 text-right font-bold text-zinc-700 uppercase border-b border-zinc-300 w-[90px]">Balance (₹)</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((ord) => {
                const finalTotal = Number(ord.estimated_value) || 0;
                const advancePaid = Number(ord.advance_paid) || 0;
                const balanceDue = Math.max(0, finalTotal - advancePaid);
                
                return (
                  <tr key={ord.id} className="hover:bg-purple-50/30 transition-colors">
                    <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(ord.created_at), 'dd-MM-yy HH:mm')}</td>
                    <td className="p-1.5 border-b border-r border-zinc-300 font-mono font-semibold text-purple-700">{ord.order_number}</td>
                    <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800 truncate max-w-[130px]">{ord.customers?.full_name || 'Walk-in'}</td>
                    <td className="p-1.5 border-b border-r border-zinc-300 text-left font-bold text-zinc-500 uppercase">{(ord.status || 'UNKNOWN').replace(/_/g, ' ')}</td>
                    <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-zinc-900">{finalTotal.toLocaleString()}</td>
                    <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-emerald-600">{advancePaid.toLocaleString()}</td>
                    <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-bold text-amber-700">{balanceDue.toLocaleString()}</td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-zinc-400 italic border-b border-zinc-300">No records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls (Only visible when Expanded) */}
        {isExpandedView && totalPages > 1 && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-200">
            <span className="text-[10px] text-zinc-500 font-medium">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, orders.length)} of {orders.length}
            </span>
            <div className="flex items-center gap-1">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-6 w-6 rounded-sm border-zinc-300"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <span className="text-[10px] font-mono px-2">Page {page} of {totalPages}</span>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-6 w-6 rounded-sm border-zinc-300"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
            <span 
              className="text-[10px] font-bold text-zinc-500 cursor-pointer hover:underline"
              onClick={() => { setIsExpandedView(false); setPage(1); }}
            >
              Collapse
            </span>
          </div>
        )}
      </div>

    </div>
  );
}