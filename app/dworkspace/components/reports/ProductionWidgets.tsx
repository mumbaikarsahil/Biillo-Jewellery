"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfMonth, startOfDay, endOfDay } from "date-fns";
import { Loader2, ArrowRight, ChevronLeft, ChevronRight, Briefcase, Scissors, Truck, ArrowLeftRight, Diamond, Layers } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProductionReportType = 
  | "active_job_bags"
  | "karigar_performance"
  | "gold_consumption"
  | "diamond_consumption"
  | "stock_transfers_out"
  | "stock_transfers_in";

interface BaseProps {
  type: ProductionReportType;
  title: string;
  icon: any;
  overrideData?: any[];
}

function BaseProductionWidget({ type, title, icon: Icon, overrideData }: BaseProps) {
  const { appUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("30d"); 
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [records, setRecords] = useState<any[]>([]);

  // Pagination State
  const [isExpandedView, setIsExpandedView] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    // ✨ THE BYPASS
    if (overrideData) {
      setRecords(overrideData);
      setIsLoading(false);
      return;
    }
    if (!appUser?.company_id) return;
    if (timeframe === "custom" && (!customStart || !customEnd)) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const now = new Date();
        let startDate = new Date();
        let endDate = endOfDay(now);

        if (timeframe === "today") startDate = startOfDay(now);
        else if (timeframe === "yesterday") { startDate = startOfDay(subDays(now, 1)); endDate = endOfDay(subDays(now, 1)); }
        else if (timeframe === "7d") startDate = startOfDay(subDays(now, 7));
        else if (timeframe === "30d") startDate = startOfDay(subDays(now, 30));
        else if (timeframe === "month") startDate = startOfMonth(now);
        else if (timeframe === "custom") { startDate = startOfDay(new Date(customStart)); endDate = endOfDay(new Date(customEnd)); }

        const startISO = startDate.toISOString();
        const endISO = endDate.toISOString();

        let data: any[] = [];

        switch (type) {
          case "active_job_bags":
            const { data: jbData } = await supabase
              .from('job_bags')
              .select('id, created_at, job_bag_number, status, gold_expected_weight_g, diamond_expected_weight_cts, issue_date, expected_return_date, karigars(full_name)')
              .eq('company_id', appUser.company_id)
              .gte('created_at', startISO)
              .lte('created_at', endISO)
              .order('created_at', { ascending: false });
            data = jbData || [];
            break;

            case "karigar_performance":
                const { data: kData } = await supabase
                  .from('job_bags')
                  .select('id, status, karigars(full_name, specialization, is_active)')
                  .eq('company_id', appUser.company_id)
                  .gte('created_at', startISO)
                  .lte('created_at', endISO);
                  
                const karigarMap: Record<string, any> = {};
                
                // ✨ FIXED: Added (jb: any) to prevent the "never" type error
                kData?.forEach((jb: any) => {
                  const name = Array.isArray(jb.karigars) ? jb.karigars[0]?.full_name : jb.karigars?.full_name;
                  if (!name) return;
                  if (!karigarMap[name]) karigarMap[name] = { name, assigned: 0, completed: 0, in_progress: 0 };
                  
                  karigarMap[name].assigned += 1;
                  if (jb.status === 'completed' || jb.status === 'closed') karigarMap[name].completed += 1;
                  else karigarMap[name].in_progress += 1;
                });
                
                data = Object.values(karigarMap).sort((a: any, b: any) => b.assigned - a.assigned);
                break;

          case "gold_consumption":
            const { data: gcData } = await supabase
              .from('job_bag_gold_consumption')
              .select('id, created_at, consumed_weight_g, loss_weight_g, job_bags(job_bag_number, karigars(full_name)), inventory_gold_batches(batch_number)')
              .gte('created_at', startISO)
              .lte('created_at', endISO)
              .order('created_at', { ascending: false });
            data = gcData || [];
            break;

          case "diamond_consumption":
            const { data: dcData } = await supabase
              .from('job_bag_diamond_consumption')
              .select('id, created_at, consumed_weight_cts, consumed_pieces, breakage_weight_cts, job_bags(job_bag_number, karigars(full_name)), inventory_diamond_lots(lot_number)')
              .gte('created_at', startISO)
              .lte('created_at', endISO)
              .order('created_at', { ascending: false });
            data = dcData || [];
            break;

          case "stock_transfers_out":
          case "stock_transfers_in":
            // For transfers, we need to know the 'from' and 'to' warehouses.
            let stQuery = supabase
              .from('stock_transfers')
              .select('id, transfer_number, status, transfer_date, transfer_category, from_warehouse_id, to_warehouse_id')
              .eq('company_id', appUser.company_id)
              .gte('created_at', startISO)
              .lte('created_at', endISO)
              .order('created_at', { ascending: false });
              
            const { data: stData } = await stQuery;
            
            // Note: Since warehouse names require resolving from_id and to_id, in a real environment 
            // you'd do a double join, but Supabase struggles with double FK to the same table in a simple query.
            // For this UI mockup, we will display the IDs or 'HQ/Branch'.
            data = stData || [];
            break;
        }

        setRecords(data);
        setPage(1); 
      } catch (err) {
        console.error(`Failed to fetch ${type} data:`, err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [appUser, timeframe, customStart, customEnd, type]);

  const totalPages = Math.ceil(records.length / pageSize);
  const paginatedRecords = isExpandedView ? records.slice((page - 1) * pageSize, page * pageSize) : records.slice(0, 5); 

  if (isLoading && records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full min-h-[200px] text-zinc-400">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Compiling Production Data...</span>
      </div>
    );
  }

  // Column Renderer based on Type
  const renderHeaders = () => {
    if (type === 'active_job_bags') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Issue Date</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[120px]">Job Bag No</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[150px]">Karigar Assigned</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[100px]">Status</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[100px]">Exp Gold (g)</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[100px] bg-slate-50">Exp Diamond (ct)</th>
      </tr>
    );
    if (type === 'karigar_performance') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[200px]">Karigar Name</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[120px]">Total Assigned</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[120px]">In Progress</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[120px] bg-emerald-50">Completed</th>
      </tr>
    );
    if (type === 'gold_consumption') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Date Consumed</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[120px]">Job Bag No</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[130px]">Karigar</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[120px]">Gold Batch Ref</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[100px]">Consumed (g)</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[100px] bg-rose-50">Loss Wt (g)</th>
      </tr>
    );
    if (type === 'diamond_consumption') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Date Consumed</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[120px]">Job Bag No</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[130px]">Karigar</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[120px]">Diamond Lot Ref</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[100px]">Consumed (ct)</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[100px] bg-rose-50">Breakage (ct)</th>
      </tr>
    );
    if (type === 'stock_transfers_out' || type === 'stock_transfers_in') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Transfer Date</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[140px]">Transfer Ref No</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[120px]">From Location</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[120px]">To Location</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[100px]">Category</th>
        <th className="p-1.5 text-center border-b border-zinc-300 w-[100px] bg-slate-50">Status</th>
      </tr>
    );
    return null;
  };

  const renderRows = (r: any, idx: number) => {
    if (type === 'active_job_bags') {
      const karigarName = Array.isArray(r.karigars) ? r.karigars[0]?.full_name : r.karigars?.full_name;
      return (
        <>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{r.issue_date ? format(new Date(r.issue_date), 'dd-MM-yy') : 'Pending'}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 font-mono font-bold text-indigo-700">{r.job_bag_number}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800 truncate">{karigarName || 'Unassigned'}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-center font-bold text-zinc-500 uppercase">{r.status.replace(/_/g, ' ')}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-amber-600">{Number(r.gold_expected_weight_g || 0).toFixed(3)}</td>
          <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-bold text-sky-600 bg-slate-50/50">{Number(r.diamond_expected_weight_cts || 0).toFixed(2)}</td>
        </>
      );
    }
    if (type === 'karigar_performance') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-zinc-800">{r.name}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-zinc-600">{r.assigned}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono font-bold text-amber-600">{r.in_progress}</td>
        <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-black text-emerald-600 bg-emerald-50/30">{r.completed}</td>
      </>
    );
    if (type === 'gold_consumption') {
      const jobBagData = Array.isArray(r.job_bags) ? r.job_bags[0] : r.job_bags;
      const karigarName = Array.isArray(jobBagData?.karigars) ? jobBagData?.karigars[0]?.full_name : jobBagData?.karigars?.full_name;
      const batchRef = Array.isArray(r.inventory_gold_batches) ? r.inventory_gold_batches[0]?.batch_number : r.inventory_gold_batches?.batch_number;
      return (
        <>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.created_at), 'dd-MM-yy HH:mm')}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 font-mono font-bold text-indigo-700">{jobBagData?.job_bag_number || 'N/A'}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800 truncate">{karigarName || 'Unknown'}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 font-mono text-amber-600">{batchRef || 'N/A'}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono font-bold text-zinc-900">{Number(r.consumed_weight_g).toFixed(3)}</td>
          <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-bold text-rose-600 bg-rose-50/50">{Number(r.loss_weight_g).toFixed(3)}</td>
        </>
      );
    }
    if (type === 'diamond_consumption') {
      const jobBagData = Array.isArray(r.job_bags) ? r.job_bags[0] : r.job_bags;
      const karigarName = Array.isArray(jobBagData?.karigars) ? jobBagData?.karigars[0]?.full_name : jobBagData?.karigars?.full_name;
      const lotRef = Array.isArray(r.inventory_diamond_lots) ? r.inventory_diamond_lots[0]?.lot_number : r.inventory_diamond_lots?.lot_number;
      return (
        <>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.created_at), 'dd-MM-yy HH:mm')}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 font-mono font-bold text-indigo-700">{jobBagData?.job_bag_number || 'N/A'}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800 truncate">{karigarName || 'Unknown'}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 font-mono text-sky-600">{lotRef || 'N/A'}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono font-bold text-zinc-900">{Number(r.consumed_weight_cts).toFixed(2)}</td>
          <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-bold text-rose-600 bg-rose-50/50">{Number(r.breakage_weight_cts).toFixed(2)}</td>
        </>
      );
    }
    if (type === 'stock_transfers_out' || type === 'stock_transfers_in') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.transfer_date), 'dd-MM-yy')}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 font-mono font-bold text-indigo-700">{r.transfer_number}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600 font-mono truncate">{r.from_warehouse_id.substring(0,8).toUpperCase()}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600 font-mono truncate">{r.to_warehouse_id.substring(0,8).toUpperCase()}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-center text-zinc-700 uppercase">{r.transfer_category.replace(/_/g, ' ')}</td>
        <td className="p-1.5 border-b border-zinc-300 text-center font-bold text-zinc-500 uppercase bg-slate-50/50">{r.status.replace(/_/g, ' ')}</td>
      </>
    );
    return null;
  };

  return (
    <div className="flex flex-col h-full w-full space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-zinc-700" />
          <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">{title}</h3>
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 ml-2">
            {records.length} Records
          </span>
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

      <div className="pt-2 flex-1 flex flex-col min-h-0">
        
        <div className="border border-zinc-300 overflow-x-auto flex-1 custom-scrollbar bg-white">
          <table className="w-full border-collapse text-[10px] whitespace-nowrap">
            <thead className="sticky top-0 bg-zinc-100 shadow-[0_1px_0_#d4d4d8] font-bold text-zinc-700 uppercase">
              {renderHeaders()}
            </thead>
            <tbody>
              {paginatedRecords.map((r, i) => (
                <tr key={r.id || r.name || i} className="hover:bg-zinc-50/80 transition-colors">
                  {renderRows(r, i)}
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-zinc-400 italic border-b border-zinc-300">No records found matching criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {isExpandedView && totalPages > 1 && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-200">
            <span className="text-[10px] text-zinc-500 font-medium">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, records.length)} of {records.length}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-6 w-6 rounded-sm border-zinc-300" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <span className="text-[10px] font-mono px-2">Page {page} of {totalPages}</span>
              <Button variant="outline" size="icon" className="h-6 w-6 rounded-sm border-zinc-300" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
            <span className="text-[10px] font-bold text-zinc-500 cursor-pointer hover:underline" onClick={() => { setIsExpandedView(false); setPage(1); }}>
              Collapse
            </span>
          </div>
        )}
        
        {!isExpandedView && records.length > 5 && (
           <div className="mt-2 text-right">
             <span className="text-[10px] font-bold text-indigo-600 flex items-center justify-end cursor-pointer hover:underline" onClick={() => setIsExpandedView(true)}>
                View All ({records.length}) <ArrowRight className="w-3 h-3 ml-1" />
             </span>
           </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// INDIVIDUAL EXPORTS (The 6 Production Widgets)
// ============================================================================

export const ProdActiveJobBagsWidget = ({ overrideData }: { overrideData?: any[] } = {})=> ( <BaseProductionWidget type="active_job_bags" title="1) Active Job Bags Tracker" icon={Briefcase} overrideData={overrideData} />)
export const ProdKarigarPerformanceWidget = ({ overrideData }: { overrideData?: any[] } = {})=> ( <BaseProductionWidget type="karigar_performance" title="2) Karigar Performance / Yield" icon={Scissors} overrideData={overrideData} />)
export const ProdGoldConsumptionWidget = ({ overrideData }: { overrideData?: any[] } = {})=> ( <BaseProductionWidget type="gold_consumption" title="3) Raw Gold Consumption & Loss" icon={Layers} overrideData={overrideData} />)
export const ProdDiamondConsumptionWidget = ({ overrideData }: { overrideData?: any[] } = {})=> ( <BaseProductionWidget type="diamond_consumption" title="4) Diamond Consumption & Breakage" icon={Diamond} overrideData={overrideData} />)
export const ProdStockTransfersOutWidget = ({ overrideData }: { overrideData?: any[] } = {})=> ( <BaseProductionWidget type="stock_transfers_out" title="5) Stock Transfers (Outbound)" icon={Truck} overrideData={overrideData} />)
export const ProdStockTransfersInWidget = ({ overrideData }: { overrideData?: any[] } = {})=> ( <BaseProductionWidget type="stock_transfers_in" title="6) Stock Transfers (Inbound)" icon={ArrowLeftRight} overrideData={overrideData} />)