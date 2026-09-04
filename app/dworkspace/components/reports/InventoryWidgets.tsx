"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfMonth, startOfDay, endOfDay, differenceInDays } from "date-fns";
import { 
  Loader2, ArrowRight, ChevronLeft, ChevronRight, PackageSearch, 
  AlertCircle, Clock, Send, Hourglass, Gem, Diamond, Target, 
  Gift, PackageOpen, LayoutList, Box
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type InventoryReportType = 
  | "in_stock"
  | "dead_stock"
  | "fast_moving"
  | "branch_restocks"
  | "dispatched_stores"
  | "pending_stores"
  | "karat_wise"
  | "diamond_wise"
  | "solitaire"
  | "price_buckets"
  | "gifting_stock"
  | "gifting_consumption"
  | "packaging_stock"
  | "packaging_consumption";

interface BaseProps {
  type: InventoryReportType;
  title: string;
  icon: any;
}

const isSnapshotReport = (type: InventoryReportType) => {
  return [
    "in_stock", "dead_stock", "karat_wise", "diamond_wise", "solitaire", 
    "price_buckets", "gifting_stock", "packaging_stock"
  ].includes(type);
};

const isComingSoon = (type: InventoryReportType) => {
  return [
    "dispatched_stores", "pending_stores", "gifting_consumption", "packaging_consumption"
  ].includes(type);
};

function BaseInventoryWidget({ type, title, icon: Icon }: BaseProps) {
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
    if (isComingSoon(type)) {
      setIsLoading(false);
      return;
    }
    if (!isSnapshotReport(type) && timeframe === "custom" && (!customStart || !customEnd)) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const now = new Date();
        let startDate = new Date();
        let endDate = endOfDay(now);

        if (!isSnapshotReport(type)) {
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
          case "in_stock":
          case "solitaire":
            let query = supabase.from('inventory_items').select('id, created_at, barcode, item_category, metal_type, purity_karat, gross_weight_g, mrp, is_solitaire, warehouses(name)').eq('company_id', appUser.company_id).eq('status', 'in_stock').order('created_at', { ascending: false });
            if (type === 'solitaire') query = query.eq('is_solitaire', true);
            const { data: stockData } = await query;
            data = stockData || [];
            break;

          case "dead_stock":
            const deadStockThreshold = subDays(now, 180).toISOString(); // Older than 6 months
            const { data: deadData } = await supabase.from('inventory_items').select('id, created_at, barcode, item_category, metal_type, purity_karat, gross_weight_g, mrp, warehouses(name)').eq('company_id', appUser.company_id).eq('status', 'in_stock').lt('created_at', deadStockThreshold).order('created_at', { ascending: true });
            data = deadData || [];
            break;

          case "fast_moving":
            // Items sold recently
            const { data: fastData } = await supabase.from('inventory_items').select('id, created_at, updated_at, barcode, item_category, mrp, warehouses(name)').eq('company_id', appUser.company_id).in('status', ['sold', 'sold_unbilled']).gte('updated_at', startISO).lte('updated_at', endISO).order('updated_at', { ascending: false });
            data = fastData?.map((item: any) => ({
              ...item,
              age_days: differenceInDays(new Date(item.updated_at), new Date(item.created_at))
            })) || [];
            break;

          case "branch_restocks":
            const { data: restockData } = await supabase.from('branch_restock_requests').select('id, created_at, sku_reference, quantity, required_by_date, status, remarks, warehouses(name)').eq('company_id', appUser.company_id).gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false });
            data = restockData || [];
            break;

          case "karat_wise":
            const { data: kwData } = await supabase.from('inventory_items').select('purity_karat, gross_weight_g, mrp').eq('company_id', appUser.company_id).eq('status', 'in_stock');
            const karatMap: Record<string, any> = {};
            kwData?.forEach(item => {
              const k = item.purity_karat || 'Unknown';
              if (!karatMap[k]) karatMap[k] = { karat: k, count: 0, weight: 0, mrp: 0 };
              karatMap[k].count += 1;
              karatMap[k].weight += Number(item.gross_weight_g) || 0;
              karatMap[k].mrp += Number(item.mrp) || 0;
            });
            data = Object.values(karatMap).sort((a: any, b: any) => b.count - a.count);
            break;

          case "diamond_wise":
            const { data: dwData } = await supabase.from('inventory_items').select('diamond_clarity, diamond_color, diamond_shape, total_stone_weight_cts, mrp').eq('company_id', appUser.company_id).eq('status', 'in_stock').gt('total_stone_weight_cts', 0);
            const diamondMap: Record<string, any> = {};
            dwData?.forEach(item => {
              const spec = `${item.diamond_shape || 'Mix'} | ${item.diamond_clarity || '-'} | ${item.diamond_color || '-'}`;
              if (!diamondMap[spec]) diamondMap[spec] = { spec, count: 0, cts: 0, mrp: 0 };
              diamondMap[spec].count += 1;
              diamondMap[spec].cts += Number(item.total_stone_weight_cts) || 0;
              diamondMap[spec].mrp += Number(item.mrp) || 0;
            });
            data = Object.values(diamondMap).sort((a: any, b: any) => b.count - a.count);
            break;

          case "price_buckets":
            const { data: pbData } = await supabase.from('inventory_items').select('mrp').eq('company_id', appUser.company_id).eq('status', 'in_stock');
            const buckets = {
              "Under ₹10k": { count: 0, mrp: 0 }, "₹10k - ₹20k": { count: 0, mrp: 0 },
              "₹20k - ₹30k": { count: 0, mrp: 0 }, "₹30k - ₹50k": { count: 0, mrp: 0 },
              "₹50k - ₹100k": { count: 0, mrp: 0 }, "Above ₹100k": { count: 0, mrp: 0 }
            };
            pbData?.forEach(item => {
              const v = Number(item.mrp) || 0;
              if (v < 10000) { buckets["Under ₹10k"].count++; buckets["Under ₹10k"].mrp += v; }
              else if (v < 20000) { buckets["₹10k - ₹20k"].count++; buckets["₹10k - ₹20k"].mrp += v; }
              else if (v < 30000) { buckets["₹20k - ₹30k"].count++; buckets["₹20k - ₹30k"].mrp += v; }
              else if (v < 50000) { buckets["₹30k - ₹50k"].count++; buckets["₹30k - ₹50k"].mrp += v; }
              else if (v < 100000) { buckets["₹50k - ₹100k"].count++; buckets["₹50k - ₹100k"].mrp += v; }
              else { buckets["Above ₹100k"].count++; buckets["Above ₹100k"].mrp += v; }
            });
            data = Object.entries(buckets).map(([k, v]) => ({ bucket: k, ...v })).filter(b => b.count > 0);
            break;

          case "gifting_stock":
            const { data: gData } = await supabase.from('gifting_inventory').select('id, last_updated, item_name, stock_count, warehouses(name)').eq('company_id', appUser.company_id).order('stock_count', { ascending: false });
            data = gData || [];
            break;

          case "packaging_stock":
            const { data: pData } = await supabase.from('packaging_inventory').select('id, last_updated, item_name, item_category, stock_count, reorder_level, warehouses(name)').eq('company_id', appUser.company_id).order('stock_count', { ascending: false });
            data = pData || [];
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

  const getWarehouseName = (w: any) => Array.isArray(w) ? w[0]?.name : w?.name;

  const renderHeaders = () => {
    if (isComingSoon(type)) return <tr><th></th></tr>;

    if (type === 'in_stock' || type === 'dead_stock' || type === 'solitaire') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Date Added</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[120px]">Barcode</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[130px]">Category / Specs</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[120px]">Location</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[90px]">Weight (g)</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[100px] bg-slate-50">MRP (₹)</th>
      </tr>
    );
    if (type === 'fast_moving') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Date Sold</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[120px]">Barcode</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[130px]">Category</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[120px]">Sold From</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[90px] bg-amber-50">Age (Days)</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[100px]">MRP (₹)</th>
      </tr>
    );
    if (type === 'branch_restocks') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Request Date</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[120px]">SKU / Design Ref</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[130px]">Requesting Branch</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Required By</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[90px]">Status</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[80px] bg-slate-50">Qty</th>
      </tr>
    );
    if (type === 'karat_wise') return (
      <tr>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[120px]">Purity Karat</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[100px]">Items Count</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[120px]">Total Gross Wt (g)</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[140px] bg-slate-50">Total MRP (₹)</th>
      </tr>
    );
    if (type === 'diamond_wise') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[180px]">Shape | Clarity | Color</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[100px]">Items Count</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[120px]">Total Diamond Cts</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[140px] bg-slate-50">Total MRP (₹)</th>
      </tr>
    );
    if (type === 'price_buckets') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[150px]">MRP Bucket Range</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[120px]">Items Count</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[140px] bg-slate-50">Total Value (₹)</th>
      </tr>
    );
    if (type === 'gifting_stock') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Last Updated</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[150px]">Item Name</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[130px]">Warehouse</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[100px] bg-indigo-50">Units in Stock</th>
      </tr>
    );
    if (type === 'packaging_stock') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Last Updated</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[150px]">Item / Box Type</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[130px]">Location</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[100px]">Category</th>
        <th className="p-1.5 text-right border-b border-r border-zinc-300 w-[100px]">Reorder Lvl</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[100px] bg-emerald-50">Units in Stock</th>
      </tr>
    );
    return null;
  };

  const renderRows = (r: any, idx: number) => {
    if (isComingSoon(type)) return null;

    if (type === 'in_stock' || type === 'dead_stock' || type === 'solitaire') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.created_at), 'dd-MM-yy')}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 font-mono font-bold text-indigo-700">{r.barcode}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800 truncate">{r.item_category} <span className="text-[9px] text-zinc-400">({r.purity_karat})</span></td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-700 truncate">{getWarehouseName(r.warehouses) || 'HQ'}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-zinc-600">{r.gross_weight_g}</td>
        <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-bold text-emerald-700 bg-slate-50/50">{Number(r.mrp).toLocaleString()}</td>
      </>
    );
    if (type === 'fast_moving') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 text-emerald-600 font-bold">{format(new Date(r.updated_at), 'dd-MM-yy')}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 font-mono font-bold text-indigo-700">{r.barcode}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800 truncate">{r.item_category}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-700 truncate">{getWarehouseName(r.warehouses) || 'HQ'}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-center font-mono font-bold text-amber-700 bg-amber-50/30">{r.age_days} Days</td>
        <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-bold text-zinc-900">{Number(r.mrp).toLocaleString()}</td>
      </>
    );
    if (type === 'branch_restocks') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.created_at), 'dd-MM-yy')}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 font-mono font-bold text-indigo-700">{r.sku_reference}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800 font-bold">{getWarehouseName(r.warehouses) || 'HQ'}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-rose-600 font-mono">{r.required_by_date ? format(new Date(r.required_by_date), 'dd-MMM-yyyy') : '-'}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-center font-bold text-zinc-500 uppercase text-[9px]">{r.status.replace(/_/g, ' ')}</td>
        <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-black text-indigo-700 bg-slate-50/50">{r.quantity}</td>
      </>
    );
    if (type === 'karat_wise') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 text-center font-bold text-amber-600">{r.karat}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-zinc-900">{r.count}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-zinc-600">{r.weight.toFixed(3)}</td>
        <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-bold text-emerald-700 bg-slate-50/50">{r.mrp.toLocaleString()}</td>
      </>
    );
    if (type === 'diamond_wise') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-indigo-600 uppercase">{r.spec}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-zinc-900">{r.count}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-zinc-600">{r.cts.toFixed(2)}</td>
        <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-bold text-emerald-700 bg-slate-50/50">{r.mrp.toLocaleString()}</td>
      </>
    );
    if (type === 'price_buckets') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-zinc-700">{r.bucket}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-zinc-900">{r.count}</td>
        <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-bold text-emerald-700 bg-slate-50/50">{r.mrp.toLocaleString()}</td>
      </>
    );
    if (type === 'gifting_stock') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.last_updated), 'dd-MM-yy')}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-indigo-700 truncate">{r.item_name}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800">{getWarehouseName(r.warehouses) || 'HQ'}</td>
        <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-black text-indigo-700 bg-indigo-50/50">{r.stock_count}</td>
      </>
    );
    if (type === 'packaging_stock') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.last_updated), 'dd-MM-yy')}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-teal-700 truncate">{r.item_name}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800">{getWarehouseName(r.warehouses) || 'HQ'}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-center text-zinc-500 uppercase text-[9px] font-bold">{r.item_category || 'General'}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-rose-500">{r.reorder_level}</td>
        <td className={`p-1.5 border-b border-zinc-300 text-right font-mono font-black bg-emerald-50/50 ${r.stock_count <= r.reorder_level ? 'text-rose-600 bg-rose-50' : 'text-emerald-700'}`}>{r.stock_count}</td>
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
          {!isComingSoon(type) && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 ml-2">
              {records.length} {['karat_wise', 'diamond_wise', 'price_buckets'].includes(type) ? 'Categories' : 'Records'}
            </span>
          )}
        </div>
        
        {/* Only show timeframe filters if the report is historical (not a real-time snapshot) */}
        {!isSnapshotReport(type) && !isComingSoon(type) && (
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
        )}
      </div>

      <div className="pt-2 flex-1 flex flex-col min-h-0">
        
        <div className="border border-zinc-300 overflow-x-auto flex-1 custom-scrollbar bg-white">
          <table className="w-full border-collapse text-[10px] whitespace-nowrap">
            <thead className="sticky top-0 bg-zinc-100 shadow-[0_1px_0_#d4d4d8] font-bold text-zinc-700 uppercase">
              {renderHeaders()}
            </thead>
            <tbody>
              {isComingSoon(type) ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-zinc-400 border-b border-zinc-300">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Clock className="w-6 h-6 text-zinc-300" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Module Coming Soon</span>
                      <p className="text-[9px] max-w-[200px] whitespace-normal leading-tight">This reporting module is currently under development and will be activated in the next update release.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {paginatedRecords.map((r, i) => (
                    <tr key={r.id || r.bucket || r.karat || r.spec || i} className="hover:bg-zinc-50/80 transition-colors">
                      {renderRows(r, i)}
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-4 text-center text-zinc-400 italic border-b border-zinc-300">No records found matching criteria.</td>
                    </tr>
                  )}
                </>
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
        
        {!isExpandedView && records.length > 5 && !isComingSoon(type) && (
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
// INDIVIDUAL EXPORTS (The 14 Inventory Widgets)
// ============================================================================

export const InvInStockWidget = () => <BaseInventoryWidget type="in_stock" title="1) Realtime Inventory in Stock" icon={PackageSearch} />
export const InvDeadStockWidget = () => <BaseInventoryWidget type="dead_stock" title="2) Realtime Dead Stock (>180 Days)" icon={AlertCircle} />
export const InvFastMovingWidget = () => <BaseInventoryWidget type="fast_moving" title="3) Fast Moving Inventory (FIFO Age)" icon={Clock} />
export const InvBranchRestocksWidget = () => <BaseInventoryWidget type="branch_restocks" title="4) Orders Received from Store" icon={Box} />
export const InvDispatchedStoresWidget = () => <BaseInventoryWidget type="dispatched_stores" title="5) Orders Dispatched to Stores" icon={Send} />
export const InvPendingStoresWidget = () => <BaseInventoryWidget type="pending_stores" title="6) Orders Pending to Stores" icon={Hourglass} />
export const InvKaratWiseWidget = () => <BaseInventoryWidget type="karat_wise" title="7) Stock Wise Report (Karat)" icon={LayoutList} />
export const InvDiamondWiseWidget = () => <BaseInventoryWidget type="diamond_wise" title="8) Stock Wise Report (Clarity/Color/Shape)" icon={Diamond} />
export const InvSolitaireWidget = () => <BaseInventoryWidget type="solitaire" title="9) Stock Wise Report (Solitaire)" icon={Gem} />
export const InvPriceBucketsWidget = () => <BaseInventoryWidget type="price_buckets" title="10) Stock Below 10k, 20k, 50k..." icon={Target} />
export const InvGiftingStockWidget = () => <BaseInventoryWidget type="gifting_stock" title="11) Gifting Stock" icon={Gift} />
export const InvGiftingConsumptionWidget = () => <BaseInventoryWidget type="gifting_consumption" title="12) Gifting Stock Consumption" icon={Gift} />
export const InvPackagingStockWidget = () => <BaseInventoryWidget type="packaging_stock" title="13) Packaging Stock" icon={PackageOpen} />
export const InvPackagingConsumptionWidget = () => <BaseInventoryWidget type="packaging_consumption" title="14) Packaging Stock Consumption" icon={PackageOpen} />