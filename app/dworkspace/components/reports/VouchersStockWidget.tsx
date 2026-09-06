"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfMonth, startOfDay, endOfDay } from "date-fns";
import { Loader2, ArrowRight, ChevronLeft, ChevronRight, FileSpreadsheet, Ticket } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function VouchersStockWidget({ overrideData }: { overrideData?: any[] } = {}) {
  const { appUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("30d"); 
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  
  const [distributions, setDistributions] = useState<any[]>([]);
  const [vouchersActivity, setVouchersActivity] = useState<any[]>([]);

  // Pagination State
  const [isExpandedView, setIsExpandedView] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    if (overrideData) {
      setDistributions(overrideData);
      setIsLoading(false);
      return;
    }
    if (!appUser?.company_id) return;
    if (timeframe === "custom" && (!customStart || !customEnd)) return;

    const fetchVoucherData = async () => {
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

        // 1. Fetch Distribution Challans Ledger
        const { data: distData, error: distError } = await supabase
          .from("voucher_distributions")
          .select(`
            id, quantity, total_amount, payment_status, delivery_status, created_at,
            voucher_distributors(distributor_name)
          `)
          .eq("company_id", appUser.company_id)
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString())
          .order("created_at", { ascending: false });

        if (distError) throw distError;

        // 2. Fetch Voucher Activity (Status Changes) for KPIs
        const { data: vData, error: vError } = await supabase
          .from("vouchers")
          .select("id, status")
          .gte("updated_at", startDate.toISOString())
          .lte("updated_at", endDate.toISOString());

        if (vError) throw vError;

        setDistributions(distData || []);
        setVouchersActivity(vData || []);
        setPage(1); 
      } catch (err) {
        console.error("Failed to fetch voucher stock data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVoucherData();
  }, [appUser, timeframe, customStart, customEnd]);

  // --- CALCULATIONS & GROUPING ---
  const metrics = useMemo(() => {
    let totalDistributedQty = 0;
    let totalDistributionValue = 0;
    const distributorMap: Record<string, { name: string, qty: number, value: number }> = {};

    // Calculate Distribution Totals & Top Distributors
    distributions.forEach(d => {
      totalDistributedQty += Number(d.quantity) || 0;
      totalDistributionValue += Number(d.total_amount) || 0;
      
      const distName = d.voucher_distributors?.distributor_name || 'Unknown Partner';
      if (!distributorMap[distName]) {
        distributorMap[distName] = { name: distName, qty: 0, value: 0 };
      }
      distributorMap[distName].qty += Number(d.quantity) || 0;
      distributorMap[distName].value += Number(d.total_amount) || 0;
    });

    const topDistributors = Object.values(distributorMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5); // Take top 5

    // Calculate Voucher Status Activity
    let activityCounts = { minted: 0, redeemed: 0, voided: 0 };
    vouchersActivity.forEach(v => {
      if (v.status === 'in_stock') activityCounts.minted += 1;
      if (v.status === 'redeemed') activityCounts.redeemed += 1;
      if (v.status === 'voided') activityCounts.voided += 1;
    });

    return { 
      totalDistributedQty, 
      totalDistributionValue, 
      topDistributors,
      activityCounts,
      count: distributions.length 
    };
  }, [distributions, vouchersActivity]);

  // Pagination Logic
  const totalPages = Math.ceil(distributions.length / pageSize);
  const paginatedDistributions = isExpandedView 
    ? distributions.slice((page - 1) * pageSize, page * pageSize)
    : distributions.slice(0, 5); 

  if (isLoading && distributions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full min-h-[250px] text-zinc-400">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Auditing Voucher Stock...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full space-y-4">
      
      {/* Widget Header & Filters */}
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-indigo-700" />
          <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">Voucher Operations Report</h3>
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
              <th className="border border-zinc-300 p-1.5 text-left font-bold text-zinc-700 uppercase">Operations Metric</th>
              <th className="border border-zinc-300 p-1.5 text-right font-bold text-zinc-700 uppercase">Volume</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-zinc-300 p-1.5 text-zinc-600 font-medium">Vouchers Distributed (Qty)</td>
              <td className="border border-zinc-300 p-1.5 text-right font-mono font-bold text-indigo-700">{metrics.totalDistributedQty.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-1.5 text-zinc-600 font-medium">Distribution Processing Value</td>
              <td className="border border-zinc-300 p-1.5 text-right font-mono font-bold text-emerald-700">₹{metrics.totalDistributionValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-1.5 text-zinc-600 font-medium">Vouchers Redeemed (Activity)</td>
              <td className="border border-zinc-300 p-1.5 text-right font-mono font-bold text-zinc-800">{metrics.activityCounts.redeemed.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-1.5 text-zinc-600 font-medium">Vouchers Voided/Deleted</td>
              <td className="border border-zinc-300 p-1.5 text-right font-mono text-rose-600">{metrics.activityCounts.voided.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        {/* Top Distributors Table */}
        <table className="w-full border-collapse border border-zinc-300 text-[11px]">
          <thead>
            <tr className="bg-zinc-100">
              <th className="border border-zinc-300 p-1.5 text-left font-bold text-zinc-700 uppercase">Top Distributors</th>
              <th className="border border-zinc-300 p-1.5 text-right font-bold text-zinc-700 uppercase">Qty Allocated</th>
            </tr>
          </thead>
          <tbody>
            {metrics.topDistributors.map((dist, idx) => (
              <tr key={idx}>
                <td className="border border-zinc-300 p-1.5 text-zinc-800 font-bold truncate max-w-[150px]">{dist.name}</td>
                <td className="border border-zinc-300 p-1.5 text-right font-mono text-zinc-900">{dist.qty.toLocaleString()}</td>
              </tr>
            ))}
            {metrics.topDistributors.length === 0 && (
              <tr>
                <td colSpan={2} className="border border-zinc-300 p-1.5 text-center text-zinc-400 italic">No allocations found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* EXCEL-STYLE TRANSACTIONS LEDGER */}
      <div className="pt-2 flex-1 flex flex-col min-h-0">
        <div className="flex justify-between items-end mb-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Distribution Challans Ledger</p>
          {!isExpandedView && distributions.length > 5 && (
            <span 
              className="text-[10px] font-bold text-indigo-600 flex items-center cursor-pointer hover:underline"
              onClick={() => setIsExpandedView(true)}
            >
              View All ({distributions.length}) <ArrowRight className="w-3 h-3 ml-1" />
            </span>
          )}
        </div>
        
        <div className="border border-zinc-300 overflow-x-auto flex-1 custom-scrollbar bg-white">
          <table className="w-full border-collapse text-[10px] whitespace-nowrap">
            <thead className="sticky top-0 bg-zinc-100 shadow-[0_1px_0_#d4d4d8]">
              <tr>
                <th className="p-1.5 text-left font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[110px]">Date</th>
                <th className="p-1.5 text-left font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 min-w-[150px]">Distributor Name</th>
                <th className="p-1.5 text-right font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[80px]">Qty Issued</th>
                <th className="p-1.5 text-right font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[100px]">Total Value (₹)</th>
                <th className="p-1.5 text-center font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[100px]">Payment</th>
                <th className="p-1.5 text-center font-bold text-zinc-700 uppercase border-b border-zinc-300 w-[100px]">Delivery</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDistributions.map((d) => (
                <tr key={d.id} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600 font-mono">{format(new Date(d.created_at), 'dd-MM-yy HH:mm')}</td>
                  <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-zinc-800 truncate max-w-[180px]">{d.voucher_distributors?.distributor_name || 'Unknown'}</td>
                  <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono font-bold text-indigo-700">{d.quantity.toLocaleString()}</td>
                  <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-emerald-700">{Number(d.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="p-1.5 border-b border-r border-zinc-300 text-center font-bold uppercase text-zinc-500">{d.payment_status}</td>
                  <td className="p-1.5 border-b border-zinc-300 text-center font-bold uppercase text-zinc-500">{d.delivery_status}</td>
                </tr>
              ))}
              {distributions.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-zinc-400 italic border-b border-zinc-300">No distribution challans recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {isExpandedView && totalPages > 1 && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-200">
            <span className="text-[10px] text-zinc-500 font-medium">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, distributions.length)} of {distributions.length}
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