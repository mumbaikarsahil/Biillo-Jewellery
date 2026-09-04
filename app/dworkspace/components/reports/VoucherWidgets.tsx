"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfMonth, startOfDay, endOfDay } from "date-fns";
import { Loader2, ArrowRight, ChevronLeft, ChevronRight, Ticket, Printer, Truck, HandCoins, BookOpen, AlertTriangle, CheckCircle2, Clock, Package, Landmark } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type VoucherReportType = 
  | "sales_booked"
  | "under_printing"
  | "payment_pending"
  | "delivery_pending"
  | "bookings"
  | "expired"
  | "redeemed"
  | "not_redeemed"
  | "in_stock"
  | "payment_received";

interface BaseProps {
  type: VoucherReportType;
  title: string;
  icon: any;
}

function BaseVoucherWidget({ type, title, icon: Icon }: BaseProps) {
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

        if (timeframe === "today") startDate = startOfDay(now);
        else if (timeframe === "yesterday") { startDate = startOfDay(subDays(now, 1)); endDate = endOfDay(subDays(now, 1)); }
        else if (timeframe === "7d") startDate = startOfDay(subDays(now, 7));
        else if (timeframe === "30d") startDate = startOfDay(subDays(now, 30));
        else if (timeframe === "month") startDate = startOfMonth(now);
        else if (timeframe === "custom") { startDate = startOfDay(new Date(customStart)); endDate = endOfDay(new Date(customEnd)); }

        const startISO = startDate.toISOString();
        const endISO = endDate.toISOString();
        const todayStr = now.toISOString().split('T')[0];

        let data: any[] = [];

        switch (type) {
            case "sales_booked":
                const [invRes, custRes] = await Promise.all([
                  supabase.from('invoices').select('created_at, invoice_number, voucher_code, voucher_discount, final_total, customers(full_name)').eq('company_id', appUser.company_id).not('voucher_code', 'is', null).gte('created_at', startISO).lte('created_at', endISO),
                  supabase.from('custom_orders').select('created_at, order_number, voucher_code, voucher_amount, voucher_discount, estimated_value, customers(full_name)').eq('company_id', appUser.company_id).not('voucher_code', 'is', null).gte('created_at', startISO).lte('created_at', endISO)
                ]);
                
                // ✨ FIXED: Added (i: any) and safe array unwrapping for customers
                const mappedInv = invRes.data?.map((i: any) => {
                  const custName = Array.isArray(i.customers) ? i.customers[0]?.full_name : i.customers?.full_name;
                  return { id: i.invoice_number, date: i.created_at, doc_type: 'Tax Invoice', doc_no: i.invoice_number, customer: custName, v_code: i.voucher_code, v_discount: i.voucher_discount, total: i.final_total };
                }) || [];
                
                // ✨ FIXED: Added (c: any) and safe array unwrapping for customers
                const mappedCust = custRes.data?.map((c: any) => {
                  const custName = Array.isArray(c.customers) ? c.customers[0]?.full_name : c.customers?.full_name;
                  return { id: c.order_number, date: c.created_at, doc_type: 'Custom Order', doc_no: c.order_number, customer: custName, v_code: c.voucher_code, v_discount: c.voucher_amount || c.voucher_discount, total: c.estimated_value };
                }) || [];
                
                data = [...mappedInv, ...mappedCust].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                break;

          case "under_printing":
            const { data: bData } = await supabase.from('voucher_batches').select('id, created_at, batch_no, printer_name, quantity, discount_value').eq('company_id', appUser.company_id).eq('status', 'generated').gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false });
            data = bData || [];
            break;

            case "payment_pending":
                case "delivery_pending":
                case "payment_received":
                  let distQuery = supabase.from('voucher_distributions').select('id, created_at, quantity, total_amount, payment_status, delivery_status, voucher_distributors(distributor_name)').eq('company_id', appUser.company_id).gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false });
                  if (type === 'payment_pending') distQuery = distQuery.eq('payment_status', 'pending');
                  if (type === 'delivery_pending') distQuery = distQuery.eq('delivery_status', 'pending');
                  if (type === 'payment_received') distQuery = distQuery.eq('payment_status', 'paid');
                  const { data: dData } = await distQuery;
                  
                  // ✨ FIXED: Unwrapping distributor arrays
                  data = dData?.map((d: any) => ({
                    ...d,
                    voucher_distributors: {
                      distributor_name: Array.isArray(d.voucher_distributors) ? d.voucher_distributors[0]?.distributor_name : d.voucher_distributors?.distributor_name
                    }
                  })) || [];
                  break;
      
                case "bookings":
                  const { data: bookData } = await supabase.from('voucher_bookings').select('id, created_at, booking_ref, requested_quantity, fulfilled_quantity, status, voucher_distributors(distributor_name)').eq('company_id', appUser.company_id).gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false });
                  
                  // ✨ FIXED: Unwrapping distributor arrays
                  data = bookData?.map((b: any) => ({
                    ...b,
                    voucher_distributors: {
                      distributor_name: Array.isArray(b.voucher_distributors) ? b.voucher_distributors[0]?.distributor_name : b.voucher_distributors?.distributor_name
                    }
                  })) || [];
                  break;

          case "expired":
          case "redeemed":
          case "not_redeemed":
          case "in_stock":
            let vQuery = supabase.from('vouchers').select('id, updated_at, code, discount_value, status, expiry_date').gte('updated_at', startISO).lte('updated_at', endISO).order('updated_at', { ascending: false });
            if (type === 'expired') vQuery = vQuery.lt('expiry_date', todayStr).neq('status', 'redeemed');
            if (type === 'redeemed') vQuery = vQuery.eq('status', 'redeemed');
            if (type === 'not_redeemed') vQuery = vQuery.neq('status', 'redeemed').gte('expiry_date', todayStr);
            if (type === 'in_stock') vQuery = vQuery.eq('status', 'in_stock');
            const { data: vData } = await vQuery;
            data = vData || [];
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

  // Column Renderer based on Type
  const renderHeaders = () => {
    if (type === 'sales_booked') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Date</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[100px]">Doc Type</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[120px]">Document No</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[130px]">Customer</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[110px]">Voucher</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[90px]">Discount (₹)</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[100px] bg-slate-50">Final Total (₹)</th>
      </tr>
    );
    if (type === 'under_printing') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Date Sent</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[120px]">Batch No</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[150px]">Printer Name</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[100px]">Qty Processing</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[100px]">Value Per Tag (₹)</th>
      </tr>
    );
    if (type === 'bookings') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Date</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[120px]">Booking Ref</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[150px]">Distributor</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[100px]">Status</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[90px]">Req Qty</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[90px] bg-emerald-50">Fulfilled Qty</th>
      </tr>
    );
    if (type === 'payment_pending' || type === 'delivery_pending' || type === 'payment_received') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Date</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[150px]">Distributor Name</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[100px]">Payment</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[100px]">Delivery</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[90px]">Qty Allocated</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[100px] bg-slate-50">Total Value (₹)</th>
      </tr>
    );
    // Lifecycle tables (Expired, Redeemed, etc)
    return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Last Updated</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[130px]">Voucher Code</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[110px]">Status</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[100px]">Expiry Date</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[100px]">Face Value (₹)</th>
      </tr>
    );
  };

  const renderRows = (r: any) => {
    if (type === 'sales_booked') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.date), 'dd-MM-yy HH:mm')}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-zinc-500">{r.doc_type}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 font-mono font-bold text-indigo-700">{r.doc_no}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800 truncate">{r.customer || 'Walk-in'}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-center font-mono font-bold text-teal-600">{r.v_code}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-rose-500">-{Number(r.v_discount).toLocaleString()}</td>
        <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-black text-zinc-900 bg-slate-50/50">{Number(r.total).toLocaleString()}</td>
      </>
    );
    if (type === 'under_printing') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.created_at), 'dd-MM-yy HH:mm')}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 font-mono font-bold text-indigo-700">{r.batch_no}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800 truncate">{r.printer_name || 'N/A'}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono font-bold text-zinc-900">{Number(r.quantity).toLocaleString()}</td>
        <td className="p-1.5 border-b border-zinc-300 text-right font-mono text-emerald-600">{Number(r.discount_value).toLocaleString()}</td>
      </>
    );
    if (type === 'bookings') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.created_at), 'dd-MM-yy HH:mm')}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 font-mono font-bold text-indigo-700">{r.booking_ref}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800 truncate">{r.voucher_distributors?.distributor_name || 'N/A'}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-center font-bold text-zinc-500 uppercase">{r.status.replace(/_/g,' ')}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-zinc-900">{Number(r.requested_quantity).toLocaleString()}</td>
        <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-bold text-emerald-700 bg-emerald-50/20">{Number(r.fulfilled_quantity).toLocaleString()}</td>
      </>
    );
    if (type === 'payment_pending' || type === 'delivery_pending' || type === 'payment_received') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.created_at), 'dd-MM-yy HH:mm')}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-zinc-800 truncate">{r.voucher_distributors?.distributor_name || 'N/A'}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-center font-bold text-zinc-500 uppercase">{r.payment_status}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-center font-bold text-zinc-500 uppercase">{r.delivery_status}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono font-bold text-indigo-700">{Number(r.quantity).toLocaleString()}</td>
        <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-bold text-zinc-900 bg-slate-50/50">{Number(r.total_amount).toLocaleString()}</td>
      </>
    );
    // Lifecycle tables
    return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.updated_at), 'dd-MM-yy HH:mm')}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-center font-mono font-bold text-indigo-700 uppercase">{r.code}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-center font-bold text-zinc-500 uppercase">{r.status.replace(/_/g,' ')}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-zinc-600">{r.expiry_date ? format(new Date(r.expiry_date), 'dd-MMM-yyyy') : 'No Expiry'}</td>
        <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-bold text-emerald-600">{Number(r.discount_value).toLocaleString()}</td>
      </>
    );
  };

  return (
    <div className="flex flex-col h-full w-full space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">{title}</h3>
          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 ml-2">
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
        <div className="flex justify-between items-end mb-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Transaction Ledger</p>
          {!isExpandedView && records.length > 5 && (
            <span className="text-[10px] font-bold text-indigo-600 flex items-center cursor-pointer hover:underline" onClick={() => setIsExpandedView(true)}>
              View All ({records.length}) <ArrowRight className="w-3 h-3 ml-1" />
            </span>
          )}
        </div>
        
        <div className="border border-zinc-300 overflow-x-auto flex-1 custom-scrollbar bg-white">
          <table className="w-full border-collapse text-[10px] whitespace-nowrap">
            <thead className="sticky top-0 bg-zinc-100 shadow-[0_1px_0_#d4d4d8] font-bold text-zinc-700 uppercase">
              {renderHeaders()}
            </thead>
            <tbody>
              {paginatedRecords.map((r) => (
                <tr key={r.id} className="hover:bg-indigo-50/30 transition-colors">
                  {renderRows(r)}
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-zinc-400 italic border-b border-zinc-300">No records found for this timeframe.</td>
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
      </div>
    </div>
  );
}

// ============================================================================
// INDIVIDUAL EXPORTS (The 10 Widgets you requested)
// ============================================================================

export const VoucherSalesBookedWidget = () => <BaseVoucherWidget type="sales_booked" title="1) Voucher Sales Booked" icon={Ticket} />
export const VoucherUnderPrintingWidget = () => <BaseVoucherWidget type="under_printing" title="2) Vouchers Under Printing" icon={Printer} />
export const VoucherPaymentPendingWidget = () => <BaseVoucherWidget type="payment_pending" title="3) Dist. Payment Pending" icon={Clock} />
export const VoucherDeliveryPendingWidget = () => <BaseVoucherWidget type="delivery_pending" title="4) Dist. Delivery Pending" icon={Truck} />
export const VoucherBookingsWidget = () => <BaseVoucherWidget type="bookings" title="5) Distributor Bookings & Fulfillments" icon={BookOpen} />
export const VoucherExpiredWidget = () => <BaseVoucherWidget type="expired" title="6) Expired Vouchers" icon={AlertTriangle} />
export const VoucherRedeemedWidget = () => <BaseVoucherWidget type="redeemed" title="7) Redeemed Vouchers" icon={CheckCircle2} />
export const VoucherNotRedeemedWidget = () => <BaseVoucherWidget type="not_redeemed" title="8) Active / Not Redeemed" icon={Ticket} />
export const VoucherInStockWidget = () => <BaseVoucherWidget type="in_stock" title="9) Vouchers in Stock (Vault)" icon={Package} />
export const VoucherPaymentReceivedWidget = () => <BaseVoucherWidget type="payment_received" title="10) Dist. Payments Received" icon={Landmark} />