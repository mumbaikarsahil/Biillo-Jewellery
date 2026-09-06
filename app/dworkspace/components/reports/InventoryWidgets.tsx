"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfMonth, startOfDay, endOfDay, differenceInDays } from "date-fns";
import { 
  Loader2, ArrowRight, ChevronLeft, ChevronRight, PackageSearch, 
  AlertCircle, Clock, Send, Hourglass, Gem, Diamond, Target, 
  Gift, PackageOpen, LayoutList, Box, Filter
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
  overrideData?: any[];
}

const isSnapshotReport = (type: InventoryReportType) => {
  return [
    "in_stock", "dead_stock", "karat_wise", "diamond_wise", "solitaire", 
    "price_buckets", "gifting_stock", "packaging_stock"
  ].includes(type);
};

const isComingSoon = (type: InventoryReportType) => {
  return [
    "dispatched_stores", "pending_stores", 
  ].includes(type);
};

export function BaseInventoryWidget({ type, title, icon: Icon, overrideData }: BaseProps) {
  const { appUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  
  // ✨ Advanced Filtering State
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [timeframe, setTimeframe] = useState("30d"); 
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [records, setRecords] = useState<any[]>([]);

  // Pagination State
  const [isExpandedView, setIsExpandedView] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // ✨ Fetch Available Warehouses and Categories once on mount
  useEffect(() => {

    if (overrideData) {
      setRecords(overrideData);
      setIsLoading(false);
      return;
    }

    if (!appUser?.company_id) return;
    
    // Fetch Warehouses
    supabase.from('warehouses').select('id, name').eq('company_id', appUser.company_id)
      .then(({ data }) => { if (data) setWarehouses(data); });

    // Fetch Distinct Categories
    supabase.from('inventory_items').select('item_category').eq('company_id', appUser.company_id).eq('status', 'in_stock')
      .then(({ data }) => {
        if (data) {
          const uniqueCats = Array.from(new Set(data.map((d: any) => d.item_category).filter(Boolean)));
          setCategories(uniqueCats as string[]);
        }
      });
  }, [appUser]);

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

        // ✨ Helper function to apply dropdown filters securely
        const applyFilters = (queryBuilder: any, categoryColumn: string | null = 'item_category') => {
          let q = queryBuilder;
          if (warehouseFilter !== "all") {
            q = q.eq('warehouse_id', warehouseFilter);
          }
          if (categoryColumn && categoryFilter !== "all") {
            q = q.eq(categoryColumn, categoryFilter);
          }
          return q;
        };

        let data: any[] = [];

        switch (type) {
          case "in_stock":
            case "solitaire":
              // ✨ FIXED: Removed is_solitaire, added solitaire_pieces and solitaire_weight_cts
              let isQuery = supabase.from('inventory_items')
                .select('id, created_at, barcode, item_category, metal_type, purity_karat, gross_weight_g, mrp, solitaire_pieces, solitaire_weight_cts, warehouses(name)')
                .eq('company_id', appUser.company_id)
                .eq('status', 'in_stock') 
                .order('created_at', { ascending: false });
              
              // ✨ FIXED: Check if pieces or weight are greater than 0
              if (type === 'solitaire') {
                isQuery = isQuery.or('solitaire_pieces.gt.0,solitaire_weight_cts.gt.0');
              }
              
              const { data: stockData } = await applyFilters(isQuery, 'item_category');
              data = stockData || [];
              break;

          case "dead_stock":
            const deadStockThreshold = subDays(now, 180).toISOString(); 
            let dsQuery = supabase.from('inventory_items')
              .select('id, created_at, barcode, item_category, metal_type, purity_karat, gross_weight_g, mrp, warehouses(name)')
              .eq('company_id', appUser.company_id)
              .eq('status', 'in_stock')
              .lt('created_at', deadStockThreshold)
              .order('created_at', { ascending: true });
            const { data: deadData } = await applyFilters(dsQuery, 'item_category');
            data = deadData || [];
            break;

          case "fast_moving":
            let fmQuery = supabase.from('inventory_items')
              .select('id, created_at, updated_at, barcode, item_category, mrp, warehouses(name)')
              .eq('company_id', appUser.company_id)
              .not('status', 'eq', 'in_stock') // Safer fallback for sold items
              .gte('updated_at', startISO)
              .lte('updated_at', endISO)
              .order('updated_at', { ascending: false });
              
            const { data: fastData } = await applyFilters(fmQuery, 'item_category');
            data = fastData?.map((item: any) => ({
              ...item,
              age_days: differenceInDays(new Date(item.updated_at), new Date(item.created_at))
            })) || [];
            break;

          case "branch_restocks":
            let brQuery = supabase.from('branch_restock_requests')
              .select('id, created_at, sku_reference, quantity, required_by_date, status, remarks, warehouses(name)')
              .eq('company_id', appUser.company_id)
              .gte('created_at', startISO)
              .lte('created_at', endISO)
              .order('created_at', { ascending: false });
            const { data: restockData } = await applyFilters(brQuery, null); 
            data = restockData || [];
            break;

          case "karat_wise":
            let kwQuery = supabase.from('inventory_items').select('purity_karat, gross_weight_g, mrp').eq('company_id', appUser.company_id).eq('status', 'in_stock');
            const { data: kwData } = await applyFilters(kwQuery, 'item_category');
            const karatMap: Record<string, any> = {};
            kwData?.forEach((item: any) => {
              const k = item.purity_karat || 'Unknown';
              if (!karatMap[k]) karatMap[k] = { karat: k, count: 0, weight: 0, mrp: 0 };
              karatMap[k].count += 1;
              karatMap[k].weight += Number(item.gross_weight_g) || 0;
              karatMap[k].mrp += Number(item.mrp) || 0;
            });
            data = Object.values(karatMap).sort((a: any, b: any) => b.count - a.count);
            break;

          case "diamond_wise":
            let dwQuery = supabase.from('inventory_items').select('diamond_clarity, diamond_color, diamond_shape, total_stone_weight_cts, mrp').eq('company_id', appUser.company_id).eq('status', 'in_stock').gt('total_stone_weight_cts', 0);
            const { data: dwData } = await applyFilters(dwQuery, 'item_category');
            const diamondMap: Record<string, any> = {};
            dwData?.forEach((item: any) => {
              const spec = `${item.diamond_shape || 'Mix'} | ${item.diamond_clarity || '-'} | ${item.diamond_color || '-'}`;
              if (!diamondMap[spec]) diamondMap[spec] = { spec, count: 0, cts: 0, mrp: 0 };
              diamondMap[spec].count += 1;
              diamondMap[spec].cts += Number(item.total_stone_weight_cts) || 0;
              diamondMap[spec].mrp += Number(item.mrp) || 0;
            });
            data = Object.values(diamondMap).sort((a: any, b: any) => b.count - a.count);
            break;

          case "price_buckets":
            let pbQuery = supabase.from('inventory_items').select('mrp').eq('company_id', appUser.company_id).eq('status', 'in_stock');
            const { data: pbData } = await applyFilters(pbQuery, 'item_category');
            const buckets = {
              "Under ₹10k": { count: 0, mrp: 0 }, "₹10k - ₹20k": { count: 0, mrp: 0 },
              "₹20k - ₹30k": { count: 0, mrp: 0 }, "₹30k - ₹50k": { count: 0, mrp: 0 },
              "₹50k - ₹100k": { count: 0, mrp: 0 }, "Above ₹100k": { count: 0, mrp: 0 }
            };
            pbData?.forEach((item: any) => {
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
            let gsQuery = supabase.from('gifting_inventory').select('id, last_updated, item_name, stock_count, warehouses(name)').eq('company_id', appUser.company_id).order('stock_count', { ascending: false });
            const { data: gData } = await applyFilters(gsQuery, null); // Skip general category filter
            data = gData || [];
            break;

          case "packaging_stock":
            let psQuery = supabase.from('packaging_inventory').select('id, last_updated, item_name, item_category, stock_count, reorder_level, warehouses(name)').eq('company_id', appUser.company_id).order('stock_count', { ascending: false });
            const { data: pData } = await applyFilters(psQuery, null); // Skip general category filter
            data = pData || [];
            break;

            case "packaging_consumption":
            let pcLogQuery = supabase.from('packaging_consumption_logs')
              .select(`
                id, created_at, quantity, transaction_type, reference_id, 
                packaging_inventory(item_name), 
                warehouses(name), 
                customers(full_name)
              `)
              .eq('company_id', appUser.company_id)
              .gte('created_at', startISO)
              .lte('created_at', endISO)
              .order('created_at', { ascending: false });
            
            // Apply warehouse filters (passing null for category since logs don't have categories)
            const { data: pcLogData } = await applyFilters(pcLogQuery, null); 
            data = pcLogData || [];
            break;

            case "gifting_consumption":
            let gcQuery = supabase.from('customer_gifts_history')
              .select(`
                id, created_at, gift_name, 
                warehouses(name), 
                customers(full_name, phone)
              `)
              .eq('company_id', appUser.company_id)
              .gte('created_at', startISO)
              .lte('created_at', endISO)
              .order('created_at', { ascending: false });
            
            // Apply warehouse filter. (Passing null for category since gifts just use gift_name)
            const { data: gcData } = await applyFilters(gcQuery, null); 
            data = gcData || [];
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
  }, [appUser, timeframe, customStart, customEnd, type, warehouseFilter, categoryFilter]);

  const totalPages = Math.ceil(records.length / pageSize);
  const paginatedRecords = isExpandedView ? records.slice((page - 1) * pageSize, page * pageSize) : records.slice(0, 5); 

  if (isLoading && records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full min-h-[200px] text-zinc-400">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Scanning Inventory...</span>
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

    if (type === 'packaging_consumption') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Date Consumed</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[140px]">Packaging Item</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[120px]">Location</th>
        <th className="p-1.5 text-center border-b border-r border-zinc-300 w-[100px]">Trans. Type</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[120px]">Ref / Invoice No</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[130px]">Customer</th>
        <th className="p-1.5 text-right border-b border-zinc-300 w-[80px] bg-rose-50">Qty Used</th>
      </tr>
    );

    if (type === 'gifting_consumption') return (
      <tr>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 w-[110px]">Date Given</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[150px]">Gift Item</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[130px]">Location</th>
        <th className="p-1.5 text-left border-b border-r border-zinc-300 min-w-[150px]">Customer Name</th>
        <th className="p-1.5 text-left border-b border-zinc-300 w-[120px] bg-slate-50">Phone Number</th>
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
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800 truncate">{r.item_category || 'N/A'} <span className="text-[9px] text-zinc-400">({r.purity_karat || '-'})</span></td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-700 truncate">{getWarehouseName(r.warehouses) || 'HQ'}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-right font-mono text-zinc-600">{r.gross_weight_g || 0}</td>
        <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-bold text-emerald-700 bg-slate-50/50">{Number(r.mrp || 0).toLocaleString()}</td>
      </>
    );
    if (type === 'fast_moving') return (
      <>
        <td className="p-1.5 border-b border-r border-zinc-300 text-emerald-600 font-bold">{format(new Date(r.updated_at), 'dd-MM-yy')}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 font-mono font-bold text-indigo-700">{r.barcode}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800 truncate">{r.item_category || 'N/A'}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-700 truncate">{getWarehouseName(r.warehouses) || 'HQ'}</td>
        <td className="p-1.5 border-b border-r border-zinc-300 text-center font-mono font-bold text-amber-700 bg-amber-50/30">{r.age_days} Days</td>
        <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-bold text-zinc-900">{Number(r.mrp || 0).toLocaleString()}</td>
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

    if (type === 'packaging_consumption') {
      const packName = Array.isArray(r.packaging_inventory) ? r.packaging_inventory[0]?.item_name : r.packaging_inventory?.item_name;
      const custName = Array.isArray(r.customers) ? r.customers[0]?.full_name : r.customers?.full_name;
      const transType = r.transaction_type === 'custom_order' ? 'Custom Order' : 'Normal Sale';
      
      return (
        <>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.created_at), 'dd-MM-yy HH:mm')}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-teal-700 truncate">{packName || 'Unknown Item'}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800">{getWarehouseName(r.warehouses) || 'HQ'}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-center font-bold text-zinc-500 uppercase text-[9px]">{transType}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 font-mono font-bold text-indigo-700">{r.reference_id}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-700 truncate">{custName || 'Walk-in'}</td>
          <td className="p-1.5 border-b border-zinc-300 text-right font-mono font-black text-rose-600 bg-rose-50/50">- {r.quantity}</td>
        </>
      );

      
    }

    if (type === 'gifting_consumption') {
      const custName = Array.isArray(r.customers) ? r.customers[0]?.full_name : r.customers?.full_name;
      const custPhone = Array.isArray(r.customers) ? r.customers[0]?.phone : r.customers?.phone;
      
      return (
        <>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-600">{format(new Date(r.created_at), 'dd-MM-yy HH:mm')}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-indigo-700 truncate">{r.gift_name}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 text-zinc-800">{getWarehouseName(r.warehouses) || 'HQ'}</td>
          <td className="p-1.5 border-b border-r border-zinc-300 font-bold text-zinc-800 truncate">{custName || 'Unknown'}</td>
          <td className="p-1.5 border-b border-zinc-300 font-mono text-zinc-600 bg-slate-50/50">{custPhone || '-'}</td>
        </>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-zinc-700" />
          <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">{title}</h3>
          {!isComingSoon(type) && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 ml-2">
              {records.length} {['karat_wise', 'diamond_wise', 'price_buckets'].includes(type) ? 'Categories' : 'Records'}
            </span>
          )}
        </div>
        
        {/* ✨ FIXED: Fully integrated Filter Bar (Warehouse, Category, Timeframe) */}
        <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
          
          {/* Warehouse Dropdown */}
          {!isComingSoon(type) && (
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger className="h-7 w-[130px] text-[11px] font-semibold bg-white border-zinc-300 rounded-sm">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {warehouses.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Category Dropdown (Replacing standard text search) */}
          {!isComingSoon(type) && !['branch_restocks', 'gifting_stock', 'packaging_stock'].includes(type) && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-7 w-[140px] text-[11px] font-semibold bg-white border-zinc-300 rounded-sm">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat, idx) => (
                  <SelectItem key={idx} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Timeframe Selectors (Only for Historical Reports) */}
          {!isSnapshotReport(type) && !isComingSoon(type) && (
            <>
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
            </>
          )}
        </div>
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
                      <td colSpan={10} className="p-4 text-center text-zinc-400 italic border-b border-zinc-300">No records found matching current filters.</td>
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

export const InvInStockWidget = ({ overrideData }: { overrideData?: any[] } = {}) => (
  <BaseInventoryWidget type="in_stock" title="1) Realtime Inventory in Stock" icon={PackageSearch} overrideData={overrideData} />
);

export const InvDeadStockWidget = ({ overrideData }: { overrideData?: any[] } = {}) => (
  <BaseInventoryWidget type="dead_stock" title="2) Realtime Dead Stock (>180 Days)" icon={AlertCircle} overrideData={overrideData} />
);

export const InvFastMovingWidget = ({ overrideData }: { overrideData?: any[] } = {}) => (
  <BaseInventoryWidget type="fast_moving" title="3) Fast Moving Inventory (FIFO Age)" icon={Clock} overrideData={overrideData} />
);

export const InvBranchRestocksWidget = ({ overrideData }: { overrideData?: any[] } = {}) => (
  <BaseInventoryWidget type="branch_restocks" title="4) Orders Received from Store" icon={Box} overrideData={overrideData} />
);

export const InvDispatchedStoresWidget = ({ overrideData }: { overrideData?: any[] } = {}) => (
  <BaseInventoryWidget type="dispatched_stores" title="5) Orders Dispatched to Stores" icon={Send} overrideData={overrideData} />
);

export const InvPendingStoresWidget = ({ overrideData }: { overrideData?: any[] } = {}) => (
  <BaseInventoryWidget type="pending_stores" title="6) Orders Pending to Stores" icon={Hourglass} overrideData={overrideData} />
);

export const InvKaratWiseWidget = ({ overrideData }: { overrideData?: any[] } = {}) => (
  <BaseInventoryWidget type="karat_wise" title="7) Stock Wise Report (Karat)" icon={LayoutList} overrideData={overrideData} />
);

export const InvDiamondWiseWidget = ({ overrideData }: { overrideData?: any[] } = {}) => (
  <BaseInventoryWidget type="diamond_wise" title="8) Stock Wise Report (Clarity/Color/Shape)" icon={Diamond} overrideData={overrideData} />
);

export const InvSolitaireWidget = ({ overrideData }: { overrideData?: any[] } = {}) => (
  <BaseInventoryWidget type="solitaire" title="9) Stock Wise Report (Solitaire)" icon={Gem} overrideData={overrideData} />
);

export const InvPriceBucketsWidget = ({ overrideData }: { overrideData?: any[] } = {}) => (
  <BaseInventoryWidget type="price_buckets" title="10) Stock Below 10k, 20k, 50k..." icon={Target} overrideData={overrideData} />
);

export const InvGiftingStockWidget = ({ overrideData }: { overrideData?: any[] } = {}) => (
  <BaseInventoryWidget type="gifting_stock" title="11) Gifting Stock" icon={Gift} overrideData={overrideData} />
);

export const InvGiftingConsumptionWidget = ({ overrideData }: { overrideData?: any[] } = {}) => (
  <BaseInventoryWidget type="gifting_consumption" title="12) Gifting Stock Consumption" icon={Gift} overrideData={overrideData} />
);

export const InvPackagingStockWidget = ({ overrideData }: { overrideData?: any[] } = {}) => (
  <BaseInventoryWidget type="packaging_stock" title="13) Packaging Stock" icon={PackageOpen} overrideData={overrideData} />
);

export const InvPackagingConsumptionWidget = ({ overrideData }: { overrideData?: any[] } = {}) => (
  <BaseInventoryWidget type="packaging_consumption" title="14) Packaging Stock Consumption" icon={PackageOpen} overrideData={overrideData} />
);