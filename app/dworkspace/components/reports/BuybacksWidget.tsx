"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfMonth, startOfDay, endOfDay } from "date-fns";
import { Loader2, ArrowRight, ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BuybacksWidget() {
  const { appUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("30d"); 
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [buybacks, setBuybacks] = useState<any[]>([]);

  // Pagination State
  const [isExpandedView, setIsExpandedView] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    if (!appUser?.company_id) return;
    if (timeframe === "custom" && (!customStart || !customEnd)) return; // Wait for dates

    const fetchBuybacksData = async () => {
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
          .from("buybacks")
          .select(`
            id, status, is_external_item, item_category, purity_karat, 
            gross_weight_g, gross_value, deduction_amount, net_refund, created_at,
            customers(full_name)
          `)
          .eq("company_id", appUser.company_id)
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString())
          .order("created_at", { ascending: false });

        if (error) throw error;
        setBuybacks(data || []);
        setPage(1); // Reset pagination
      } catch (err) {
        console.error("Failed to fetch buybacks:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBuybacksData();
  }, [appUser, timeframe, customStart, customEnd]);

  // --- CALCULATIONS ---
  const metrics = useMemo(() => {
    let grossValue = 0;
    let totalDeductions = 0;
    let netRefund = 0;
    
    let externalRefunds = 0;
    let systemRefunds = 0;

    buybacks.forEach(bb => {
      grossValue += Number(bb.gross_value) || 0;
      totalDeductions += Number(bb.deduction_amount) || 0;
      netRefund += Number(bb.net_refund) || 0;
      
      if (bb.is_external_item) {
        externalRefunds += Number(bb.net_refund) || 0;
      } else {
        systemRefunds += Number(bb.net_refund) || 0;
      }
    });

    return { 
      grossValue, 
      totalDeductions, 
      netRefund, 
      count: buybacks.length, 
      externalRefunds,
      systemRefunds
    };
  }, [buybacks]);

  // Pagination Logic
  const totalPages = Math.ceil(buybacks.length / pageSize);
  const paginatedBuybacks = isExpandedView 
    ? buybacks.slice((page - 1) * pageSize, page * pageSize)
    : buybacks.slice(0, 5); // Default collapsed view shows top 5

  if (isLoading && buybacks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full min-h-[250px] text-zinc-400">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Compiling Intake Ledger...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full space-y-4">
      
      {/* Widget Header & Filters */}
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-rose-700" />
          <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">Returns & Intake Ledger</h3>
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
              <td className="border border-zinc-300 p-1.5 text-zinc-600 font-medium">Total Returns Logged</td>
              <td className="border border-zinc-300 p-1.5 text-right font-mono font-bold text-zinc-900">{metrics.count}</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-1.5 text-zinc-600 font-medium">Gross Article Value</td>
              <td className="border border-zinc-300 p-1.5 text-right font-mono text-zinc-800">{metrics.grossValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-1.5 text-zinc-600 font-medium">Policy Deductions</td>
              <td className="border border-zinc-300 p-1.5 text-right font-mono font-bold text-rose-600">-{metrics.totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-1.5 text-zinc-600 font-bold bg-slate-50">Net Outflow / Refund</td>
              <td className="border border-zinc-300 p-1.5 text-right font-mono font-black text-rose-700 bg-slate-50">{metrics.netRefund.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        {/* Source Breakdown Table */}
        <table className="w-full border-collapse border border-zinc-300 text-[11px]">
          <thead>
            <tr className="bg-zinc-100">
              <th className="border border-zinc-300 p-1.5 text-left font-bold text-zinc-700 uppercase">Intake Source</th>
              <th className="border border-zinc-300 p-1.5 text-right font-bold text-zinc-700 uppercase">Net Liability (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-zinc-300 p-1.5 text-zinc-600 font-bold uppercase text-indigo-700">System Returns (In-House)</td>
              <td className="border border-zinc-300 p-1.5 text-right font-mono text-zinc-900">
                {metrics.systemRefunds > 0 ? metrics.systemRefunds.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
              </td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-1.5 text-zinc-600 font-bold uppercase text-amber-700">External Old Gold</td>
              <td className="border border-zinc-300 p-1.5 text-right font-mono text-zinc-900">
                {metrics.externalRefunds > 0 ? metrics.externalRefunds.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* EXCEL-STYLE TRANSACTIONS LEDGER */}
      <div className="pt-2 flex-1 flex flex-col min-h-0">
        <div className="flex justify-between items-end mb-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Return Ledger</p>
          {!isExpandedView && buybacks.length > 5 && (
            <span 
              className="text-[10px] font-bold text-indigo-600 flex items-center cursor-pointer hover:underline"
              onClick={() => setIsExpandedView(true)}
            >
              View All ({buybacks.length}) <ArrowRight className="w-3 h-3 ml-1" />
            </span>
          )}
        </div>
        
        <div className="border border-zinc-300 overflow-x-auto flex-1 custom-scrollbar bg-white">
          <table className="w-full border-collapse text-[10px] whitespace-nowrap">
            <thead className="sticky top-0 bg-zinc-100 shadow-[0_1px_0_#d4d4d8]">
              <tr>
                <th className="p-1.5 text-left font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[110px]">Date</th>
                <th className="p-1.5 text-left font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[110px]">Return ID</th>
                <th className="p-1.5 text-left font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 min-w-[130px]">Customer</th>
                <th className="p-1.5 text-left font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 min-w-[140px]">Physical Details</th>
                <th className="p-1.5 text-right font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[90px]">Gross Val (₹)</th>
                <th className="p-1.5 text-right font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[90px]">Deducts (₹)</th>
                <th className="p-1.5 text-right font-bold text-zinc-700 uppercase border-b border-zinc-300 w-[90px]">Net Refund (₹)</th>
              </tr>
            </thead>
            <tbody>
              {paginatedBuybacks.map((bb) => {
                const isCancelled = bb.status === 'CANCELLED';
                const grossVal = Number(bb.gross_value) || 0;
                const deductVal = Number(bb.deduction_amount) || 0;
                const netRef = Number(bb.net_refund) || 0;
                
                return (
                  <tr key={bb.id} className={`hover:bg-rose-50/30 transition-colors ${isCancelled ? 'opacity-50' : ''}`}>
                    <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(bb.created_at), 'dd-MM-yy HH:mm')}</td>
                    <td className="p-1.5 border-b border-r border-zinc-300 font-mono font-semibold text-rose-700">RTN-{bb.id.substring(0,6).toUpperCase()}</td>
                    <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800 truncate max-w-[130px]">{bb.customers?.full_name || 'Walk-in'}</td>
                    <td className="p-1.5 border-b border-r border-zinc-300 text-left font-medium text-zinc-700">
                      {bb.item_category} <span className="text-zinc-400 ml-1">[{bb.gross_weight_g}g]</span>
                    </td>
                    <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-zinc-600">{grossVal.toLocaleString()}</td>
                    <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-rose-500">{deductVal.toLocaleString()}</td>
                    <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-bold text-rose-700 bg-slate-50/50">{netRef.toLocaleString()}</td>
                  </tr>
                );
              })}
              {buybacks.length === 0 && (
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
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, buybacks.length)} of {buybacks.length}
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