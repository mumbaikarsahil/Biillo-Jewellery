"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfMonth, startOfDay, endOfDay } from "date-fns";
import { 
  Loader2, ArrowRight, ChevronLeft, ChevronRight, Ticket, 
  Printer, Truck, HandCoins, BookOpen, AlertTriangle, 
  CheckCircle2, Clock, Package, Landmark, Trophy, 
  TrendingDown, Target, Building2, MapPin, Star, Filter,
  Download, Sparkles, BarChart3, Activity // ✨ NEW IMPORTS
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"; // ✨ NEW IMPORT

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
  overrideData?: any[];
}

// ============================================================================
// 1. GENERIC WIDGET (For the other 9 reports)
// ============================================================================
function BaseVoucherWidget({ type, title, icon: Icon, overrideData }: BaseProps) {
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
        const todayStr = now.toISOString().split('T')[0];

        let data: any[] = [];

        switch (type) {
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
            
            data = dData?.map((d: any) => ({
              ...d,
              voucher_distributors: {
                distributor_name: Array.isArray(d.voucher_distributors) ? d.voucher_distributors[0]?.distributor_name : d.voucher_distributors?.distributor_name
              }
            })) || [];
            break;
  
          case "bookings":
            const { data: bookData } = await supabase.from('voucher_bookings').select('id, created_at, booking_ref, requested_quantity, fulfilled_quantity, status, voucher_distributors(distributor_name)').eq('company_id', appUser.company_id).gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false });
            
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

  const renderHeaders = () => {
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
// 2. ADVANCED SALES BOOKED WIDGET (With Custom B2B Filters & Analytics)
// ============================================================================
function AdvancedSalesBookedWidget() {
  const { appUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  
  // Timeframe
  const [timeframe, setTimeframe] = useState("30d"); 
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Filters
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");
  
  const [selectedDistributor, setSelectedDistributor] = useState("all");
  const [selectedArea, setSelectedArea] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState("all");

  const [rawRecords, setRawRecords] = useState<any[]>([]);
  
  // ✨ NEW: AI Report Modal State
  const [showAiReport, setShowAiReport] = useState(false);

  // Pagination
  const [isExpandedView, setIsExpandedView] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // 1. Fetch initial master data
  useEffect(() => {
    if (!appUser?.company_id) return;
    const fetchMasters = async () => {
      const { data } = await supabase.from('warehouses').select('id, name').eq('company_id', appUser.company_id);
      if (data) setWarehouses(data);
    };
    fetchMasters();
  }, [appUser]);

  // 2. Fetch Sales Data based on Timeframe and Warehouse
  useEffect(() => {
    if (!appUser?.company_id) return;
    if (timeframe === "custom" && (!customStart || !customEnd)) return;

    const fetchSalesData = async () => {
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

        let invQuery = supabase.from('invoices').select('created_at, invoice_number, voucher_code, voucher_discount, final_total, customers(full_name)').eq('company_id', appUser.company_id).not('voucher_code', 'is', null).gte('created_at', startISO).lte('created_at', endISO);
        let custQuery = supabase.from('custom_orders').select('created_at, order_number, voucher_code, voucher_amount, voucher_discount, estimated_value, customers(full_name)').eq('company_id', appUser.company_id).not('voucher_code', 'is', null).gte('created_at', startISO).lte('created_at', endISO);
        
        if (selectedWarehouse !== 'all') {
           invQuery = invQuery.eq('warehouse_id', selectedWarehouse);
           custQuery = custQuery.eq('origin_warehouse_id', selectedWarehouse);
        }

        const [invRes, custRes] = await Promise.all([invQuery, custQuery]);
        
        const mappedInv = invRes.data?.map((i: any) => ({ 
          id: i.invoice_number, date: i.created_at, doc_type: 'Tax Invoice', doc_no: i.invoice_number, 
          customer: Array.isArray(i.customers) ? i.customers[0]?.full_name : i.customers?.full_name, 
          v_code: i.voucher_code, v_discount: i.voucher_discount, total: i.final_total 
        })) || [];
        
        const mappedCust = custRes.data?.map((c: any) => ({ 
          id: c.order_number, date: c.created_at, doc_type: 'Custom Order', doc_no: c.order_number, 
          customer: Array.isArray(c.customers) ? c.customers[0]?.full_name : c.customers?.full_name, 
          v_code: c.voucher_code, v_discount: c.voucher_amount || c.voucher_discount, total: c.estimated_value 
        })) || [];
        
        const combinedData = [...mappedInv, ...mappedCust];
        const uniqueVoucherCodes = Array.from(new Set(combinedData.map(d => d.v_code).filter(Boolean)));

        // 3. Fetch Distributor Details based on used Vouchers
        let distributorMap = new Map();
        if (uniqueVoucherCodes.length > 0) {
          const { data: vData } = await supabase
            .from('vouchers')
            .select('code, voucher_distributors(id, distributor_name, area_location, business_category, partner_level)')
            .in('code', uniqueVoucherCodes);
            
          if (vData) {
            vData.forEach((v: any) => {
               const dist = Array.isArray(v.voucher_distributors) ? v.voucher_distributors[0] : v.voucher_distributors;
               if (dist) distributorMap.set(v.code, dist);
            });
          }
        }

        // Attach distributor to rows
        const enrichedData = combinedData.map(d => ({
           ...d,
           distributor: distributorMap.get(d.v_code) || null
        })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setRawRecords(enrichedData);
        setPage(1); 
      } catch (err) {
        console.error(`Failed to fetch sales booked data:`, err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSalesData();
  }, [appUser, timeframe, customStart, customEnd, selectedWarehouse]);

  // 3. Apply Local Advanced Filters
  const filteredRecords = useMemo(() => {
    return rawRecords.filter(r => {
      const dist = r.distributor;
      if (!dist) return false; 
      
      if (selectedDistributor !== 'all' && dist.id !== selectedDistributor) return false;
      if (selectedArea !== 'all' && dist.area_location !== selectedArea) return false;
      if (selectedCategory !== 'all' && dist.business_category !== selectedCategory) return false;
      if (selectedLevel !== 'all' && dist.partner_level !== selectedLevel) return false;
      
      return true;
    });
  }, [rawRecords, selectedDistributor, selectedArea, selectedCategory, selectedLevel]);

  // ✨ 4. Calculate Detailed KPIs and Full Ranking based on currently filtered records
  const kpis = useMemo(() => {
    const distStats: Record<string, { id: string, name: string, totalSales: number, count: number, area: string, level: string }> = {};
    
    filteredRecords.forEach(r => {
       const distId = r.distributor.id;
       if (!distStats[distId]) {
         distStats[distId] = { 
           id: distId, 
           name: r.distributor.distributor_name, 
           totalSales: 0, 
           count: 0,
           area: r.distributor.area_location || 'N/A',
           level: r.distributor.partner_level || 'Standard'
         };
       }
       distStats[distId].totalSales += (Number(r.total) || 0);
       distStats[distId].count += 1;
    });

    // Create ranked array with AOV
    const rankedPartners = Object.values(distStats).map(s => ({
      ...s,
      aov: s.totalSales / s.count
    })).sort((a, b) => b.totalSales - a.totalSales); // Sort Descending by Total Sales

    if (rankedPartners.length === 0) return { top: null, low: null, bestAvg: null, rankedPartners: [] };

    // Highest Total Sales (Rank 1)
    const topPerformer = rankedPartners[0];
    
    // Lowest Total Sales (Last Rank)
    const lowPerformer = rankedPartners[rankedPartners.length - 1];
    
    // Highest Avg Order Value (Conversion Quality)
    const highestAov = [...rankedPartners].reduce((prev, curr) => (curr.aov > prev.aov ? curr : prev));

    return {
      top: topPerformer,
      low: lowPerformer,
      bestAvg: highestAov,
      rankedPartners
    };
  }, [filteredRecords]);

  // Extract unique dropdown options
  const uniqueDistributors = useMemo(() => Array.from(new Map(rawRecords.filter(r => r.distributor).map(r => [r.distributor.id, r.distributor.distributor_name])).entries()), [rawRecords]);
  const uniqueAreas = useMemo(() => Array.from(new Set(rawRecords.map(r => r.distributor?.area_location).filter(Boolean))), [rawRecords]);
  const uniqueCategories = useMemo(() => Array.from(new Set(rawRecords.map(r => r.distributor?.business_category).filter(Boolean))), [rawRecords]);
  const uniqueLevels = useMemo(() => Array.from(new Set(rawRecords.map(r => r.distributor?.partner_level).filter(Boolean))), [rawRecords]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize);
  const paginatedRecords = isExpandedView ? filteredRecords.slice((page - 1) * pageSize, page * pageSize) : filteredRecords.slice(0, 5); 

  // ✨ Export CSV Logic
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;
    
    const headers = [
      "Date", "Document Type", "Document No", "Customer", "Voucher Code", 
      "Partner Name", "Business Category", "Area/Location", "Partner Level", 
      "Discount Applied (Rs)", "Final Total (Rs)"
    ];
    
    const csvRows = filteredRecords.map(r => [
      format(new Date(r.date), 'yyyy-MM-dd HH:mm'),
      r.doc_type,
      r.doc_no,
      r.customer || 'Walk-in',
      r.v_code,
      r.distributor?.distributor_name || 'N/A',
      r.distributor?.business_category || 'N/A',
      r.distributor?.area_location || 'N/A',
      r.distributor?.partner_level || 'N/A',
      r.v_discount || 0,
      r.total || 0
    ]);

    const csvContent = [
      headers.join(","),
      ...csvRows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Voucher_Sales_Report_${format(new Date(), 'dd_MMM_yyyy')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ✨ Dynamic Grouping for the AI Report
  const totalPartners = kpis.rankedPartners.length;
  const topCount = Math.max(1, Math.ceil(totalPartners * 0.25)); 
  const lowCount = Math.max(1, Math.ceil(totalPartners * 0.25));

  const aiTopPerformers = kpis.rankedPartners.slice(0, topCount);
  const aiMidPerformers = totalPartners > 2 ? kpis.rankedPartners.slice(topCount, totalPartners - lowCount) : [];
  const aiLowPerformers = totalPartners > 1 ? kpis.rankedPartners.slice(totalPartners - lowCount) : [];

  return (
    <div className="flex flex-col h-full w-full space-y-4">
      {/* 1. Header & Controls */}
      <div className="flex flex-wrap justify-between items-center gap-3 border-b border-indigo-100 pb-3">
        <div className="flex items-center gap-2">
          <Ticket className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">Voucher Sales Booked</h3>
          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 ml-2">
            {filteredRecords.length} Conversions
          </span>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* ✨ NEW Export and AI Report Buttons */}
          <Button onClick={() => setShowAiReport(true)} disabled={filteredRecords.length === 0} variant="outline" size="sm" className="h-7 text-[10px] font-bold uppercase tracking-widest border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 shadow-sm">
            <Sparkles className="w-3 h-3 mr-1.5" /> AI Report
          </Button>
          <Button onClick={handleExportCSV} disabled={filteredRecords.length === 0} variant="outline" size="sm" className="h-7 text-[10px] font-bold uppercase tracking-widest shadow-sm">
            <Download className="w-3 h-3 mr-1.5" /> Export
          </Button>

          <div className="h-4 w-px bg-zinc-200 mx-1 hidden sm:block"></div>

          <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
            <SelectTrigger className="h-7 w-[140px] text-[11px] font-semibold bg-white border-zinc-300 rounded-sm">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {timeframe === 'custom' && (
            <div className="flex items-center gap-1">
              <Input type="date" className="h-7 text-[10px] py-0 px-2 w-[110px] border-zinc-300" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span className="text-zinc-400 text-[10px]">-</span>
              <Input type="date" className="h-7 text-[10px] py-0 px-2 w-[110px] border-zinc-300" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          )}
          
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="h-7 w-[120px] text-[11px] font-semibold bg-white border-zinc-300 rounded-sm">
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

      {/* 2. Analytical Advanced Filters */}
      <div className="flex flex-wrap gap-2 items-center bg-indigo-50/50 p-2 rounded-lg border border-indigo-100/50">
        <Filter className="w-3.5 h-3.5 text-indigo-400 ml-1" />
        
        <Select value={selectedDistributor} onValueChange={setSelectedDistributor}>
          <SelectTrigger className="h-7 w-[160px] text-[10px] font-medium bg-white border-zinc-200">
            <SelectValue placeholder="All Partners" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Partners</SelectItem>
            {uniqueDistributors.map(([id, name]) => <SelectItem key={id as string} value={id as string}>{name as string}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={selectedArea} onValueChange={setSelectedArea}>
          <SelectTrigger className="h-7 w-[130px] text-[10px] font-medium bg-white border-zinc-200">
            <MapPin className="w-3 h-3 mr-1.5 text-zinc-400" />
            <SelectValue placeholder="All Areas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Areas</SelectItem>
            {uniqueAreas.map(a => <SelectItem key={a as string} value={a as string}>{a as string}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="h-7 w-[150px] text-[10px] font-medium bg-white border-zinc-200">
            <Building2 className="w-3 h-3 mr-1.5 text-zinc-400" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {uniqueCategories.map(c => <SelectItem key={c as string} value={c as string}>{c as string}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={selectedLevel} onValueChange={setSelectedLevel}>
          <SelectTrigger className="h-7 w-[130px] text-[10px] font-medium bg-white border-zinc-200">
            <Star className="w-3 h-3 mr-1.5 text-zinc-400" />
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {uniqueLevels.map(l => <SelectItem key={l as string} value={l as string}>{l as string}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* 3. KPI Metrics Dashboard */}
      {!isLoading && filteredRecords.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex flex-col justify-center relative overflow-hidden group">
             <div className="absolute right-[-10px] top-[-10px] opacity-10 group-hover:opacity-20 transition-opacity"><Trophy className="w-16 h-16 text-emerald-600" /></div>
             <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-1.5 mb-1"><Trophy className="w-3.5 h-3.5"/> Top Revenue Partner</span>
             <span className="text-sm font-black text-emerald-900 truncate">{kpis.top?.name || '-'}</span>
             <span className="text-xs font-medium text-emerald-700 mt-0.5">₹{(kpis.top?.totalSales || 0).toLocaleString()} <span className="text-[9px] opacity-70 ml-1">({kpis.top?.count} Sales)</span></span>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex flex-col justify-center relative overflow-hidden group">
             <div className="absolute right-[-10px] top-[-10px] opacity-10 group-hover:opacity-20 transition-opacity"><Target className="w-16 h-16 text-amber-600" /></div>
             <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 flex items-center gap-1.5 mb-1"><Target className="w-3.5 h-3.5"/> Highest Avg Order Value</span>
             <span className="text-sm font-black text-amber-900 truncate">{kpis.bestAvg?.name || '-'}</span>
             <span className="text-xs font-medium text-amber-700 mt-0.5">₹{(kpis.bestAvg?.aov || 0).toLocaleString(undefined, {maximumFractionDigits:0})} <span className="text-[9px] opacity-70 ml-1">/ txn</span></span>
          </div>
          <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 flex flex-col justify-center relative overflow-hidden group">
             <div className="absolute right-[-10px] top-[-10px] opacity-10 group-hover:opacity-20 transition-opacity"><TrendingDown className="w-16 h-16 text-rose-600" /></div>
             <span className="text-[10px] font-bold uppercase tracking-widest text-rose-600 flex items-center gap-1.5 mb-1"><TrendingDown className="w-3.5 h-3.5"/> Lowest Revenue Partner</span>
             <span className="text-sm font-black text-rose-900 truncate">{kpis.low?.name || '-'}</span>
             <span className="text-xs font-medium text-rose-700 mt-0.5">₹{(kpis.low?.totalSales || 0).toLocaleString()} <span className="text-[9px] opacity-70 ml-1">({kpis.low?.count} Sales)</span></span>
          </div>
        </div>
      )}

      {/* 4. Data Ledger */}
      <div className="pt-2 flex-1 flex flex-col min-h-0">
        <div className="flex justify-between items-end mb-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Transaction Ledger</p>
          {!isExpandedView && filteredRecords.length > 5 && (
            <span className="text-[10px] font-bold text-indigo-600 flex items-center cursor-pointer hover:underline" onClick={() => setIsExpandedView(true)}>
              View All ({filteredRecords.length}) <ArrowRight className="w-3 h-3 ml-1" />
            </span>
          )}
        </div>
        
        <div className="border border-zinc-300 overflow-x-auto flex-1 custom-scrollbar bg-white">
          <table className="w-full border-collapse text-[10px] whitespace-nowrap">
            <thead className="sticky top-0 bg-zinc-100 shadow-[0_1px_0_#d4d4d8] font-bold text-zinc-700 uppercase">
              <tr>
                <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Date</th>
                <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[120px]">Document No</th>
                <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[130px]">Customer</th>
                <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[110px]">Voucher</th>
                <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[150px]">Distributor Partner</th>
                <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[90px]">Discount (₹)</th>
                <th className="p-1.5 text-right border-b border-zinc-300 w-[100px] bg-slate-50">Final Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-300" />
                    Processing analytics...
                  </td>
                </tr>
              ) : paginatedRecords.map((r) => (
                <tr key={r.id} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.date), 'dd-MM-yy HH:mm')}</td>
                  <td className="p-1.5 border-b border-r border-zinc-300 font-mono font-bold text-indigo-700">
                    {r.doc_no}
                    <span className="block text-[8px] text-zinc-400 font-sans tracking-widest">{r.doc_type}</span>
                  </td>
                  <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800 truncate">{r.customer || 'Walk-in'}</td>
                  <td className="p-1.5 border-b border-r border-zinc-300 text-center font-mono font-bold text-teal-600">{r.v_code}</td>
                  <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800">
                    <span className="font-bold">{r.distributor?.distributor_name || 'N/A'}</span>
                    {r.distributor && (
                      <span className="block text-[8px] text-zinc-500 uppercase tracking-widest mt-0.5 truncate">
                        {r.distributor.business_category} • {r.distributor.area_location} • Level: {r.distributor.partner_level}
                      </span>
                    )}
                  </td>
                  <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-rose-500">-{Number(r.v_discount).toLocaleString()}</td>
                  <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-black text-zinc-900 bg-slate-50/50">{Number(r.total).toLocaleString()}</td>
                </tr>
              ))}
              {!isLoading && filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-zinc-400 italic border-b border-zinc-300">No records found for these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {isExpandedView && totalPages > 1 && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-200">
            <span className="text-[10px] text-zinc-500 font-medium">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredRecords.length)} of {filteredRecords.length}
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

      {/* ✨ 5. AI PERFORMANCE REPORT DIALOG */}
      <Dialog open={showAiReport} onOpenChange={setShowAiReport}>
        <DialogContent className="sm:max-w-[700px] bg-white border-none shadow-2xl p-0 overflow-hidden flex flex-col max-h-[85vh]">
          <DialogHeader className="bg-indigo-50 p-5 border-b border-indigo-100 shrink-0 select-none">
            <DialogTitle className="flex items-center gap-2 text-indigo-800 text-lg font-bold">
              <Sparkles className="w-5 h-5 text-indigo-600" /> Partner Performance Rankings
            </DialogTitle>
            <DialogDescription className="text-xs text-indigo-600/70 mt-1.5 font-medium">
              Real-time stratification based on current dashboard filters. Ranks reflect Total Generated Revenue vs Average Conversion Order Value.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-50 space-y-6">
            
            {/* Top Performers (Top 25%) */}
            {aiTopPerformers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-black uppercase tracking-widest text-emerald-700">Top Performers (Driving Growth)</h4>
                </div>
                <div className="space-y-2">
                  {aiTopPerformers.map((p, idx) => (
                    <div key={p.id} className="bg-white border border-emerald-100 rounded-xl p-3 flex justify-between items-center shadow-sm relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                      <div className="pl-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">#{idx + 1} {p.name}</span>
                          <span className="text-[9px] bg-emerald-50 text-emerald-600 font-bold px-1.5 py-0.5 rounded border border-emerald-200">{p.level}</span>
                        </div>
                        <span className="text-[10px] text-gray-500 font-medium">{p.area} • {p.count} Conversions</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-emerald-700">₹{p.totalSales.toLocaleString()}</div>
                        <div className="text-[10px] text-gray-400 font-medium">AOV: ₹{p.aov.toLocaleString(undefined, {maximumFractionDigits:0})}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 italic px-2 font-medium">Action: Prioritize inventory allocation and exclusive incentive programs for this tier.</p>
              </div>
            )}

            {/* Core Contributors (Middle) */}
            {aiMidPerformers.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" />
                  <h4 className="text-xs font-black uppercase tracking-widest text-blue-600">Core Contributors (Steady Volume)</h4>
                </div>
                <div className="space-y-2">
                  {aiMidPerformers.map((p, idx) => (
                    <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-3 flex justify-between items-center shadow-sm">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">#{idx + 1 + topCount} {p.name}</span>
                          <span className="text-[9px] bg-gray-100 text-gray-600 font-bold px-1.5 py-0.5 rounded border border-gray-200">{p.level}</span>
                        </div>
                        <span className="text-[10px] text-gray-500 font-medium">{p.area} • {p.count} Conversions</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-blue-600">₹{p.totalSales.toLocaleString()}</div>
                        <div className="text-[10px] text-gray-400 font-medium">AOV: ₹{p.aov.toLocaleString(undefined, {maximumFractionDigits:0})}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 italic px-2 font-medium">Action: Target with volume-based promotions to elevate them into the Top Tier.</p>
              </div>
            )}

            {/* At-Risk / Low Performers (Bottom 25%) */}
            {aiLowPerformers.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <h4 className="text-xs font-black uppercase tracking-widest text-rose-600">Action Required (Low Volume)</h4>
                </div>
                <div className="space-y-2">
                  {aiLowPerformers.map((p, idx) => (
                    <div key={p.id} className="bg-white border border-rose-100 rounded-xl p-3 flex justify-between items-center shadow-sm">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">#{totalPartners - lowCount + idx + 1} {p.name}</span>
                          <span className="text-[9px] bg-rose-50 text-rose-600 font-bold px-1.5 py-0.5 rounded border border-rose-200">{p.level}</span>
                        </div>
                        <span className="text-[10px] text-gray-500 font-medium">{p.area} • {p.count} Conversions</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-rose-600">₹{p.totalSales.toLocaleString()}</div>
                        <div className="text-[10px] text-gray-400 font-medium">AOV: ₹{p.aov.toLocaleString(undefined, {maximumFractionDigits:0})}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 italic px-2 font-medium">Action: Review partnership engagement. Consider specialized follow-ups or offboarding.</p>
              </div>
            )}

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// INDIVIDUAL EXPORTS
// ============================================================================

export const VoucherSalesBookedWidget = ({ overrideData }: { overrideData?: any[] } = {}) => (<AdvancedSalesBookedWidget />);
export const VoucherUnderPrintingWidget = ({ overrideData }: { overrideData?: any[] } = {})=> ( <BaseVoucherWidget type="under_printing" title="2) Vouchers Under Printing" icon={Printer} overrideData={overrideData} />)
export const VoucherPaymentPendingWidget = ({ overrideData }: { overrideData?: any[] } = {})=> (<BaseVoucherWidget type="payment_pending" title="3) Dist. Payment Pending" icon={Clock} overrideData={overrideData} />)
export const VoucherDeliveryPendingWidget = ({ overrideData }: { overrideData?: any[] } = {})=> (<BaseVoucherWidget type="delivery_pending" title="4) Dist. Delivery Pending" icon={Truck} overrideData={overrideData} />)
export const VoucherBookingsWidget = ({ overrideData }: { overrideData?: any[] } = {})=> ( <BaseVoucherWidget type="bookings" title="5) Distributor Bookings & Fulfillments" icon={BookOpen} overrideData={overrideData} />)
export const VoucherExpiredWidget = ({ overrideData }: { overrideData?: any[] } = {})=> ( <BaseVoucherWidget type="expired" title="6) Expired Vouchers" icon={AlertTriangle} overrideData={overrideData} />)
export const VoucherRedeemedWidget = ({ overrideData }: { overrideData?: any[] } = {})=> (<BaseVoucherWidget type="redeemed" title="7) Redeemed Vouchers" icon={CheckCircle2} overrideData={overrideData} />)
export const VoucherNotRedeemedWidget = ({ overrideData }: { overrideData?: any[] } = {})=> ( <BaseVoucherWidget type="not_redeemed" title="8) Active / Not Redeemed" icon={Ticket} overrideData={overrideData} />)
export const VoucherInStockWidget = ({ overrideData }: { overrideData?: any[] } = {})=> ( <BaseVoucherWidget type="in_stock" title="9) Vouchers in Stock (Vault)" icon={Package} overrideData={overrideData} />)
export const VoucherPaymentReceivedWidget = ({ overrideData }: { overrideData?: any[] } = {})=> ( <BaseVoucherWidget type="payment_received" title="10) Dist. Payments Received" icon={Landmark} overrideData={overrideData} />)