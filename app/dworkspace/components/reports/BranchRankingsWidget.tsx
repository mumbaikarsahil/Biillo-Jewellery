"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfMonth, startOfDay, endOfDay } from "date-fns";
import { Loader2, ArrowRight, ChevronLeft, ChevronRight, FileSpreadsheet, Trophy, Medal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BranchRankingsWidget({ overrideData }: { overrideData?: any[] } = {}) {
  const { appUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("30d"); 
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [invoices, setInvoices] = useState<any[]>([]);

  // Pagination State
  const [isExpandedView, setIsExpandedView] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    if (overrideData) {
      setInvoices(overrideData);
      setIsLoading(false);
      return;
    }
    if (!appUser?.company_id) return;
    if (timeframe === "custom" && (!customStart || !customEnd)) return;

    const fetchSalesData = async () => {
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
          .from("invoices")
          .select(`
            id, final_total, taxable_value, cgst_amount, sgst_amount, discount_amount, voucher_discount,
            warehouse_id, status,
            warehouses(name)
          `)
          .eq("company_id", appUser.company_id)
          .neq("status", "CANCELLED")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString());

        if (error) throw error;
        setInvoices(data || []);
        setPage(1); 
      } catch (err) {
        console.error("Failed to fetch branch rankings:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSalesData();
  }, [appUser, timeframe, customStart, customEnd]);

  // --- CALCULATIONS & GROUPING ---
  const branchRankings = useMemo(() => {
    const branchMap: Record<string, any> = {};
    let totalCompanyRevenue = 0;

    invoices.forEach(inv => {
      const wId = inv.warehouse_id || 'UNKNOWN';
      const wName = inv.warehouses?.name || 'Unknown Branch';
      
      const gross = Number(inv.final_total) || 0;
      const tax = (Number(inv.cgst_amount) || 0) + (Number(inv.sgst_amount) || 0);
      const discount = (Number(inv.discount_amount) || 0) + (Number(inv.voucher_discount) || 0);
      
      totalCompanyRevenue += gross;

      if (!branchMap[wId]) {
        branchMap[wId] = { id: wId, name: wName, gross: 0, tax: 0, discount: 0, bills: 0 };
      }
      
      branchMap[wId].gross += gross;
      branchMap[wId].tax += tax;
      branchMap[wId].discount += discount;
      branchMap[wId].bills += 1;
    });

    // Convert to array and sort by Gross Revenue descending
    const sortedBranches = Object.values(branchMap).sort((a, b) => b.gross - a.gross);
    
    return { list: sortedBranches, totalCompanyRevenue };
  }, [invoices]);

  // Pagination Logic
  const totalPages = Math.ceil(branchRankings.list.length / pageSize);
  const paginatedBranches = isExpandedView 
    ? branchRankings.list.slice((page - 1) * pageSize, page * pageSize)
    : branchRankings.list.slice(0, 5); 

  if (isLoading && invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full min-h-[250px] text-zinc-400">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Calculating Standings...</span>
      </div>
    );
  }

  // Visual helper for rankings
  const renderRankBadge = (index: number, realPage: number) => {
    const absoluteRank = (realPage - 1) * pageSize + index + 1;
    if (absoluteRank === 1) return <div className="flex items-center justify-center bg-amber-100 text-amber-600 w-6 h-6 rounded border border-amber-200"><Trophy className="w-3.5 h-3.5" /></div>;
    if (absoluteRank === 2) return <div className="flex items-center justify-center bg-slate-200 text-slate-600 w-6 h-6 rounded border border-slate-300"><Medal className="w-3.5 h-3.5" /></div>;
    if (absoluteRank === 3) return <div className="flex items-center justify-center bg-orange-100 text-orange-700 w-6 h-6 rounded border border-orange-200"><Medal className="w-3.5 h-3.5" /></div>;
    return <div className="flex items-center justify-center bg-zinc-100 text-zinc-500 w-6 h-6 rounded font-mono font-bold text-[10px] border border-zinc-200">{absoluteRank}</div>;
  };

  return (
    <div className="flex flex-col h-full w-full space-y-4">
      
      {/* Widget Header & Filters */}
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">Branch Performance Rankings</h3>
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

      {/* EXCEL-STYLE SUMMARY HEADER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <table className="w-full border-collapse border border-zinc-300 text-[11px]">
          <tbody>
            <tr className="bg-amber-50/50">
              <td className="border border-zinc-300 p-1.5 text-zinc-600 font-bold uppercase w-1/2">Top Performing Branch</td>
              <td className="border border-zinc-300 p-1.5 text-right font-bold text-amber-700 uppercase">
                {branchRankings.list.length > 0 ? branchRankings.list[0].name : "N/A"}
              </td>
            </tr>
            <tr className="bg-zinc-50">
              <td className="border border-zinc-300 p-1.5 text-zinc-600 font-bold uppercase">Total Company Revenue</td>
              <td className="border border-zinc-300 p-1.5 text-right font-mono font-black text-indigo-700">
                ₹{branchRankings.totalCompanyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* EXCEL-STYLE LEADERBOARD TABLE */}
      <div className="pt-2 flex-1 flex flex-col min-h-0">
        <div className="flex justify-between items-end mb-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Revenue & Collection Leaderboard</p>
          {!isExpandedView && branchRankings.list.length > 5 && (
            <span 
              className="text-[10px] font-bold text-indigo-600 flex items-center cursor-pointer hover:underline"
              onClick={() => setIsExpandedView(true)}
            >
              View All ({branchRankings.list.length}) <ArrowRight className="w-3 h-3 ml-1" />
            </span>
          )}
        </div>
        
        <div className="border border-zinc-300 overflow-x-auto flex-1 custom-scrollbar bg-white">
          <table className="w-full border-collapse text-[10px] whitespace-nowrap">
            <thead className="sticky top-0 bg-zinc-100 shadow-[0_1px_0_#d4d4d8] z-10">
              <tr>
                <th className="p-1.5 text-center font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[50px]">Rank</th>
                <th className="p-1.5 text-left font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 min-w-[150px]">Store / Branch Name</th>
                <th className="p-1.5 text-center font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[80px]">Total Bills</th>
                <th className="p-1.5 text-right font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[100px]">Total Tax (₹)</th>
                <th className="p-1.5 text-right font-bold text-zinc-700 uppercase border-b border-r border-zinc-300 w-[100px]">Discounts (₹)</th>
                <th className="p-1.5 text-right font-bold text-zinc-700 uppercase border-b border-zinc-300 w-[120px] bg-amber-50/50">Gross Revenue (₹)</th>
              </tr>
            </thead>
            <tbody>
              {paginatedBranches.map((branch, idx) => (
                <tr key={branch.id} className="hover:bg-amber-50/30 transition-colors">
                  <td className="p-1.5 border-b border-r border-zinc-300 flex justify-center align-middle">
                    {renderRankBadge(idx, page)}
                  </td>
                  <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-zinc-800 truncate max-w-[180px]">{branch.name}</td>
                  <td className="p-1.5 border-b border-r border-zinc-300 text-center font-mono font-medium text-zinc-600">{branch.bills}</td>
                  <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-zinc-500">{branch.tax.toLocaleString()}</td>
                  <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-rose-500">{branch.discount > 0 ? `-${branch.discount.toLocaleString()}` : '0'}</td>
                  <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-black text-amber-700 bg-amber-50/20">{branch.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              {branchRankings.list.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-zinc-400 italic border-b border-zinc-300">No sales records to rank.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls (Only visible when Expanded) */}
        {isExpandedView && totalPages > 1 && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-200">
            <span className="text-[10px] text-zinc-500 font-medium">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, branchRankings.list.length)} of {branchRankings.list.length}
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