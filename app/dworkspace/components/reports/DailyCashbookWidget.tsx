"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfMonth, startOfDay, endOfDay } from "date-fns";
import { Loader2, ArrowRight, ChevronLeft, ChevronRight, FileSpreadsheet, BookOpen } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DailyCashbookWidget() {
  const { appUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("7d"); 
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [cashbooks, setCashbooks] = useState<any[]>([]);

  // Pagination State
  const [isExpandedView, setIsExpandedView] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    if (!appUser?.company_id) return;
    if (timeframe === "custom" && (!customStart || !customEnd)) return; // Wait for dates

    const fetchCashbookData = async () => {
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
          .from("daily_cashbooks")
          .select(`
            id, record_date, yesterday_cash, closing_balance, 
            cash_in_out, expenses, 
            warehouses(name)
          `)
          .eq("company_id", appUser.company_id)
          .gte("record_date", startDate.toISOString().split('T')[0])
          .lte("record_date", endDate.toISOString().split('T')[0])
          .order("record_date", { ascending: false });

        if (error) throw error;
        setCashbooks(data || []);
        setPage(1); 
      } catch (err) {
        console.error("Failed to fetch cashbooks:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCashbookData();
  }, [appUser, timeframe, customStart, customEnd]);

  // --- CALCULATIONS & JSONB PARSING ---
  const metrics = useMemo(() => {
    let totalExpenses = 0;
    let totalManualCashFlow = 0;
    let totalClosingBalance = 0;

    cashbooks.forEach(cb => {
      totalClosingBalance += Number(cb.closing_balance) || 0;

      // Safely parse expenses JSONB
      let expArray = [];
      if (Array.isArray(cb.expenses)) expArray = cb.expenses;
      else if (typeof cb.expenses === 'string') {
        try { expArray = JSON.parse(cb.expenses); } catch (e) {}
      }
      expArray.forEach((e: any) => totalExpenses += (Number(e.amount) || 0));

      // Safely parse cash_in_out JSONB
      let cioArray = [];
      if (Array.isArray(cb.cash_in_out)) cioArray = cb.cash_in_out;
      else if (typeof cb.cash_in_out === 'string') {
        try { cioArray = JSON.parse(cb.cash_in_out); } catch (e) {}
      }
      cioArray.forEach((c: any) => totalManualCashFlow += (Number(c.amount) || 0));
    });

    const avgClosing = cashbooks.length > 0 ? totalClosingBalance / cashbooks.length : 0;

    return { 
      totalExpenses, 
      totalManualCashFlow, 
      avgClosing, 
      count: cashbooks.length 
    };
  }, [cashbooks]);

  // Pagination Logic
  const totalPages = Math.ceil(cashbooks.length / pageSize);
  const paginatedCashbooks = isExpandedView 
    ? cashbooks.slice((page - 1) * pageSize, page * pageSize)
    : cashbooks.slice(0, 5); 

  if (isLoading && cashbooks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full min-h-[250px] text-zinc-400">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Auditing Cashbooks...</span>
      </div>
    );
  }

  // Row-level JSON parser helper for the table
  const calculateRowSums = (cb: any) => {
    let expSum = 0;
    let cioSum = 0;
    
    const exps = Array.isArray(cb.expenses) ? cb.expenses : (typeof cb.expenses === 'string' ? JSON.parse(cb.expenses || '[]') : []);
    const cios = Array.isArray(cb.cash_in_out) ? cb.cash_in_out : (typeof cb.cash_in_out === 'string' ? JSON.parse(cb.cash_in_out || '[]') : []);
    
    exps.forEach((e: any) => expSum += (Number(e.amount) || 0));
    cios.forEach((c: any) => cioSum += (Number(c.amount) || 0));

    return { expSum, cioSum };
  };

  return (
    <div className="flex flex-col h-full w-full space-y-4">
      
      {/* Widget Header & Filters */}
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">Branch Cashbook Logs</h3>
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
              <th className="border border-zinc-300 p-1.5 text-left font-bold text-zinc-700 uppercase">Cashbook Metric</th>
              <th className="border border-zinc-300 p-1.5 text-right font-bold text-zinc-700 uppercase">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-zinc-300 p-1.5 text-zinc-600 font-medium">Days Logged / Submitted</td>
              <td className="border border-zinc-300 p-1.5 text-right font-mono font-bold text-zinc-900">{metrics.count}</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-1.5 text-zinc-600 font-medium">Total Petty Expenses</td>
              <td className="border border-zinc-300 p-1.5 text-right font-mono font-bold text-rose-600">-{metrics.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-1.5 text-zinc-600 font-medium">Manual Cash In/Out</td>
              <td className="border border-zinc-300 p-1.5 text-right font-mono text-zinc-800">{metrics.totalManualCashFlow.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr className="bg-emerald-50/30">
              <td className="border border-zinc-300 p-1.5 text-zinc-600 font-bold">Average Closing Balance</td>
              <td className="border border-zinc-300 p-1.5 text-right font-mono font-black text-emerald-700">{metrics.avgClosing.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* EXCEL-STYLE TRANSACTIONS LEDGER */}
      <div className="pt-2 flex-1 flex flex-col min-h-0">
        <div className="flex justify-between items-end mb-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Daily Snapshots</p>
          {!isExpandedView && cashbooks.length > 5 && (
            <span 
              className="text-[10px] font-bold text-indigo-600 flex items-center cursor-pointer hover:underline"
              onClick={() => setIsExpandedView(true)}
            >
              View All ({cashbooks.length}) <ArrowRight className="w-3 h-3 ml-1" />
            </span>
          )}
        </div>
        
        <div className="border border-zinc-300 overflow-x-auto flex-1 custom-scrollbar bg-white">
          <table className="w-full border-collapse text-[10px] whitespace-nowrap">
            <thead className="sticky top-0 bg-zinc-100 shadow-[0_1px_0_#d4d4d8]">
              <tr>
                <th className="p-1.5 text-left font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[100px]">Date</th>
                <th className="p-1.5 text-left font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 min-w-[140px]">Branch</th>
                <th className="p-1.5 text-right font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[100px]">Opening (₹)</th>
                <th className="p-1.5 text-right font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[100px]">In/Out (₹)</th>
                <th className="p-1.5 text-right font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[100px]">Expenses (₹)</th>
                <th className="p-1.5 text-right font-bold text-zinc-700 uppercase border-b border-zinc-300 w-[110px] bg-emerald-50/50">Closing Bal (₹)</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCashbooks.map((cb) => {
                const { expSum, cioSum } = calculateRowSums(cb);
                return (
                  <tr key={cb.id} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600 font-mono">{cb.record_date}</td>
                    <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-zinc-800 truncate max-w-[160px]">{cb.warehouses?.name || 'Unknown'}</td>
                    <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-zinc-500">{Number(cb.yesterday_cash).toLocaleString()}</td>
                    <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-zinc-700">{cioSum !== 0 ? cioSum.toLocaleString() : "-"}</td>
                    <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-rose-500">{expSum > 0 ? `-${expSum.toLocaleString()}` : "-"}</td>
                    <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-black text-emerald-700 bg-emerald-50/20">{Number(cb.closing_balance).toLocaleString()}</td>
                  </tr>
                );
              })}
              {cashbooks.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-zinc-400 italic border-b border-zinc-300">No cashbook entries submitted in this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls (Only visible when Expanded) */}
        {isExpandedView && totalPages > 1 && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-200">
            <span className="text-[10px] text-zinc-500 font-medium">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, cashbooks.length)} of {cashbooks.length}
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