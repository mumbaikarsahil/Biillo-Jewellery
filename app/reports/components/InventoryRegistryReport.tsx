"use client"

import React, { useEffect, useState, useMemo } from 'react'
import { format } from 'date-fns'
import { 
  Download, Filter, Loader2, Package, Search, 
  RefreshCw, FileText, Store, Layers, TrendingDown, TrendingUp, AlertTriangle, Sparkles, IndianRupee, MapPin,
  CheckCircle2, Trophy, Target, PieChart, Gem, MessageCircle, Printer
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useStoreLocation } from '@/hooks/useStoreLocation' 
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow
} from '@/components/ui/table'
import { Label } from 'recharts'

const getPriceBracket = (price: number) => {
  if (price <= 25000) return 'Under ₹25k';
  if (price <= 50000) return '₹25k - ₹50k';
  if (price <= 100000) return '₹50k - ₹1L';
  if (price <= 300000) return '₹1L - ₹3L';
  if (price <= 500000) return '₹3L - ₹5L';
  return 'Premium (> ₹5L)';
};

const normalizeCategory = (cat?: string) => {
  if (!cat || !cat.trim()) return 'Uncategorized';
  return cat.trim().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

export function InventoryRegistryReport() {
  const { appUser } = useAuth()
  const { toast } = useToast()
  
  const { isHQ, isLocked, selectedLocation, setSelectedLocation } = useStoreLocation()

  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  
  const [showFilters, setShowFilters] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterMetal, setFilterMetal] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStone, setFilterStone] = useState('all') // ✨ NEW: Stone Profile Filter
  
  const [maxPrice, setMaxPrice] = useState(1000000)
  const [priceRange, setPriceRange] = useState<number[]>([0, 1000000])

  useEffect(() => {
    async function fetchWarehouses() {
      if (!appUser?.company_id) return
      const { data } = await supabase.from('warehouses')
        .select('id, name')
        .eq('company_id', appUser.company_id)
      if (data) setWarehouses(data)
    }
    fetchWarehouses()
  }, [appUser])

  const getWhName = (wId: string) => {
    return warehouses.find((w: any) => w.id === wId)?.name || 'Global / Unassigned'
  }

  const fetchData = async () => {
    if (!appUser?.company_id) return
    setLoading(true)

    try {
      let allItems: any[] = [];
      let isFetching = true;
      let step = 0;
      const limit = 1000;

      while (isFetching) {
        let query = supabase.from('inventory_items')
          .select(`id, barcode, item_category, metal_type, purity_karat, gross_weight_g, net_weight_g, total_stone_weight_cts, cost_total, mrp, status, created_at, warehouse_id, diamond_shape, diamond_color, diamond_clarity, solitaire_weight_cts, solitaire_pieces, melee_weight_cts, melee_pieces, warehouses(name)`)
          .eq('company_id', appUser.company_id)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true }) 
          .range(step * limit, (step + 1) * limit - 1)

        if (selectedLocation !== 'ALL') {
          query = query.eq('warehouse_id', selectedLocation)
        }

        const { data: chunkData, error } = await query

        if (error) throw error

        if (chunkData && chunkData.length > 0) {
          allItems = [...allItems, ...chunkData];
          step++;
          if (chunkData.length < limit) isFetching = false; 
        } else {
          isFetching = false;
        }
      }

      const uniqueItems = Array.from(new Map(allItems.map(item => [item.id, item])).values());
      setData(uniqueItems)
      
      if (uniqueItems.length > 0) {
        const highest = Math.max(...uniqueItems.map((d: any) => Number(d.mrp) || 0), 100000);
        setMaxPrice(highest);
        setPriceRange([0, highest]);
      }

    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    if (selectedLocation) fetchData() 
  }, [appUser, selectedLocation])

  const uniqueCategories = useMemo(() => Array.from(new Set(data.map((d: any) => normalizeCategory(d.item_category)))).filter(Boolean).sort(), [data]);
  const uniqueMetals = useMemo(() => Array.from(new Set(data.map((d: any) => d.metal_type || 'Unknown Metal'))).filter(Boolean).sort(), [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const cat = normalizeCategory(item.item_category); 
      const met = item.metal_type || 'Unknown Metal';
      const bar = item.barcode || '';
      const stat = item.status || 'unknown';

      if (search && !bar.toLowerCase().includes(search.toLowerCase()) && !cat.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus !== 'all' && stat !== filterStatus) return false;
      if (filterMetal !== 'all' && met !== filterMetal) return false;
      if (filterCategory !== 'all' && cat !== filterCategory) return false;
      
      // ✨ NEW: Stone Filter Logic
      if (filterStone === 'solitaire' && !(Number(item.solitaire_weight_cts) > 0)) return false;
      if (filterStone === 'melee' && !(Number(item.melee_weight_cts) > 0)) return false;
      if (filterStone === 'plain' && (Number(item.total_stone_weight_cts) > 0)) return false;

      const val = Number(item.mrp) || 0;
      if (val < priceRange[0] || val > priceRange[1]) return false;
      
      return true;
    });
  }, [data, search, filterStatus, filterMetal, filterCategory, filterStone, priceRange]); // ✨ Added filterStone dependency

  const metrics = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      totalItems: acc.totalItems + 1,
      totalGrossWt: acc.totalGrossWt + (Number(curr.gross_weight_g) || 0),
      totalNetWt: acc.totalNetWt + (Number(curr.net_weight_g) || 0),
      totalStoneWt: acc.totalStoneWt + (Number(curr.total_stone_weight_cts) || 0),
      totalValue: acc.totalValue + (Number(curr.mrp) || 0) 
    }), { totalItems: 0, totalGrossWt: 0, totalNetWt: 0, totalStoneWt: 0, totalValue: 0 })
  }, [filteredData]);

  const categorySummary = useMemo(() => {
    const summary: Record<string, { count: number, grossWt: number, netWt: number, stoneWt: number, value: number }> = {};
    filteredData.forEach(item => {
      const cat = normalizeCategory(item.item_category); 
      if (!summary[cat]) {
        summary[cat] = { count: 0, grossWt: 0, netWt: 0, stoneWt: 0, value: 0 };
      }
      summary[cat].count += 1;
      summary[cat].grossWt += (Number(item.gross_weight_g) || 0);
      summary[cat].netWt += (Number(item.net_weight_g) || 0);
      summary[cat].stoneWt += (Number(item.total_stone_weight_cts) || 0);
      summary[cat].value += (Number(item.mrp) || 0);
    });
    return Object.entries(summary).sort((a, b) => b[1].count - a[1].count);
  }, [filteredData]);

  const analytics = useMemo(() => {
    if (filteredData.length === 0) return null;

    const multiDimStats: Record<string, { 
      location: string, category: string, bracket: string, stock: number, sold: number, dead: number, valStock: number 
    }> = {};

    const categoryAgg: Record<string, { sold: number, stock: number }> = {};
    const bracketAgg: Record<string, { sold: number }> = {};
    
    data.forEach(item => {
      const cat = normalizeCategory(item.item_category); 
      const met = item.metal_type || 'Unknown Metal';
      const bar = item.barcode || '';

      if (search && !bar.toLowerCase().includes(search.toLowerCase()) && !cat.toLowerCase().includes(search.toLowerCase())) return;
      if (filterMetal !== 'all' && met !== filterMetal) return;
      if (filterCategory !== 'all' && cat !== filterCategory) return;
      if (filterStone === 'solitaire' && !(Number(item.solitaire_weight_cts) > 0)) return;
      if (filterStone === 'melee' && !(Number(item.melee_weight_cts) > 0)) return;
      if (filterStone === 'plain' && (Number(item.total_stone_weight_cts) > 0)) return;
      
      const price = Number(item.mrp) || 0;
      if (price < priceRange[0] || price > priceRange[1]) return;

      const loc = getWhName(item.warehouse_id); 
      const bracket = getPriceBracket(price);
      const matrixKey = `${loc}::${cat}::${bracket}`;

      if (!multiDimStats[matrixKey]) {
        multiDimStats[matrixKey] = { location: loc, category: cat, bracket: bracket, stock: 0, sold: 0, dead: 0, valStock: 0 };
      }
      if (!categoryAgg[cat]) categoryAgg[cat] = { sold: 0, stock: 0 };
      if (!bracketAgg[bracket]) bracketAgg[bracket] = { sold: 0 };
      
      if (item.status === 'in_stock') {
        multiDimStats[matrixKey].stock++;
        multiDimStats[matrixKey].valStock += price;
        categoryAgg[cat].stock++;
        
        const daysOld = (new Date().getTime() - new Date(item.created_at).getTime()) / (1000 * 3600 * 24);
        if (daysOld > 90) multiDimStats[matrixKey].dead++;
      } 
      else if (item.status === 'sold' || item.status === 'delivered') {
        multiDimStats[matrixKey].sold++;
        categoryAgg[cat].sold++;
        bracketAgg[bracket].sold++;
      }
    });

    const restockWarnings = [];
    const deadStockWarnings = [];

    for (const stats of Object.values(multiDimStats)) {
      if (stats.sold > stats.stock && stats.sold > 0) {
        restockWarnings.push({ ...stats, deficit: stats.sold - stats.stock });
      }
      if (stats.dead >= 2 && stats.sold === 0) { 
        deadStockWarnings.push({ ...stats, deadCount: stats.dead, lockedValue: stats.valStock });
      }
    }

    let bestCategory = { name: 'N/A', sold: 0 };
    let worstCategory = { name: 'N/A', sellThrough: 101, stock: 0 }; 
    let sweetSpot = { name: 'N/A', sold: 0 };

    for (const [catStr, stats] of Object.entries(categoryAgg)) {
      if (stats.sold > bestCategory.sold) {
        bestCategory = { name: catStr, sold: stats.sold };
      }
      
      const totalVolume = stats.sold + stats.stock;
      if (totalVolume >= 5 && stats.stock > 0) { 
        const str = (stats.sold / totalVolume) * 100;
        if (str < worstCategory.sellThrough) {
          worstCategory = { name: catStr, sellThrough: str, stock: stats.stock };
        }
      }
    }

    for (const [bracket, stats] of Object.entries(bracketAgg)) {
      if (stats.sold > sweetSpot.sold) {
        sweetSpot = { name: bracket, sold: stats.sold };
      }
    }

    return {
      restockWarnings: restockWarnings.sort((a, b) => b.deficit - a.deficit),
      deadStockWarnings: deadStockWarnings.sort((a, b) => b.lockedValue - a.lockedValue),
      marketIntel: { bestCategory, worstCategory: worstCategory.name !== 'N/A' ? worstCategory : null, sweetSpot }
    };
  }, [data, search, filterMetal, filterCategory, filterStone, priceRange, showAnalytics, warehouses]);


  const handleExport = () => {
    if (filteredData.length === 0) {
      toast({ title: "Empty Data", description: "No records to export.", variant: "destructive" })
      return
    }
    setExporting(true)

    const groupedData = filteredData.reduce((acc, item) => {
      const cat = normalizeCategory(item.item_category); 
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, any[]>);

    const locationStr = selectedLocation === 'ALL' ? 'All Locations' : getWhName(selectedLocation);
    const statusStr = filterStatus === 'all' ? 'All Statuses' : filterStatus.replace('_', ' ').toUpperCase();
    const catStr = filterCategory === 'all' ? 'All Categories' : filterCategory;
    const metalStr = filterMetal === 'all' ? 'All Metals' : filterMetal;
    const stoneStr = filterStone === 'all' ? 'All Stones' : filterStone.toUpperCase();
    const searchStr = search ? ` | Search: "${search}"` : '';
    const priceStr = ` | Retail: ₹${priceRange[0]} to ₹${priceRange[1]}`;

    let csvRows: string[] = [
      `"ASSET REGISTRY REPORT",,,,,,,,,,,,,`, 
      `"Generated On: ${format(new Date(), 'dd-MMM-yyyy hh:mm a')}",,,,,,,,,,,,,`,
      `"Filters Applied: Location - ${locationStr} | Status - ${statusStr} | Category - ${catStr} | Metal - ${metalStr} | Stone - ${stoneStr}${priceStr}${searchStr}",,,,,,,,,,,,,`,
      `,,,,,,,,,,,,,`, 
    ];

    const headers = [
      'Barcode', 'Category', 'Metal', 'Purity', 
      'Gross Wt (g)', 'Net Wt (g)', 'Total Stone Wt (cts)',
      'Diamond Specs', 'Solitaire (Cts / Pcs)', 'Melee (Cts / Pcs)',
      'Retail Value (₹)', 'Status', 'Location', 'Date Added'
    ];
    
    csvRows.push(headers.join(','));

    let grandTotalItems = 0;
    let grandTotalGross = 0;
    let grandTotalNet = 0;
    let grandTotalStone = 0;
    let grandTotalValue = 0;

    const categories = Object.keys(groupedData).sort();

    categories.forEach(cat => {
      const items = groupedData[cat];
      let catGross = 0;
      let catNet = 0;
      let catStone = 0;
      let catValue = 0;

      csvRows.push(`"--- ${cat.toUpperCase()} ---",,,,,,,,,,,,,`);

      items.forEach((d: any) => {
        const gross = Number(d.gross_weight_g) || 0;
        const net = Number(d.net_weight_g) || 0;
        const stone = Number(d.total_stone_weight_cts) || 0;
        const mrp = Number(d.mrp) || 0;

        catGross += gross;
        catNet += net;
        catStone += stone;
        catValue += mrp;

        grandTotalGross += gross;
        grandTotalNet += net;
        grandTotalStone += stone;
        grandTotalValue += mrp;
        grandTotalItems++;

        const diamondSpecs = [d.diamond_shape, d.diamond_color, d.diamond_clarity].filter(Boolean).join(' ') || '--';
        const solitaireStr = d.solitaire_weight_cts ? `${d.solitaire_weight_cts}ct / ${d.solitaire_pieces || 0}pcs` : '--';
        const meleeStr = d.melee_weight_cts ? `${d.melee_weight_cts}ct / ${d.melee_pieces || 0}pcs` : '--';

        const row = [
          `"${d.barcode || '--'}"`,
          `"${cat}"`,
          `"${d.metal_type || 'Unknown'}"`,
          `"${d.purity_karat || '--'}"`,
          `"${gross}"`,
          `"${net}"`,
          `"${stone}"`,
          `"${diamondSpecs}"`,
          `"${solitaireStr}"`,
          `"${meleeStr}"`,
          `"${mrp}"`,
          `"${(d.status || 'unknown').replace('_', ' ').toUpperCase()}"`,
          `"${getWhName(d.warehouse_id)}"`,
          `"${d.created_at ? format(new Date(d.created_at), 'dd-MMM-yyyy') : '--'}"`
        ];
        csvRows.push(row.join(','));
      });

      const catSummaryRow = [
        `"${cat} TOTAL: ${items.length} Items"`, 
        `""`, `""`, `""`, 
        `"${catGross.toFixed(3)}"`, 
        `"${catNet.toFixed(3)}"`, 
        `"${catStone.toFixed(2)}"`, 
        `""`, `""`, `""`, 
        `"${catValue.toFixed(2)}"`, 
        `""`, `""`, `""`  
      ];
      
      csvRows.push(catSummaryRow.join(','));
      csvRows.push(',,,,,,,,,,,,,'); 
    });

    const grandTotalRow = [
      `"GRAND TOTAL: ${grandTotalItems} Items"`,
      `""`, `""`, `""`,
      `"${grandTotalGross.toFixed(3)}"`,
      `"${grandTotalNet.toFixed(3)}"`,
      `"${grandTotalStone.toFixed(2)}"`,
      `""`, `""`, `""`, 
      `"${grandTotalValue.toFixed(2)}"`,
      `""`, `""`, `""`
    ];
    csvRows.push(grandTotalRow.join(','));

    let fileNameParts = ['Asset_Registry'];
    if (selectedLocation !== 'ALL') {
      fileNameParts.push(getWhName(selectedLocation).replace(/[^a-zA-Z0-9]/g, '_'));
    } else {
      fileNameParts.push('All_Locations');
    }
    if (filterStatus !== 'all') fileNameParts.push(filterStatus.toUpperCase());
    if (filterCategory !== 'all') fileNameParts.push(filterCategory.replace(/[^a-zA-Z0-9]/g, '_'));
    fileNameParts.push(format(new Date(), 'yyyyMMdd'));

    const dynamicFileName = fileNameParts.filter(Boolean).join('_').replace(/_+/g, '_') + '.csv';

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", dynamicFileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    setExporting(false)
    toast({ title: "Export Complete", description: `Saved as: ${dynamicFileName}` })
  }

  const handleSummaryExportCSV = () => {
    if (categorySummary.length === 0) return;

    const locationStr = selectedLocation === 'ALL' ? 'All Locations' : getWhName(selectedLocation);
    const headers = ['Category', 'Items Count', 'Total Gross (g)', 'Total Net (g)', 'Total Stone (cts)', 'Total Value (₹)'];
    
    let csvRows = [
      `"ASSET SUMMARY REPORT",,,,,`, 
      `"Location: ${locationStr}",,,,,`,
      `"Date: ${format(new Date(), 'dd-MMM-yyyy')}",,,,,`,
      `,,,,,`,
      headers.join(',')
    ];

    categorySummary.forEach(([cat, stats]) => {
      csvRows.push(`"${cat}","${stats.count}","${stats.grossWt.toFixed(3)}","${stats.netWt.toFixed(3)}","${stats.stoneWt.toFixed(2)}","${stats.value.toFixed(2)}"`);
    });

    csvRows.push(`,,,,,`);
    csvRows.push(`"GRAND TOTAL","${metrics.totalItems}","${metrics.totalGrossWt.toFixed(3)}","${metrics.totalNetWt.toFixed(3)}","${metrics.totalStoneWt.toFixed(2)}","${metrics.totalValue.toFixed(2)}"`);

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Category_Summary_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleWhatsAppSummary = () => {
    if (categorySummary.length === 0) {
      toast({ title: "Empty Data", description: "No records to share.", variant: "destructive" });
      return;
    }

    const locationStr = selectedLocation === 'ALL' ? 'All Locations' : getWhName(selectedLocation);
    let text = `*📊 ASSET REGISTRY SUMMARY*\n`;
    text += `*Location:* ${locationStr}\n`;
    text += `*Date:* ${format(new Date(), 'dd-MMM-yyyy hh:mm a')}\n\n`;

    let grandTotalItems = 0;
    let grandTotalValue = 0;

    categorySummary.forEach(([cat, stats]) => {
      text += `*${cat}*\n`;
      text += `📦 Items: ${stats.count}\n`;
      text += `⚖️ Gross: ${stats.grossWt.toFixed(3)}g | Net: ${stats.netWt.toFixed(3)}g\n`;
      if (stats.stoneWt > 0) text += `💎 Stone: ${stats.stoneWt.toFixed(2)} cts\n`;
      text += `💰 Value: ₹${stats.value.toLocaleString()}\n\n`;
      
      grandTotalItems += stats.count;
      grandTotalValue += stats.value;
    });

    text += `*===================*\n`;
    text += `*TOTAL ASSETS:* ${grandTotalItems}\n`;
    text += `*TOTAL VALUATION:* ₹${grandTotalValue.toLocaleString()}\n`;

    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  const getStatusBadge = (status: string) => {
    if (!status) return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-500 border border-zinc-200 uppercase tracking-widest">UNKNOWN</span>;
    switch (status) {
      case 'in_stock': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase tracking-widest">In Stock</span>
      case 'sold': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200 uppercase tracking-widest">Sold</span>
      case 'in_transit': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 uppercase tracking-widest">Transit</span>
      default: return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-500 border border-zinc-200 uppercase tracking-widest">{status.replace('_', ' ')}</span>
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            margin: 15mm 15mm 20mm 15mm;
            size: A4 portrait;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * { visibility: hidden; }
          #executive-pdf-report, #executive-pdf-report * {
            visibility: visible;
          }
          #executive-pdf-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: white !important;
            color: black !important;
          }
          tr, .prevent-break {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}} />

      <div className="space-y-5 animate-in fade-in duration-500 print:hidden">
        
        <div className="flex flex-col gap-3 bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm print:hidden">
          <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <Input 
                placeholder="Scan barcode or category..." 
                className="pl-9 h-9 text-xs rounded-lg bg-zinc-50 border-zinc-200 focus-visible:ring-indigo-400 font-medium text-zinc-800" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
            </div>
            
            <Button 
              variant={showFilters ? "default" : "outline"} 
              className={`h-9 px-4 text-xs font-bold rounded-lg transition-colors ${showFilters ? 'bg-zinc-900 text-white' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-100'}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-3.5 w-3.5 mr-1.5" /> Filters
            </Button>

            <Button 
              variant={showAnalytics ? "default" : "outline"} 
              className={`h-9 px-4 text-xs font-bold rounded-lg hidden sm:flex transition-all ${showAnalytics ? 'bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-600 shadow-md shadow-indigo-200' : 'border-indigo-200 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100'}`}
              onClick={() => setShowAnalytics(!showAnalytics)}
            >
              <Sparkles className={`h-3.5 w-3.5 mr-1.5 ${showAnalytics ? 'text-white' : 'text-indigo-500'}`} /> 
              Matrix Analytics
              <span className={`ml-2 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest font-black transition-colors ${showAnalytics ? 'bg-white/20 text-white' : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-sm'}`}>
                BETA
              </span>
            </Button>

            <div className="flex-1" />

            <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-zinc-200 shrink-0 hidden sm:flex text-zinc-600 hover:bg-zinc-100" onClick={fetchData}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={handleExport} disabled={exporting || loading} className="h-9 text-xs font-bold rounded-lg hidden sm:flex shrink-0 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 bg-white">
              {exporting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-2 h-3.5 w-3.5 text-emerald-500" />}
              Export CSV
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 pt-3 border-t border-zinc-100 animate-in slide-in-from-top-2 duration-200">
              
              <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={isLocked}>
                <SelectTrigger className="h-9 text-xs font-bold bg-zinc-50 border-zinc-200 rounded-lg focus:ring-0">
                  <Store className="w-3 h-3 mr-1.5 text-zinc-500" />
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-xl border-zinc-200">
                  {isHQ && <SelectItem value="ALL" className="text-xs font-medium text-indigo-600">All Locations</SelectItem>}
                  {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs font-medium">{w.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 text-xs font-bold bg-zinc-50 border-zinc-200 rounded-lg focus:ring-0">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-xl border-zinc-200">
                  <SelectItem value="all" className="text-xs font-medium">All Statuses</SelectItem>
                  <SelectItem value="in_stock" className="text-xs font-medium">In Stock</SelectItem>
                  <SelectItem value="sold" className="text-xs font-medium">Sold / Delivered</SelectItem>
                  <SelectItem value="in_transit" className="text-xs font-medium">In Transit</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-9 text-xs font-bold bg-zinc-50 border-zinc-200 rounded-lg focus:ring-0">
                  <Package className="w-3 h-3 mr-1.5 text-zinc-500" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-xl border-zinc-200">
                  <SelectItem value="all" className="text-xs font-medium text-indigo-600">All Categories</SelectItem>
                  {uniqueCategories.map(c => <SelectItem key={c} value={c} className="text-xs font-medium">{c}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterMetal} onValueChange={setFilterMetal}>
                <SelectTrigger className="h-9 text-xs font-bold bg-zinc-50 border-zinc-200 rounded-lg focus:ring-0">
                  <Layers className="w-3 h-3 mr-1.5 text-zinc-500" />
                  <SelectValue placeholder="Metal" />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-xl border-zinc-200">
                  <SelectItem value="all" className="text-xs font-medium">All Metals</SelectItem>
                  {uniqueMetals.map(m => <SelectItem key={m} value={m} className="text-xs font-medium">{m}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* ✨ NEW: Stone Profile Filter */}
              <Select value={filterStone} onValueChange={setFilterStone}>
                <SelectTrigger className="h-9 text-xs font-bold bg-zinc-50 border-zinc-200 rounded-lg focus:ring-0">
                  <Gem className="w-3 h-3 mr-1.5 text-zinc-500" />
                  <SelectValue placeholder="Stone Profile" />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-xl border-zinc-200">
                  <SelectItem value="all" className="text-xs font-medium">All Stones</SelectItem>
                  <SelectItem value="solitaire" className="text-xs font-medium font-bold text-blue-600">Has Solitaire</SelectItem>
                  <SelectItem value="melee" className="text-xs font-medium">Has Melee</SelectItem>
                  <SelectItem value="plain" className="text-xs font-medium text-zinc-500">Plain Metal</SelectItem>
                </SelectContent>
              </Select>

              <div className="col-span-2 md:col-span-3 xl:col-span-2 bg-zinc-50/50 p-2 rounded-lg border border-zinc-200">
                <div className="flex justify-between items-center mb-1.5">
                  <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                    <IndianRupee className="w-3 h-3"/> Retail Value Range
                  </Label>
                  <span className="text-[10px] font-black text-zinc-700 font-mono tracking-tighter">
                    ₹{(priceRange[0]/1000).toFixed(0)}k - ₹{(priceRange[1]/1000).toFixed(0)}k
                  </span>
                </div>
                <div className="px-2">
                  <Slider min={0} max={maxPrice} step={1000} value={priceRange} onValueChange={setPriceRange} />
                </div>
              </div>

              {/* ✨ Updated reset button logic to include filterStone */}
              {(filterStatus !== 'all' || filterCategory !== 'all' || filterMetal !== 'all' || filterStone !== 'all' || search) && (
                <Button variant="ghost" className="h-9 text-xs font-bold text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => {
                  setSearch(''); setFilterStatus('all'); setFilterCategory('all'); setFilterMetal('all'); setFilterStone('all'); setPriceRange([0, maxPrice]);
                }}>
                  Reset Filters
                </Button>
              )}
            </div>
          )}
        </div>

        {/* SMART MULTI-DIMENSIONAL ANALYTICS PANEL */}
        {showAnalytics && analytics && (
          <div className="flex flex-col gap-4 animate-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-emerald-50 border-emerald-100 shadow-sm rounded-xl">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center shrink-0 border border-emerald-200 shadow-sm">
                     <Trophy className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Top Performer</p>
                    <p className="text-xl font-black text-emerald-900 leading-tight mt-0.5">{analytics.marketIntel.bestCategory.name}</p>
                    <p className="text-[10px] font-medium text-emerald-700 mt-1">Driving highest sales volume ({analytics.marketIntel.bestCategory.sold} units)</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-blue-50 border-blue-100 shadow-sm rounded-xl">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0 border border-blue-200 shadow-sm">
                     <Target className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Price Sweet Spot</p>
                    <p className="text-xl font-black text-blue-900 leading-tight mt-0.5">{analytics.marketIntel.sweetSpot.name}</p>
                    <p className="text-[10px] font-medium text-blue-700 mt-1">Optimal conversion bracket</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-rose-50 border-rose-100 shadow-sm rounded-xl">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-12 w-12 bg-rose-100 rounded-full flex items-center justify-center shrink-0 border border-rose-200 shadow-sm">
                     <TrendingDown className="w-6 h-6 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">Underperformer</p>
                    <p className="text-xl font-black text-rose-900 leading-tight mt-0.5">
                      {analytics.marketIntel.worstCategory ? analytics.marketIntel.worstCategory.name : 'Data Insufficient'}
                    </p>
                    <p className="text-[10px] font-medium text-rose-700 mt-1">
                      {analytics.marketIntel.worstCategory ? `Only ${analytics.marketIntel.worstCategory.sellThrough.toFixed(1)}% sell-through rate` : 'Need more sales data'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-indigo-50 border-indigo-100 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="p-4 pb-2 border-b border-indigo-100/50 bg-indigo-100/30">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-800 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-indigo-600" /> Restock Matrix Alerts
                    </CardTitle>
                    <Badge className="bg-indigo-600 hover:bg-indigo-600 text-[9px]">{analytics.restockWarnings.length} Alerts</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {analytics.restockWarnings.length === 0 ? (
                    <div className="text-center py-6">
                      <CheckCircle2 className="w-8 h-8 text-indigo-300 mx-auto mb-2" />
                      <p className="text-xs font-medium text-indigo-600/70">No severe localized deficits detected.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar pr-2">
                      {analytics.restockWarnings.map((w, i) => (
                        <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-3 rounded-xl border border-indigo-100 shadow-sm gap-3">
                          <div className="w-full sm:w-auto">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                              <p className="text-xs font-bold text-indigo-900">{w.location} <span className="text-indigo-300 mx-1">|</span> {w.category}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200 text-[9px] uppercase tracking-widest font-bold">
                                {w.bracket}
                              </Badge>
                              <p className="text-[10px] font-semibold text-indigo-500">Only {w.stock} left vs {w.sold} sold</p>
                            </div>
                          </div>
                          <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200 shadow-none font-bold text-[10px] uppercase tracking-widest w-full sm:w-auto justify-center">
                            Urgent Deficit: -{w.deficit}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-amber-50 border-amber-100 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="p-4 pb-2 border-b border-amber-100/50 bg-amber-100/30">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-amber-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" /> Dead Stock Matrix (less than 90 Days)
                    </CardTitle>
                    <Badge className="bg-amber-500 hover:bg-amber-500 text-[9px]">{analytics.deadStockWarnings.length} Alerts</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {analytics.deadStockWarnings.length === 0 ? (
                    <div className="text-center py-6">
                      <CheckCircle2 className="w-8 h-8 text-amber-300 mx-auto mb-2" />
                      <p className="text-xs font-medium text-amber-600/70">No severe dead stock traps detected.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar pr-2">
                      {analytics.deadStockWarnings.map((w, i) => (
                        <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-3 rounded-xl border border-amber-100 shadow-sm gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <Store className="w-3.5 h-3.5 text-amber-500" />
                              <p className="text-xs font-bold text-amber-900">{w.location} <span className="text-amber-300 mx-1">|</span> {w.category}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200 text-[9px] uppercase tracking-widest font-bold">
                                {w.bracket}
                              </Badge>
                              <p className="text-[10px] font-semibold text-amber-600">{w.deadCount} aged items, ZERO sales</p>
                            </div>
                          </div>
                          <div className="text-left sm:text-right bg-amber-50/50 p-2 rounded-lg border border-amber-100/50 w-full sm:w-auto">
                            <p className="text-[8px] font-bold text-amber-500 uppercase tracking-widest">Locked Capital</p>
                            <p className="text-sm font-black text-amber-700">₹{w.valStock.toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-zinc-400" /> Filtered Assets
              </p>
              {loading ? <Skeleton className="h-8 w-20 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">{metrics.totalItems}</p>}
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[11px] font-medium text-zinc-500 mb-1">Gross Weight</p>
              {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">{metrics.totalGrossWt.toFixed(2)}<span className="text-sm font-medium text-zinc-400 ml-1 tracking-normal">g</span></p>}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[11px] font-medium text-zinc-500 mb-1">Net Weight</p>
              {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">{metrics.totalNetWt.toFixed(2)}<span className="text-sm font-medium text-zinc-400 ml-1 tracking-normal">g</span></p>}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-zinc-200 bg-zinc-50 rounded-2xl">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">Filtered Valuation</p>
              {loading ? <Skeleton className="h-8 w-32 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">₹{metrics.totalValue.toLocaleString()}</p>}
            </CardContent>
          </Card>
        </div>

        {categorySummary.length > 0 && !loading && (
          <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden">
            <CardHeader className="p-4 pb-2 border-b border-zinc-100/50 bg-zinc-50/50">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-800 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-zinc-500" /> 
                  Category Breakdown
                </CardTitle>
                
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleWhatsAppSummary}
                    className="h-8 text-[10px] font-bold text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                  >
                    <MessageCircle className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">WhatsApp</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSummaryExportCSV}
                    className="h-8 text-[10px] font-bold text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100"
                  >
                    <FileText className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Export CSV</span>
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={() => window.print()}
                    className="h-8 text-[10px] font-bold bg-zinc-900 text-white hover:bg-zinc-800 shadow-md shadow-zinc-200"
                  >
                    <Printer className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">PDF Report</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto custom-scrollbar max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-zinc-50/90 sticky top-0 z-10 shadow-sm">
                    <TableRow className="hover:bg-transparent border-zinc-200">
                      <TableHead className="h-9 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-4">Category</TableHead>
                      <TableHead className="h-9 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider text-right">Items Count</TableHead>
                      <TableHead className="h-9 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider text-right">Total Gross</TableHead>
                      <TableHead className="h-9 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider text-right">Total Net</TableHead>
                      <TableHead className="h-9 text-[10px] font-semibold text-blue-500 uppercase tracking-wider text-right">Total Stone (cts)</TableHead>
                      <TableHead className="h-9 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider text-right pr-4">Total Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categorySummary.map(([cat, stats]) => (
                      <TableRow key={cat} className="hover:bg-zinc-50/50 border-zinc-100">
                        <TableCell className="px-4 py-2.5 text-xs font-bold text-zinc-800">{cat}</TableCell>
                        <TableCell className="text-right py-2.5 text-xs font-semibold text-zinc-600">{stats.count}</TableCell>
                        <TableCell className="text-right py-2.5 text-xs font-semibold text-zinc-600">{stats.grossWt.toFixed(3)}g</TableCell>
                        <TableCell className="text-right py-2.5 text-xs font-semibold text-zinc-600">{stats.netWt.toFixed(3)}g</TableCell>
                        <TableCell className="text-right py-2.5 text-xs font-bold text-blue-600">{stats.stoneWt.toFixed(2)}cts</TableCell>
                        <TableCell className="text-right py-2.5 pr-4 text-xs font-bold text-indigo-600">₹{stats.value.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* DATA VIEW */}
        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden">
          <div className="block sm:hidden divide-y divide-zinc-100">
            {loading ? (
               Array.from({ length: 5 }).map((_, i) => (
                 <div key={i} className="p-4 space-y-3">
                   <div className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-16" /></div>
                   <div className="flex gap-4"><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-16" /></div>
                 </div>
               ))
            ) : filteredData.length === 0 ? (
              <div className="py-12 text-center text-zinc-400">
                <Package className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-semibold tracking-tight">No assets match criteria</p>
              </div>
            ) : (
              filteredData.map((item) => (
                <div key={item.id} className="p-4 hover:bg-zinc-50 transition-colors">
                  <div className="flex justify-between items-start mb-2.5">
                    <div>
                      <div className="font-mono text-[13px] font-bold text-zinc-900 tracking-tight">{item.barcode || '--'}</div>
                      <div className="text-[11px] font-medium text-zinc-500 mt-0.5 flex items-center gap-1.5">
                        {normalizeCategory(item.item_category)} 
                        <span className="w-1 h-1 rounded-full bg-zinc-300" />
                        {getWhName(item.warehouse_id)}
                      </div>
                    </div>
                    <div>{getStatusBadge(item.status)}</div>
                  </div>
                  
                  <div className="flex justify-between items-end mt-3 pt-3 border-t border-zinc-100/80">
                    <div className="flex gap-4">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Specs</p>
                        <p className="text-xs font-semibold text-zinc-800">{item.metal_type || '--'} <span className="text-[10px] text-zinc-500 font-medium">{item.purity_karat || ''}</span></p>
                        {(item.diamond_shape || item.diamond_color || item.diamond_clarity) && (
                          <p className="text-[9px] text-blue-500 font-bold mt-1 uppercase tracking-wider">
                             {[item.diamond_shape, item.diamond_color, item.diamond_clarity].filter(Boolean).join(' • ')}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Weight</p>
                        <p className="text-xs font-semibold text-zinc-800">{item.gross_weight_g || 0}g <span className="text-[10px] text-zinc-500 font-medium">({item.net_weight_g || 0}g N)</span></p>
                        
                        <p className="text-[10px] text-blue-600 font-medium mt-0.5 flex flex-col gap-0.5">
                          <span className="flex items-center gap-1"><Gem className="w-3 h-3"/> {item.total_stone_weight_cts || 0} cts</span>
                          {(item.solitaire_weight_cts > 0 || item.melee_weight_cts > 0) && (
                             <span className="text-[9px] text-zinc-400 whitespace-nowrap">
                               {item.solitaire_weight_cts > 0 && `Sol: ${item.solitaire_weight_cts}ct `}
                               {item.melee_weight_cts > 0 && `Mel: ${item.melee_weight_cts}ct`}
                             </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Retail Price</p>
                      <p className="text-sm font-bold text-indigo-600 tracking-tight">₹{item.mrp?.toLocaleString() || '0'}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden sm:block overflow-x-auto max-h-[700px] custom-scrollbar">
            <Table>
              <TableHeader className="bg-zinc-50/90 sticky top-0 backdrop-blur-sm z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <TableRow className="hover:bg-transparent border-zinc-200">
                  <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4">Identifier</TableHead>
                  <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Specs</TableHead>
                  <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right">Gross</TableHead>
                  <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right">Net</TableHead>
                  <TableHead className="h-11 text-[11px] font-semibold text-blue-500 uppercase tracking-wider text-right">Stone (cts)</TableHead>
                  <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-center">Status</TableHead>
                  <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Node / Vault</TableHead>
                  <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right pr-6">Retail MRP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i} className="border-zinc-100">
                      <TableCell className="px-4 py-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-16 mt-1.5" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /><Skeleton className="h-3 w-12 mt-1.5" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-5 w-16 mx-auto rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="pr-6"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-60 text-center text-zinc-400 bg-zinc-50/50">
                      <Package className="h-8 w-8 mx-auto mb-3 opacity-30" />
                      <p className="text-sm font-semibold tracking-tight">No assets match active filters</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item) => (
                    <TableRow key={item.id} className="hover:bg-zinc-50/50 transition-colors border-zinc-100">
                      <TableCell className="px-4 py-2.5 sm:py-3">
                        <div className="font-mono text-xs sm:text-[13px] font-bold text-zinc-900 tracking-tight">{item.barcode || '--'}</div>
                        <div className="text-[10px] text-zinc-400 font-medium mt-0.5 uppercase tracking-widest">{normalizeCategory(item.item_category)}</div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-xs font-bold text-zinc-700">{item.metal_type || '--'}</div>
                        <div className="text-[10px] text-zinc-500 font-medium mt-0.5">{item.purity_karat || '--'}</div>
                        {(item.diamond_shape || item.diamond_color || item.diamond_clarity) && (
                          <div className="text-[9px] text-blue-500 font-bold mt-1 uppercase tracking-wider">
                             {[item.diamond_shape, item.diamond_color, item.diamond_clarity].filter(Boolean).join(' • ')}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="text-right text-[13px] font-semibold text-zinc-800">{item.gross_weight_g || 0}<span className="text-[10px] text-zinc-400 ml-0.5 font-medium">g</span></TableCell>
                      <TableCell className="text-right text-[13px] font-semibold text-zinc-500">{item.net_weight_g || 0}<span className="text-[10px] text-zinc-400 ml-0.5 font-medium">g</span></TableCell>
                      
                      <TableCell className="text-right">
                        <div className="text-[13px] font-bold text-blue-600">{item.total_stone_weight_cts || 0}<span className="text-[10px] text-blue-400 ml-0.5 font-medium">cts</span></div>
                        {(item.solitaire_weight_cts > 0 || item.melee_weight_cts > 0) && (
                           <div className="text-[9px] text-zinc-400 font-medium mt-0.5 whitespace-nowrap">
                             {item.solitaire_weight_cts > 0 && `Sol: ${item.solitaire_weight_cts}ct `}
                             {item.melee_weight_cts > 0 && `Mel: ${item.melee_weight_cts}ct`}
                           </div>
                        )}
                      </TableCell>

                      <TableCell className="text-center">{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-xs text-zinc-500 font-semibold">{getWhName(item.warehouse_id)}</TableCell>
                      <TableCell className="text-right text-[13px] font-bold text-indigo-700 pr-6">₹{item.mrp?.toLocaleString() || '0'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

        </Card>
      </div>

      {/* ✨ EXECUTIVE PDF REPORT (HIDDEN ON SCREEN, VISIBLE ON PRINT) ✨ */}
      <div id="executive-pdf-report" className="hidden print:block w-full font-sans bg-white pb-10">
        
        {/* REPORT HEADER */}
        <div className="flex justify-between items-end border-b-[3px] border-black pb-4 mb-6">
          <div>
            <h2 className="text-xl font-bold tracking-widest uppercase text-gray-500 mb-1">Pavitram Jewels</h2>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-black">Asset Registry</h1>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold uppercase tracking-widest text-gray-800 bg-gray-100 px-3 py-1 rounded inline-block">
              {selectedLocation === 'ALL' ? 'GLOBAL INVENTORY' : getWhName(selectedLocation).toUpperCase()}
            </p>
            <p className="text-xs font-semibold text-gray-500 mt-2 uppercase tracking-widest">
              Generated: {format(new Date(), 'dd MMM yyyy • hh:mm a')}
            </p>
          </div>
        </div>

        {/* FINANCIAL KPI GRID */}
        <div className="grid grid-cols-4 border-2 border-black rounded-xl overflow-hidden mb-8 prevent-break">
          <div className="p-4 bg-white border-r-2 border-gray-200">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Total Assets</p>
            <p className="text-3xl font-black text-black">{metrics.totalItems}</p>
          </div>
          <div className="p-4 bg-white border-r-2 border-gray-200">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Gross Weight</p>
            <p className="text-3xl font-black text-black">{metrics.totalGrossWt.toFixed(3)}<span className="text-lg text-gray-400 font-bold ml-1">g</span></p>
          </div>
          <div className="p-4 bg-white border-r-2 border-gray-200">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Net Weight</p>
            <p className="text-3xl font-black text-black">{metrics.totalNetWt.toFixed(3)}<span className="text-lg text-gray-400 font-bold ml-1">g</span></p>
          </div>
          <div className="p-4 bg-black text-white">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Total Valuation</p>
            <p className="text-3xl font-black tracking-tight">₹{metrics.totalValue.toLocaleString()}</p>
          </div>
        </div>

        {/* AI MARKET INTELLIGENCE */}
        {analytics && (
          <div className="mb-8 prevent-break">
            <h3 className="text-sm font-black uppercase tracking-widest text-black mb-3 border-b-2 border-gray-200 pb-2">Market Intelligence</h3>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Top Volume Mover</p>
                <p className="text-xl font-bold text-black">{analytics.marketIntel.bestCategory.name}</p>
                <p className="text-xs font-semibold text-gray-500 mt-0.5">{analytics.marketIntel.bestCategory.sold} units sold</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Price Sweet Spot</p>
                <p className="text-xl font-bold text-black">{analytics.marketIntel.sweetSpot.name}</p>
                <p className="text-xs font-semibold text-gray-500 mt-0.5">Highest bracket conversion</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Underperformer</p>
                <p className="text-xl font-bold text-black">{analytics.marketIntel.worstCategory?.name || 'N/A'}</p>
                <p className="text-xs font-semibold text-gray-500 mt-0.5">
                  {analytics.marketIntel.worstCategory ? `${analytics.marketIntel.worstCategory.sellThrough.toFixed(1)}% sell-through rate` : 'Data insufficient'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CATEGORY VALUATION BREAKDOWN */}
        <div className="mt-8">
          <h3 className="text-sm font-black uppercase tracking-widest text-black mb-3">Category Breakdown</h3>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-y-2 border-black text-black">
                <th className="py-2.5 px-3 text-[10px] font-black uppercase tracking-widest">Category</th>
                <th className="py-2.5 px-3 text-[10px] font-black uppercase tracking-widest text-center">Items</th>
                <th className="py-2.5 px-3 text-[10px] font-black uppercase tracking-widest text-right">Gross (g)</th>
                <th className="py-2.5 px-3 text-[10px] font-black uppercase tracking-widest text-right">Net (g)</th>
                <th className="py-2.5 px-3 text-[10px] font-black uppercase tracking-widest text-right">Stone (cts)</th>
                <th className="py-2.5 px-3 text-[10px] font-black uppercase tracking-widest text-right">Value (₹)</th>
              </tr>
            </thead>
            <tbody className="text-black">
              {categorySummary.map(([cat, stats], idx) => (
                <tr key={cat} className="border-b border-gray-200">
                  <td className="py-2.5 px-3 text-sm font-bold">{cat}</td>
                  <td className="py-2.5 px-3 text-sm text-center font-medium">{stats.count}</td>
                  <td className="py-2.5 px-3 text-sm text-right font-medium">{stats.grossWt.toFixed(3)}</td>
                  <td className="py-2.5 px-3 text-sm text-right font-medium">{stats.netWt.toFixed(3)}</td>
                  <td className="py-2.5 px-3 text-sm text-right font-medium">{stats.stoneWt.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-sm text-right font-bold">₹{stats.value.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-y-2 border-black text-black bg-gray-50 prevent-break">
                <td className="py-3 px-3 text-[11px] font-black uppercase tracking-widest">Grand Total</td>
                <td className="py-3 px-3 text-sm text-center font-black">{metrics.totalItems}</td>
                <td className="py-3 px-3 text-sm text-right font-black">{metrics.totalGrossWt.toFixed(3)}</td>
                <td className="py-3 px-3 text-sm text-right font-black">{metrics.totalNetWt.toFixed(3)}</td>
                <td className="py-3 px-3 text-sm text-right font-black">{metrics.totalStoneWt.toFixed(2)}</td>
                <td className="py-3 px-3 text-sm text-right font-black">₹{metrics.totalValue.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>
    </>
  )
}