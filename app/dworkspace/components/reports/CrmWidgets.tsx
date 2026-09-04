"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, addDays, startOfMonth, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { 
  Loader2, ArrowRight, ChevronLeft, ChevronRight, Users, 
  Gift, CalendarHeart, PhoneCall, Wallet, Send, ShieldCheck
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type CrmReportType = 
  | "customer_base"
  | "upcoming_events"
  | "followups_due"
  | "wallet_balances"
  | "kitty_plans"
  | "gifting_history"
  | "whatsapp_sequences"
  | "call_assignments";

interface BaseProps {
  type: CrmReportType;
  title: string;
  icon: any;
}

// Some reports look forward (Follow-ups, Events), others look backward (History, Base)
const isForwardLooking = (type: CrmReportType) => ["upcoming_events", "followups_due", "whatsapp_sequences"].includes(type);

export function BaseCrmWidget({ type, title, icon: Icon }: BaseProps) {
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
    if (!appUser?.company_id) return;
    if (timeframe === "custom" && (!customStart || !customEnd)) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const now = new Date();
        let startDate = new Date();
        let endDate = endOfDay(now);

        // Date logic flips depending on if we are predicting the future or auditing the past
        if (isForwardLooking(type)) {
          startDate = startOfDay(now);
          if (timeframe === "today") endDate = endOfDay(now);
          else if (timeframe === "yesterday") { startDate = startOfDay(subDays(now, 1)); endDate = endOfDay(subDays(now, 1)); }
          else if (timeframe === "7d") endDate = endOfDay(addDays(now, 7));
          else if (timeframe === "30d") endDate = endOfDay(addDays(now, 30));
          else if (timeframe === "month") endDate = endOfDay(startOfMonth(addDays(now, 30))); // Roughly next month
          else if (timeframe === "custom") { startDate = startOfDay(new Date(customStart)); endDate = endOfDay(new Date(customEnd)); }
        } else {
          if (timeframe === "today") startDate = startOfDay(now);
          else if (timeframe === "yesterday") { startDate = startOfDay(subDays(now, 1)); endDate = endOfDay(subDays(now, 1)); }
          else if (timeframe === "7d") startDate = startOfDay(subDays(now, 7));
          else if (timeframe === "30d") startDate = startOfDay(subDays(now, 30));
          else if (timeframe === "month") startDate = startOfMonth(now);
          else if (timeframe === "custom") { startDate = startOfDay(new Date(customStart)); endDate = endOfDay(new Date(customEnd)); }
        }

        const startISO = startDate.toISOString();
        const endISO = endDate.toISOString();

        let data: any[] = [];

        switch (type) {
          case "customer_base":
            const { data: cbData } = await supabase.from('customers').select('id, created_at, full_name, phone, customer_status, last_interaction, warehouses(name)').eq('company_id', appUser.company_id).gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false });
            data = cbData || [];
            break;

            case "upcoming_events":
                // Birthdays & Anniversaries bypass strict year tracking, so we fetch all with events and filter in-memory for accuracy
                const { data: evtData } = await supabase.from('customers').select('id, full_name, phone, birth_date, anniversary_date').eq('company_id', appUser.company_id).or('birth_date.not.is.null,anniversary_date.not.is.null');
                
                const upcoming: any[] = [];
                
                // ✨ FIXED: Added (c: any) to bypass the string indexing error
                evtData?.forEach((c: any) => {
                  ['birth_date', 'anniversary_date'].forEach(field => {
                    if (c[field]) {
                      const evtDate = new Date(c[field]);
                      // Project the date into the current year to check if it falls in our timeframe window
                      const projectedDate = new Date(now.getFullYear(), evtDate.getMonth(), evtDate.getDate());
                      // If the projected date already passed this year, project it to next year
                      if (projectedDate < startOfDay(now)) projectedDate.setFullYear(now.getFullYear() + 1);
                      
                      if (isWithinInterval(projectedDate, { start: startDate, end: endDate })) {
                        upcoming.push({ ...c, event_type: field === 'birth_date' ? 'Birthday' : 'Anniversary', projected_date: projectedDate.toISOString(), original_date: c[field] });
                      }
                    }
                  });
                });
                data = upcoming.sort((a,b) => new Date(a.projected_date).getTime() - new Date(b.projected_date).getTime());
                break;

          case "followups_due":
            const { data: fData } = await supabase.from('customers').select('id, full_name, phone, next_followup_date, followup_reason, customer_status').eq('company_id', appUser.company_id).gte('next_followup_date', startISO.split('T')[0]).lte('next_followup_date', endISO.split('T')[0]).order('next_followup_date', { ascending: true });
            data = fData || [];
            break;

          case "wallet_balances":
            // Snapshot report: Ignors date filters, shows current liability
            const { data: wData } = await supabase.from('customers').select('id, full_name, phone, store_credit_balance, pavitram_points').eq('company_id', appUser.company_id).or('store_credit_balance.gt.0,pavitram_points.gt.0').order('store_credit_balance', { ascending: false });
            data = wData || [];
            break;

          case "kitty_plans":
            const { data: kpData } = await supabase.from('kitty_plans').select('id, start_date, plan_amount, total_months, months_paid, status, customers(full_name, phone)').eq('company_id', appUser.company_id).gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false });
            data = kpData || [];
            break;

          case "gifting_history":
            const { data: ghData } = await supabase.from('customer_gifts_history').select('id, created_at, gift_name, customers(full_name, phone)').eq('company_id', appUser.company_id).gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false });
            data = ghData || [];
            break;

          case "whatsapp_sequences":
            const { data: waData } = await supabase.from('voucher_message_sequences').select('id, next_send_at, voucher_code, current_step, status, customers(full_name, phone)').gte('next_send_at', startISO).lte('next_send_at', endISO).order('next_send_at', { ascending: true });
            data = waData || [];
            break;

            case "call_assignments":
            const { data: caData } = await supabase
              .from('voucher_call_assignments')
              .select('id, created_at, status, call_outcome, attempt_count, interest_level, customers(full_name, phone), vouchers(code)')
              .eq('company_id', appUser.company_id)
              .gte('created_at', startISO)
              .lte('created_at', endISO)
              .order('created_at', { ascending: false });
            data = caData || [];
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
        <span className="text-[10px] font-bold uppercase tracking-widest">Querying CRM Database...</span>
      </div>
    );
  }

  // Column Renderer based on Type
  const renderHeaders = () => {
    if (type === 'customer_base') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Date Added</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[150px]">Customer Name</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[120px]">Phone Number</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[100px]">Status</th>
        <th className="p-1.5 text-left border-b border-zinc-300 min-w-[130px] bg-slate-50">Last Interaction</th>
      </tr>
    );
    if (type === 'upcoming_events') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Upcoming Date</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[100px]">Event Type</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[150px]">Customer Name</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[120px]">Phone Number</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[100px] bg-indigo-50">Original Date</th>
      </tr>
    );
    if (type === 'followups_due') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Due Date</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[150px]">Customer Name</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[120px]">Phone Number</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[100px]">Lead Status</th>
        <th className="p-1.5 text-left border-b border-zinc-300 min-w-[150px] bg-amber-50">Follow-up Reason</th>
      </tr>
    );
    if (type === 'wallet_balances') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[150px]">Customer Name</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[120px]">Phone Number</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[120px]">Store Credit (₹)</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[120px] bg-emerald-50">Pavitram Points</th>
      </tr>
    );
    if (type === 'kitty_plans') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Enrolled Date</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[150px]">Customer Name</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[100px]">Status</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[100px]">Installment (₹)</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[120px] bg-slate-50">Progress (Months)</th>
      </tr>
    );
    if (type === 'whatsapp_sequences') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[130px]">Scheduled Send</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[120px]">Voucher Code</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[150px]">Customer</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[80px]">Sequence</th>
        <th className="p-1.5 text-center border-b border-zinc-300 w-[100px] bg-teal-50">API Status</th>
      </tr>
    );
    if (type === 'gifting_history') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Date Issued</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[150px]">Gift Name</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[150px]">Customer Name</th>
        <th className="p-1.5 text-left border-b border-zinc-300 w-[120px] bg-slate-50">Phone Number</th>
      </tr>
    );

    if (type === 'call_assignments') return (
        <tr>
          <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Date Assigned</th>
          <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[150px]">Customer</th>
          <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Phone Number</th>
          <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[100px]">Voucher Ref</th>
          <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[90px]">Attempts</th>
          <th className="p-1.5 text-left border-b border-zinc-300 min-w-[150px] bg-slate-50">Status & Outcome</th>
        </tr>
      );
    return null;
  };

  const renderRows = (r: any, idx: number) => {
    if (type === 'customer_base') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.created_at), 'dd-MM-yy HH:mm')}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-zinc-800 truncate">{r.full_name}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 font-mono text-zinc-600">{r.phone}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-center font-bold text-[9px] uppercase tracking-widest text-indigo-600 bg-indigo-50/50">{r.customer_status}</td>
        <td className="p-1.5 border-b border-zinc-300 text-zinc-600 truncate bg-slate-50/50">{r.last_interaction || '-'}</td>
      </>
    );
    if (type === 'upcoming_events') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-rose-600">{format(new Date(r.projected_date), 'dd-MMM-yyyy')}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-center font-bold text-[9px] uppercase tracking-widest text-rose-700 bg-rose-50/50">{r.event_type}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-zinc-800 truncate">{r.full_name}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 font-mono text-zinc-600">{r.phone}</td>
        <td className="p-1.5 border-b border-zinc-300 text-right font-mono text-zinc-400 bg-indigo-50/20">{r.original_date ? format(new Date(r.original_date), 'dd-MMM-yyyy') : '-'}</td>
      </>
    );
    if (type === 'followups_due') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-amber-600">{r.next_followup_date ? format(new Date(r.next_followup_date), 'dd-MMM-yyyy') : '-'}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-zinc-800 truncate">{r.full_name}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 font-mono text-zinc-600">{r.phone}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-center font-bold text-[9px] uppercase tracking-widest text-zinc-500">{r.customer_status}</td>
        <td className="p-1.5 border-b border-zinc-300 text-zinc-800 font-medium truncate bg-amber-50/30">{r.followup_reason || 'Check-in'}</td>
      </>
    );
    if (type === 'wallet_balances') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-zinc-800 truncate">{r.full_name}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 font-mono text-zinc-600">{r.phone}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono font-bold text-indigo-700">{Number(r.store_credit_balance).toLocaleString()}</td>
        <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-bold text-emerald-600 bg-emerald-50/50">{Number(r.pavitram_points).toLocaleString()}</td>
      </>
    );
    if (type === 'kitty_plans') {
      const custName = Array.isArray(r.customers) ? r.customers[0]?.full_name : r.customers?.full_name;
      return (
        <>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.start_date), 'dd-MMM-yyyy')}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-zinc-800 truncate">{custName || 'Unknown'}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-center font-bold text-[9px] uppercase tracking-widest text-emerald-600">{r.status}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono font-bold text-zinc-900">{Number(r.plan_amount).toLocaleString()}</td>
          <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-bold text-indigo-700 bg-slate-50/50">{r.months_paid} / {r.total_months}</td>
        </>
      );
    }
    if (type === 'whatsapp_sequences') {
      const custName = Array.isArray(r.customers) ? r.customers[0]?.full_name : r.customers?.full_name;
      const isFailed = r.status.toLowerCase() === 'failed';
      return (
        <>
          <td className={`p-1.5 border-b border-r border-zinc-300 font-bold ${isFailed ? 'text-rose-600' : 'text-teal-700'}`}>{format(new Date(r.next_send_at), 'dd-MMM HH:mm')}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-center font-mono font-bold text-indigo-700 uppercase">{r.voucher_code}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-zinc-800 truncate">{custName || 'Unknown'}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-center font-mono font-medium text-zinc-500">Step {r.current_step}</td>
          <td className={`p-1.5 border-b border-zinc-300 text-center font-bold text-[9px] uppercase tracking-widest ${isFailed ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'}`}>{r.status}</td>
        </>
      );
    }
    if (type === 'gifting_history') {
      const custName = Array.isArray(r.customers) ? r.customers[0]?.full_name : r.customers?.full_name;
      const custPhone = Array.isArray(r.customers) ? r.customers[0]?.phone : r.customers?.phone;
      return (
        <>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.created_at), 'dd-MM-yy HH:mm')}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-indigo-700 truncate">{r.gift_name}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-zinc-800 truncate">{custName || 'Unknown'}</td>
          <td className="p-1.5 border-b border-zinc-300 font-mono text-zinc-600 bg-slate-50/50">{custPhone || '-'}</td>
        </>
      );
    }
    if (type === 'call_assignments') {
        const cust: any = Array.isArray(r.customers) ? r.customers[0] : r.customers;
        const v: any = Array.isArray(r.vouchers) ? r.vouchers[0] : r.vouchers;
        const isCompleted = r.status.toLowerCase() === 'completed';
        return (
          <>
            <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.created_at), 'dd-MM-yy HH:mm')}</td>
            <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-zinc-800 truncate">{cust?.full_name || 'Unknown'}</td>
            <td className="p-1.5 border-b border-r border-zinc-300 font-mono text-zinc-600">{cust?.phone || '-'}</td>
            <td className="p-1.5 border-b border-r border-zinc-300 text-center font-mono font-bold text-indigo-700">{v?.code || '-'}</td>
            <td className="p-1.5 border-b border-r border-zinc-300 text-center font-mono font-bold text-amber-600 bg-amber-50/20">{r.attempt_count || 0}</td>
            <td className="p-1.5 border-b border-zinc-300 bg-slate-50/50">
              <div className="flex flex-col">
                <span className={`text-[9px] font-bold uppercase tracking-widest ${isCompleted ? 'text-emerald-600' : 'text-amber-600'}`}>{r.status}</span>
                <span className="text-[10px] text-zinc-600 truncate">{r.call_outcome || r.interest_level || 'Awaiting Action'}</span>
              </div>
            </td>
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
        
        {/* Only show timeframe filters if the report relies on dates */}
        {type !== 'wallet_balances' && (
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
                <SelectItem value="7d">{isForwardLooking(type) ? 'Next 7 Days' : 'Last 7 Days'}</SelectItem>
                <SelectItem value="30d">{isForwardLooking(type) ? 'Next 30 Days' : 'Last 30 Days'}</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="pt-2 flex-1 flex flex-col min-h-0">
        
        <div className="border border-zinc-300 overflow-x-auto flex-1 custom-scrollbar bg-white">
          <table className="w-full border-collapse text-[10px] whitespace-nowrap">
            <thead className="sticky top-0 bg-zinc-100 shadow-[0_1px_0_#d4d4d8] font-bold text-zinc-700 uppercase">
              {renderHeaders()}
            </thead>
            <tbody>
              {paginatedRecords.map((r, i) => (
                <tr key={r.id || i} className="hover:bg-zinc-50/80 transition-colors">
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
// INDIVIDUAL EXPORTS (The 7 CRM Widgets)
// ============================================================================

export const CrmCustomerBaseWidget = () => <BaseCrmWidget type="customer_base" title="1) Customer Base & Lead Status" icon={Users} />
export const CrmUpcomingEventsWidget = () => <BaseCrmWidget type="upcoming_events" title="2) Upcoming Birthdays & Anniversaries" icon={CalendarHeart} />
export const CrmFollowupsDueWidget = () => <BaseCrmWidget type="followups_due" title="3) Scheduled Follow-ups Due" icon={PhoneCall} />
export const CrmWalletBalancesWidget = () => <BaseCrmWidget type="wallet_balances" title="4) Store Credit & Points Liability" icon={Wallet} />
export const CrmKittyPlansWidget = () => <BaseCrmWidget type="kitty_plans" title="5) Active Kitty Installment Plans" icon={ShieldCheck} />
export const CrmGiftingHistoryWidget = () => <BaseCrmWidget type="gifting_history" title="6) Customer Gifting History" icon={Gift} />
export const CrmWhatsAppSequencesWidget = () => <BaseCrmWidget type="whatsapp_sequences" title="7) WhatsApp Auto-Sequences (Vouchers)" icon={Send} />