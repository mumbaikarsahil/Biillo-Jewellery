"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfMonth, startOfDay, endOfDay } from "date-fns";
import { 
  Loader2, ArrowRight, ChevronLeft, ChevronRight, FileSpreadsheet, 
  RefreshCcw, Bike, FileText, History, Wrench
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type OperationalReportType = 
  | "exchanges"
  | "delivery_agents"
  | "estimates"
  | "inventory_audit"
  | "repair_tickets";

interface BaseProps {
  type: OperationalReportType;
  title: string;
  icon: any;
}

export function BaseOperationalWidget({ type, title, icon: Icon }: BaseProps) {
  const { appUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("30d"); 
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [records, setRecords] = useState<any[]>([]);

  const [isExpandedView, setIsExpandedView] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
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
          case "exchanges":
            const { data: exData } = await supabase
              .from('invoices')
              .select('id, created_at, invoice_number, exchange_value, exchange_notes, final_total, customers(full_name)')
              .eq('company_id', appUser.company_id)
              .gt('exchange_value', 0)
              .neq('status', 'CANCELLED')
              .gte('created_at', startISO)
              .lte('created_at', endISO)
              .order('created_at', { ascending: false });
            data = exData || [];
            break;

          case "delivery_agents":
            const { data: daData } = await supabase
              .from('voucher_distributions')
              .select('delivery_agent, delivery_status, quantity, total_amount')
              .eq('company_id', appUser.company_id)
              .not('delivery_agent', 'is', null)
              .gte('created_at', startISO)
              .lte('created_at', endISO);
            
            const agentMap: Record<string, any> = {};
            daData?.forEach((d: any) => {
              const name = d.delivery_agent;
              if (!agentMap[name]) agentMap[name] = { name, assigned: 0, pending: 0, delivered: 0, total_qty: 0 };
              
              agentMap[name].assigned += 1;
              agentMap[name].total_qty += Number(d.quantity) || 0;
              if (d.delivery_status === 'delivered') agentMap[name].delivered += 1;
              else agentMap[name].pending += 1;
            });
            data = Object.values(agentMap).sort((a: any, b: any) => b.total_qty - a.total_qty);
            break;

          case "estimates":
            const { data: estData } = await supabase
              .from('estimates')
              .select('id, created_at, estimate_number, status, subtotal, discount_amount, total_amount, customers(full_name)')
              .eq('company_id', appUser.company_id)
              .gte('created_at', startISO)
              .lte('created_at', endISO)
              .order('created_at', { ascending: false });
            data = estData || [];
            break;

          case "inventory_audit":
            const [goldRes, diaRes] = await Promise.all([
              supabase.from('gold_lot_movements').select('created_at, movement_type, movement_weight_g, reference_type, notes').eq('company_id', appUser.company_id).gte('created_at', startISO).lte('created_at', endISO),
              supabase.from('diamond_lot_movements').select('created_at, movement_type, movement_weight_cts, reference_type, notes').eq('company_id', appUser.company_id).gte('created_at', startISO).lte('created_at', endISO)
            ]);
            
            const gMap = goldRes.data?.map((g: any) => ({ ...g, material: 'Gold', weight: g.movement_weight_g, unit: 'g' })) || [];
            const dMap = diaRes.data?.map((d: any) => ({ ...d, material: 'Diamond', weight: d.movement_weight_cts, unit: 'cts' })) || [];
            
            data = [...gMap, ...dMap].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            break;

          case "repair_tickets":
            const { data: repData } = await supabase
              .from('repair_tickets')
              .select('id, created_at, ticket_number, item_description, status, estimated_cost, advance_paid, customers(full_name)')
              .eq('company_id', appUser.company_id)
              .gte('created_at', startISO)
              .lte('created_at', endISO)
              .order('created_at', { ascending: false });
            data = repData || [];
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
        <span className="text-[10px] font-bold uppercase tracking-widest">Compiling Report...</span>
      </div>
    );
  }

  const renderHeaders = () => {
    if (type === 'exchanges') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Date</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[120px]">Invoice No</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[130px]">Customer</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[140px]">Exchange Notes</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[110px]">Exchange Value (₹)</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[110px] bg-slate-50">Final Bill (₹)</th>
      </tr>
    );
    if (type === 'delivery_agents') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[150px]">Agent Name</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[100px]">Trips Assigned</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[100px]">Trips Pending</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[100px] bg-emerald-50">Trips Delivered</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[120px]">Total Qty Handled</th>
      </tr>
    );
    if (type === 'estimates') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Date</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[120px]">Estimate No</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[130px]">Customer</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[90px]">Status</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[100px]">Discount (₹)</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[110px] bg-slate-50">Total Quoted (₹)</th>
      </tr>
    );
    if (type === 'inventory_audit') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Date & Time</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[90px]">Material</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[110px]">Movement Type</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[110px]">Reference</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[100px]">Weight Altered</th>
        <th className="p-1.5 text-left border-b border-zinc-300 min-w-[150px]">Audit Notes</th>
      </tr>
    );
    if (type === 'repair_tickets') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Date Logged</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[120px]">Ticket No</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[130px]">Customer</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[140px]">Item Description</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[100px]">Status</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[100px] bg-emerald-50">Advance (₹)</th>
      </tr>
    );
    return null;
  };

  const renderRows = (r: any, idx: number) => {
    if (type === 'exchanges') {
      const custName = Array.isArray(r.customers) ? r.customers[0]?.full_name : r.customers?.full_name;
      return (
        <>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.created_at), 'dd-MM-yy HH:mm')}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 font-mono font-bold text-indigo-700">{r.invoice_number}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800 truncate">{custName || 'Walk-in'}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600 truncate">{r.exchange_notes || 'N/A'}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono font-bold text-rose-600">- {Number(r.exchange_value).toLocaleString()}</td>
          <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-black text-emerald-700 bg-slate-50/50">{Number(r.final_total).toLocaleString()}</td>
        </>
      );
    }
    if (type === 'delivery_agents') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-zinc-800">{r.name}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-center font-mono text-zinc-600">{r.assigned}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-center font-mono font-bold text-amber-600">{r.pending}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-center font-mono font-black text-emerald-600 bg-emerald-50/30">{r.delivered}</td>
        <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-bold text-indigo-700">{r.total_qty.toLocaleString()}</td>
      </>
    );
    if (type === 'estimates') {
      const custName = Array.isArray(r.customers) ? r.customers[0]?.full_name : r.customers?.full_name;
      return (
        <>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.created_at), 'dd-MM-yy HH:mm')}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 font-mono font-bold text-indigo-700">{r.estimate_number}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800 truncate">{custName || 'Walk-in'}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-center font-bold text-zinc-500 uppercase text-[9px]">{r.status}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-rose-500">{Number(r.discount_amount).toLocaleString()}</td>
          <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-black text-zinc-900 bg-slate-50/50">{Number(r.total_amount).toLocaleString()}</td>
        </>
      );
    }
    if (type === 'inventory_audit') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.created_at), 'dd-MM-yy HH:mm')}</td>
        <td className={`p-1.5 border-b border-r border-zinc-300 text-center font-bold ${r.material === 'Gold' ? 'text-amber-600' : 'text-sky-600'}`}>{r.material}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-center font-bold text-zinc-600 uppercase text-[9px]">{r.movement_type.replace(/_/g, ' ')}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-center font-mono text-indigo-600 truncate">{r.reference_type || 'Manual'}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono font-bold text-zinc-900">{r.weight} {r.unit}</td>
        <td className="p-1.5 border-b border-zinc-300 text-zinc-500 truncate">{r.notes || '-'}</td>
      </>
    );
    if (type === 'repair_tickets') {
      const custName = Array.isArray(r.customers) ? r.customers[0]?.full_name : r.customers?.full_name;
      return (
        <>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.created_at), 'dd-MM-yy HH:mm')}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 font-mono font-bold text-indigo-700">{r.ticket_number}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800 truncate">{custName || 'Walk-in'}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600 truncate">{r.item_description}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-center font-bold text-[9px] uppercase tracking-widest text-amber-600">{r.status.replace(/_/g, ' ')}</td>
          <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-black text-emerald-700 bg-emerald-50/50">{Number(r.advance_paid).toLocaleString()}</td>
        </>
      );
    }
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
// INDIVIDUAL EXPORTS
// ============================================================================

export const OpsExchangesWidget = () => <BaseOperationalWidget type="exchanges" title="Exchanges & Trade-Ins" icon={RefreshCcw} />
export const OpsDeliveryAgentsWidget = () => <BaseOperationalWidget type="delivery_agents" title="Voucher Delivery Agents" icon={Bike} />
export const OpsEstimatesWidget = () => <BaseOperationalWidget type="estimates" title="Estimates & Quotes" icon={FileText} />
export const OpsInventoryAuditWidget = () => <BaseOperationalWidget type="inventory_audit" title="Raw Material Audit Logs" icon={History} />
export const OpsRepairTicketsWidget = () => <BaseOperationalWidget type="repair_tickets" title="Repair & Service Tickets" icon={Wrench} />