"use client"

import React, { useEffect, useState, useMemo } from 'react'
import { format } from 'date-fns'
import { 
  Download, Filter, Loader2, Package, Search, 
  RefreshCw, FileText, Store, Layers, TrendingDown, TrendingUp, AlertTriangle, Sparkles, IndianRupee, MapPin,
  CheckCircle2, Trophy, Target
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
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

// --- AI HELPER: DYNAMIC PRICE BRACKETING ---
const getPriceBracket = (price: number) => {
  if (price <= 25000) return 'Under ₹25k';
  if (price <= 50000) return '₹25k - ₹50k';
  if (price <= 100000) return '₹50k - ₹1L';
  if (price <= 300000) return '₹1L - ₹3L';
  if (price <= 500000) return '₹3L - ₹5L';
  return 'Premium (> ₹5L)';
};

export function InventoryRegistryReport() {
  const { appUser } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  
  const [showFilters, setShowFilters] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [filterWarehouse, setFilterWarehouse] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterMetal, setFilterMetal] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  
  // Price Range Filter
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

  // --- HELPER: LOCAL WAREHOUSE NAME FINDER ---
  const getWhName = (wId: string) => {
    return warehouses.find((w: any) => w.id === wId)?.name || 'Global / Unassigned'
  }

  // --- BULLETPROOF DATA ENGINE ---
  // --- BULLETPROOF DATA ENGINE ---
  const fetchData = async () => {
    if (!appUser?.company_id) return
    setLoading(true)

    try {
      let allItems: any[] = [];
      let isFetching = true;
      let step = 0;
      const limit = 1000;

      // Loop to bypass API limits and get 100% of the data
      while (isFetching) {
        let query = supabase.from('inventory_items')
          .select(`id, barcode, item_category, metal_type, purity_karat, gross_weight_g, net_weight_g, cost_total, mrp, status, created_at, warehouse_id, warehouses(name)`)
          .eq('company_id', appUser.company_id)
          // FIX 1: Add secondary sort by 'id' to prevent pagination duplicates on bulk-imported items
          .order('created_at', { ascending: false })
          .order('id', { ascending: true }) 
          .range(step * limit, (step + 1) * limit - 1)

        if (filterWarehouse !== 'all') {
          query = query.eq('warehouse_id', filterWarehouse)
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

      // FIX 2: Final frontend safety net to strip any accidental duplicates
      const uniqueItems = Array.from(new Map(allItems.map(item => [item.id, item])).values());

      setData(uniqueItems)
      
      if (uniqueItems.length > 0) {
        const highest = Math.max(...uniqueItems.map(d => Number(d.mrp) || 0), 100000);
        setMaxPrice(highest);
        setPriceRange([0, highest]);
      }

    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // Re-fetch whenever the warehouse changes, just like InventoryPage
  useEffect(() => { fetchData() }, [appUser, filterWarehouse])

  // --- 1. DYNAMIC FILTER EXTRACTION ---
  const uniqueCategories = useMemo(() => Array.from(new Set(data.map(d => d.item_category || 'Uncategorized'))).filter(Boolean).sort(), [data]);
  const uniqueMetals = useMemo(() => Array.from(new Set(data.map(d => d.metal_type || 'Unknown Metal'))).filter(Boolean).sort(), [data]);

  // --- 2. LOCAL FILTERING ENGINE FOR THE TABLE ---
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const cat = item.item_category || 'Uncategorized';
      const met = item.metal_type || 'Unknown Metal';
      const bar = item.barcode || '';
      const stat = item.status || 'unknown';

      if (search && !bar.toLowerCase().includes(search.toLowerCase()) && !cat.toLowerCase().includes(search.toLowerCase())) return false;
      // Note: filterWarehouse is handled by the database now, so we removed it from here.
      if (filterStatus !== 'all' && stat !== filterStatus) return false;
      if (filterMetal !== 'all' && met !== filterMetal) return false;
      if (filterCategory !== 'all' && cat !== filterCategory) return false;
      
      const val = Number(item.mrp) || 0;
      if (val < priceRange[0] || val > priceRange[1]) return false;
      
      return true;
    });
  }, [data, search, filterStatus, filterMetal, filterCategory, priceRange]);

  // --- 3. METRICS ---
  const metrics = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      totalItems: acc.totalItems + 1,
      totalGrossWt: acc.totalGrossWt + (Number(curr.gross_weight_g) || 0),
      totalNetWt: acc.totalNetWt + (Number(curr.net_weight_g) || 0),
      totalValue: acc.totalValue + (Number(curr.mrp) || 0) 
    }), { totalItems: 0, totalGrossWt: 0, totalNetWt: 0, totalValue: 0 })
  }, [filteredData]);

  // --- 4. SMART ANALYTICS ENGINE ---
  const analytics = useMemo(() => {
    if (!showAnalytics) return null;

    const multiDimStats: Record<string, { 
      location: string, 
      category: string, 
      bracket: string, 
      stock: number, 
      sold: number, 
      dead: number, 
      valStock: number 
    }> = {};

    const categoryAgg: Record<string, { sold: number, stock: number }> = {};
    const bracketAgg: Record<string, { sold: number }> = {};
    
    data.forEach(item => {
      const cat = item.item_category || 'Uncategorized';
      const met = item.metal_type || 'Unknown Metal';
      const bar = item.barcode || '';

      if (search && !bar.toLowerCase().includes(search.toLowerCase()) && !cat.toLowerCase().includes(search.toLowerCase())) return;
      if (filterMetal !== 'all' && met !== filterMetal) return;
      if (filterCategory !== 'all' && cat !== filterCategory) return;
      
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
      marketIntel: {
        bestCategory,
        worstCategory: worstCategory.name !== 'N/A' ? worstCategory : null,
        sweetSpot
      }
    };
  }, [data, search, filterMetal, filterCategory, priceRange, showAnalytics, warehouses]);


  const handleExport = () => {
    if (filteredData.length === 0) {
      toast({ title: "Empty Data", description: "No records to export.", variant: "destructive" })
      return
    }
    setExporting(true)

    const formattedData = filteredData.map((d) => ({
      'Barcode': d.barcode || '--',
      'Category': d.item_category || 'Uncategorized',
      'Metal': d.metal_type || 'Unknown',
      'Purity': d.purity_karat || '--',
      'Gross Wt (g)': d.gross_weight_g || 0,
      'Net Wt (g)': d.net_weight_g || 0,
      'Retail Value (₹)': d.mrp || 0,
      'Status': (d.status || 'unknown').replace('_', ' ').toUpperCase(),
      'Location': getWhName(d.warehouse_id),
      'Date Added': d.created_at ? format(new Date(d.created_at), 'dd-MMM-yyyy') : '--'
    }))

    const headers = Object.keys(formattedData[0])
    
    // 1. Map regular data rows
    const dataRows = formattedData.map(row => headers.map(h => `"${(row as any)[h] || ''}"`).join(','))
    
    // 2. Create a "Totals" row aligned with the specific columns
    const totalsRow = [
      `"TOTAL: ${metrics.totalItems} Items"`, // Under Barcode
      `""`,                                   // Under Category
      `""`,                                   // Under Metal
      `""`,                                   // Under Purity
      `"${metrics.totalGrossWt.toFixed(3)}"`, // Under Gross Wt (g)
      `"${metrics.totalNetWt.toFixed(3)}"`,   // Under Net Wt (g)
      `"${metrics.totalValue.toFixed(2)}"`,   // Under Retail Value (₹)
      `""`,                                   // Under Status
      `""`,                                   // Under Location
      `""`                                    // Under Date Added
    ].join(',')

    // 3. Assemble CSV: Headers -> Data -> Empty Spacer Row -> Totals Row
    const csvContent = [
      headers.join(','),
      ...dataRows,
      ',,,,,,,,,', // Empty row to create visual separation in Excel
      totalsRow
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `Asset_Registry_${format(new Date(), 'yyyyMMdd')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    setExporting(false)
    toast({ title: "Export Complete", description: "Asset Registry downloaded." })
  }

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
    <div className="space-y-5 animate-in fade-in duration-500">
      
      {/* MAIN TOOLBAR & FILTERS */}
      <div className="flex flex-col gap-3 bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm print:hidden">
        
        {/* Top Row: Persistent Search & Actions */}
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

        {/* Collapsible Advanced Filters */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-3 border-t border-zinc-100 animate-in slide-in-from-top-2 duration-200">
            
            <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
              <SelectTrigger className="h-9 text-xs font-bold bg-zinc-50 border-zinc-200 rounded-lg focus:ring-0">
                <Store className="w-3 h-3 mr-1.5 text-zinc-500" />
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl border-zinc-200">
                <SelectItem value="all" className="text-xs font-medium">All Locations</SelectItem>
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

            {/* Dual Range Slider for Valuation */}
            <div className="col-span-2 md:col-span-4 lg:col-span-2 bg-zinc-50/50 p-2 rounded-lg border border-zinc-200">
              <div className="flex justify-between items-center mb-1.5">
                <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                  <IndianRupee className="w-3 h-3"/> Retail Value Range
                </Label>
                <span className="text-[10px] font-black text-zinc-700 font-mono tracking-tighter">
                  ₹{(priceRange[0]/1000).toFixed(0)}k - ₹{(priceRange[1]/1000).toFixed(0)}k
                </span>
              </div>
              <div className="px-2">
                <Slider 
                  min={0} 
                  max={maxPrice} 
                  step={1000} 
                  value={priceRange} 
                  onValueChange={setPriceRange} 
                />
              </div>
            </div>

            {(filterWarehouse !== 'all' || filterStatus !== 'all' || filterCategory !== 'all' || filterMetal !== 'all' || search) && (
              <Button variant="ghost" className="h-9 text-xs font-bold text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => {
                setSearch(''); setFilterWarehouse('all'); setFilterStatus('all'); setFilterCategory('all'); setFilterMetal('all'); setPriceRange([0, maxPrice]);
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
          
          {/* MARKET INTELLIGENCE (TOP TIER) */}
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

          {/* LOWER TIER: MATRICES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-indigo-50 border-indigo-100 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="p-4 pb-2 border-b border-indigo-100/50 bg-indigo-100/30">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-800 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-600" /> 
                    Restock Matrix Alerts
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
                    <AlertTriangle className="w-4 h-4 text-amber-600" /> 
                    Dead Stock Matrix (less than 90 Days)
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

      {/* MODERN KPIs */}
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

      {/* DATA VIEW */}
      <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden">
        
        {/* === MOBILE LIST VIEW === */}
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
                      {item.item_category || 'Uncategorized'} 
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
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Weight</p>
                      <p className="text-xs font-semibold text-zinc-800">{item.gross_weight_g || 0}g <span className="text-[10px] text-zinc-500 font-medium">({item.net_weight_g || 0}g N)</span></p>
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

        {/* === DESKTOP TABLE VIEW === */}
        <div className="hidden sm:block overflow-x-auto max-h-[700px] custom-scrollbar">
          <Table>
            <TableHeader className="bg-zinc-50/90 sticky top-0 backdrop-blur-sm z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <TableRow className="hover:bg-transparent border-zinc-200">
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4">Identifier</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Specs</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right">Gross</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right">Net</TableHead>
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
                    <TableCell className="text-center"><Skeleton className="h-5 w-16 mx-auto rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="pr-6"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-60 text-center text-zinc-400 bg-zinc-50/50">
                    <Package className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-semibold tracking-tight">No assets match active filters</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item) => (
                  <TableRow key={item.id} className="hover:bg-zinc-50/50 transition-colors border-zinc-100">
                    <TableCell className="px-4 py-2.5 sm:py-3">
                      <div className="font-mono text-xs sm:text-[13px] font-bold text-zinc-900 tracking-tight">{item.barcode || '--'}</div>
                      <div className="text-[10px] text-zinc-400 font-medium mt-0.5 uppercase tracking-widest">{item.item_category || 'Uncategorized'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-bold text-zinc-700">{item.metal_type || '--'}</div>
                      <div className="text-[10px] text-zinc-500 font-medium mt-0.5">{item.purity_karat || '--'}</div>
                    </TableCell>
                    <TableCell className="text-right text-[13px] font-semibold text-zinc-800">{item.gross_weight_g || 0}<span className="text-[10px] text-zinc-400 ml-0.5 font-medium">g</span></TableCell>
                    <TableCell className="text-right text-[13px] font-semibold text-zinc-500">{item.net_weight_g || 0}<span className="text-[10px] text-zinc-400 ml-0.5 font-medium">g</span></TableCell>
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
  )
}