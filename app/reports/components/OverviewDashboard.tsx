"use client"

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Store, Calendar, RefreshCw, Printer, 
  TrendingUp, ArrowRightLeft, Briefcase, Activity, Filter, ExternalLink
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'

import { useAuth } from '@/hooks/useAuth'
import { useStoreLocation } from '@/hooks/useStoreLocation' // ✨ NEW: Import your secure location hook
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'

import {
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'

interface KPIStats {
  totalSales: number
  avgDailySales: number
  pendingTransfers: number
  activeJobBags: number
}

// Highly distinct, Vercel-inspired color palette for maximum contrast
const COLORS = [
  '#111827', // High-contrast Black/Slate
  '#0070F3', // Vercel Blue
  '#10B981', // Emerald
  '#F5A623', // Amber/Warning
  '#7928CA', // Purple
  '#FF0080', // Magenta
  '#50E3C2'  // Cyan
]

export function OverviewDashboard() {
  const { appUser } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  
  // ✨ INTEGRATE LOCATION SECURITY HOOK ✨
  const { isHQ, isLocked, selectedLocation, setSelectedLocation } = useStoreLocation()
  
  const [loading, setLoading] = useState(true)
  const [warehouses, setWarehouses] = useState<any[]>([])
  
  // Filters & State
  const [showFilters, setShowFilters] = useState(false)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  const [kpis, setKpis] = useState<KPIStats>({ totalSales: 0, avgDailySales: 0, pendingTransfers: 0, activeJobBags: 0 })
  const [salesTrend, setSalesTrend] = useState<any[]>([])
  const [inventoryDist, setInventoryDist] = useState<any[]>([])

  useEffect(() => {
    async function fetchWarehouses() {
      if (!appUser?.company_id) return
      const { data } = await supabase.from('warehouses').select('id, name').eq('company_id', appUser.company_id)
      if (data) setWarehouses(data)
    }
    fetchWarehouses()
  }, [appUser])

  const fetchDashboardData = async () => {
    if (!appUser?.company_id) return
    setLoading(true)
    try {
      const safeEndDate = new Date(endDate)
      safeEndDate.setDate(safeEndDate.getDate() + 1)
      const safeEndDateStr = safeEndDate.toISOString().split('T')[0]

      // 1. Fetch standard small-table data (Sales, Transfers, Jobs)
      let salesQ = supabase.from('invoices')
        .select('created_at, final_total')
        .eq('company_id', appUser.company_id)
        .gte('created_at', startDate)
        .lt('created_at', safeEndDateStr)
        .limit(10000) 

      let trfQ = supabase.from('stock_transfers')
        .select('id, status')
        .eq('company_id', appUser.company_id)
        .in('status', ['draft', 'in_transit'])
        .limit(5000)

      let jobQ = supabase.from('job_bags')
        .select('id, status')
        .eq('company_id', appUser.company_id)
        .in('status', ['open', 'issued', 'in_progress'])
        .limit(5000)

      // ✨ APPLY SECURE LOCATION FILTER
      if (selectedLocation !== 'ALL') {
        salesQ = salesQ.eq('warehouse_id', selectedLocation)
        trfQ = trfQ.or(`from_warehouse_id.eq.${selectedLocation},to_warehouse_id.eq.${selectedLocation}`)
      }

      // Execute non-inventory queries in parallel
      const [salesRes, trfRes, jobRes] = await Promise.all([salesQ, trfQ, jobQ])

      if (salesRes.error) throw salesRes.error

      // --- 2. BULLETPROOF PAGINATED INVENTORY FETCH (Bypasses API Limits) ---
      let allInvData: any[] = [];
      let isFetchingInv = true;
      let step = 0;
      const limit = 1000;

      while (isFetchingInv) {
        let invQ = supabase.from('inventory_items')
          .select('id, warehouse_id, metal_type, status, warehouses(name)')
          .eq('company_id', appUser.company_id)
          .eq('status', 'in_stock')
          .order('id', { ascending: true }) // Crucial for stable pagination
          .range(step * limit, (step + 1) * limit - 1)

        // ✨ APPLY SECURE LOCATION FILTER
        if (selectedLocation !== 'ALL') {
          invQ = invQ.eq('warehouse_id', selectedLocation)
        }

        const { data: chunk, error: invErr } = await invQ;
        if (invErr) throw invErr;

        if (chunk && chunk.length > 0) {
          allInvData = [...allInvData, ...chunk];
          step++;
          if (chunk.length < limit) isFetchingInv = false;
        } else {
          isFetchingInv = false;
        }
      }

      // Deduplicate to be absolutely safe
      const uniqueInvData = Array.from(new Map(allInvData.map(item => [item.id, item])).values());

      // --- 3. PROCESS SALES METRICS ---
      const salesData = salesRes.data || []
      const totalS = salesData.reduce((sum, inv) => sum + (Number(inv.final_total) || 0), 0)
      const daysDiff = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24)))
      
      const trendMap: Record<string, number> = {}
      salesData.forEach(inv => {
        const d = new Date(inv.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
        trendMap[d] = (trendMap[d] || 0) + (Number(inv.final_total) || 0)
      })
      const trendArr = Object.keys(trendMap).map(k => ({ date: k, amount: trendMap[k] })).slice(-15) 

      // --- 4. PROCESS INVENTORY DISTRIBUTION ---
      const distMap: Record<string, number> = {}
      
      uniqueInvData.forEach((item: any) => {
        // DEFENSIVE CHECK: Handle cases where the join returns an array instead of an object
        const whName = Array.isArray(item.warehouses) ? item.warehouses[0]?.name : item.warehouses?.name;
        
        // If viewing globally, breakdown by Vault. If viewing a specific node, breakdown by Metal Type
        const key = selectedLocation === 'ALL' ? (whName || 'Unknown Vault') : (item.metal_type || 'Unknown Metal')
        distMap[key] = (distMap[key] || 0) + 1
      })
      
      // Sort descending so the pie chart always looks organized
      const distArr = Object.keys(distMap)
        .map(k => ({ name: k, value: distMap[k] }))
        .sort((a, b) => b.value - a.value)

      // Set Final States
      setKpis({ totalSales: totalS, avgDailySales: totalS / daysDiff, pendingTransfers: trfRes.data?.length || 0, activeJobBags: jobRes.data?.length || 0 })
      setSalesTrend(trendArr)
      setInventoryDist(distArr)

    } catch (err: any) {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // ✨ REACT TO SECURE LOCATION STATE
  useEffect(() => { 
    if (selectedLocation) fetchDashboardData() 
  }, [appUser, selectedLocation, startDate, endDate])

  const formatDateForPrint = (dateString: string) => {
    try { return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) } 
    catch { return dateString }
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500 print:p-0 print:space-y-6">
      
      {/* NATIVE APP STYLE FILTERS */}
      <div className="flex flex-col gap-2.5 print:hidden bg-white p-2.5 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-2 w-full">
          
          {/* ✨ SECURE LOCATION DROPDOWN ✨ */}
          <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={isLocked}>
            <SelectTrigger className="flex-1 h-9 text-xs font-medium bg-zinc-50 border-zinc-200 rounded-full focus:ring-0 focus:ring-offset-0">
              <Store className="w-3.5 h-3.5 mr-2 text-zinc-500" />
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-zinc-200 shadow-xl">
              {isHQ && <SelectItem value="ALL" className="text-xs font-medium rounded-lg text-indigo-600">Global Scope</SelectItem>}
              {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs font-medium rounded-lg">{w.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button 
            variant={showFilters ? "default" : "outline"} 
            size="icon" 
            className={`h-9 w-9 rounded-full sm:hidden shrink-0 transition-colors ${showFilters ? 'bg-zinc-900 text-white hover:bg-zinc-800' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-100'}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
          </Button>
          
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-zinc-200 shrink-0 hidden sm:flex text-zinc-600 hover:bg-zinc-100" onClick={fetchDashboardData}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-zinc-200 shrink-0 hidden sm:flex text-zinc-600 hover:bg-zinc-100" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className={`flex-col sm:flex-row flex-wrap items-center gap-2 ${showFilters ? 'flex' : 'hidden sm:flex'} animate-in slide-in-from-top-2 duration-200`}>
          <div className="flex w-full sm:w-auto items-center bg-zinc-50 border border-zinc-200 rounded-full px-3 h-9 focus-within:border-zinc-400 transition-colors min-w-0">
            <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0 mr-1.5" />
            <input type="date" className="bg-transparent text-[11px] font-mono font-medium outline-none flex-1 min-w-0 text-zinc-700" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-zinc-300 text-[10px] uppercase font-bold mx-1 shrink-0">-</span>
            <input type="date" className="bg-transparent text-[11px] font-mono font-medium outline-none flex-1 min-w-0 text-right text-zinc-700" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          
          <div className="flex gap-2 w-full sm:hidden mt-1">
            <Button variant="outline" className="flex-1 h-9 text-xs font-medium rounded-full border-zinc-200 text-zinc-700 hover:bg-zinc-100" onClick={fetchDashboardData}>
              <RefreshCw className={`h-3.5 w-3.5 mr-2 text-zinc-500 ${loading ? 'animate-spin' : ''}`} /> Sync
            </Button>
            <Button variant="outline" className="flex-1 h-9 text-xs font-medium rounded-full border-zinc-200 text-zinc-700 hover:bg-zinc-100" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5 mr-2 text-zinc-500" /> Export PDF
            </Button>
          </div>
        </div>
      </div>

      {/* PRINT HEADER */}
      <div className="hidden print:block mb-8 border-b border-zinc-200 pb-2">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Executive Overview</h1>
        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest mt-1">Period: {formatDateForPrint(startDate)} - {formatDateForPrint(endDate)} | Scope: {selectedLocation === 'ALL' ? 'Global' : warehouses.find(w=>w.id===selectedLocation)?.name}</p>
      </div>

      {/* VERCEL STYLE KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 print:grid-cols-4 print:gap-4">
        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl print:border-zinc-300">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-zinc-400" /> Total Revenue
            </p>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 truncate mt-1">₹{kpis.totalSales.toLocaleString()}</p>}
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl print:border-zinc-300">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-zinc-400" /> Daily Average
            </p>
            {loading ? <Skeleton className="h-8 w-20 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 truncate mt-1">₹{kpis.avgDailySales.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl print:border-zinc-300">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
              <ArrowRightLeft className="h-3.5 w-3.5 text-zinc-400" /> Active Transit
            </p>
            {loading ? <Skeleton className="h-8 w-12 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 truncate mt-1">{kpis.pendingTransfers}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl print:border-zinc-300">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-zinc-400" /> WIP Bags
            </p>
            {loading ? <Skeleton className="h-8 w-12 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 truncate mt-1">{kpis.activeJobBags}</p>}
          </CardContent>
        </Card>
      </div>

      {/* VISUALIZATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 print:grid-cols-3 print:break-inside-avoid">
        
        {/* Vercel Style Area Chart */}
        <Card className="lg:col-span-2 shadow-sm border-zinc-200 rounded-2xl overflow-hidden print:border-zinc-300 bg-white">
          <div className="pt-5 px-5 print:pt-4">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Revenue Trajectory</h2>
          </div>
          <CardContent className="p-0 sm:p-2 mt-4 w-full">
            {loading ? <div className="p-4"><Skeleton className="h-[220px] w-full rounded-xl" /></div> : salesTrend.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-xs font-medium text-zinc-400">No Sales Data</div>
            ) : (
              <div className="h-[250px] w-full min-w-0 pr-4 pb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#111827" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#111827" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717A', fontFamily: 'inherit' }} dy={10} minTickGap={20} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717A', fontFamily: 'inherit' }} tickFormatter={(val) => `₹${val/1000}k`} width={50} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#111827', color: '#fff', borderRadius: '8px', fontSize: '12px', fontWeight: '500', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#fff' }} cursor={{ stroke: '#E4E4E7', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area type="monotone" dataKey="amount" name="Revenue" stroke="#111827" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" activeDot={{ r: 5, fill: '#111827', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CLICKABLE PIE CHART FOR ASSET REGISTRY NAVIGATION */}
        <Card 
          className="shadow-sm border-zinc-200 rounded-2xl overflow-hidden print:border-zinc-300 bg-white flex flex-col group cursor-pointer hover:border-indigo-300 hover:ring-1 hover:ring-indigo-100 transition-all"
          onClick={() => router.push('/reports/registry')} 
        >
          <div className="pt-5 px-5 print:pt-4 flex justify-between items-center">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 truncate">
              {selectedLocation === 'ALL' ? 'Global Vault Asset Dist.' : 'Local Metal Breakdown'}
            </h2>
            <ExternalLink className="w-4 h-4 text-zinc-300 group-hover:text-indigo-500 transition-colors" />
          </div>
          <CardContent className="p-4 sm:p-5 flex-1 flex flex-col justify-center min-h-0">
            {loading ? <Skeleton className="h-[200px] w-full rounded-full" /> : inventoryDist.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-xs font-medium text-zinc-400">Vault Empty</div>
            ) : (
              <div className="w-full flex flex-col items-center">
                <div className="h-[180px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={inventoryDist} 
                        cx="50%" cy="50%" 
                        innerRadius="60%" 
                        outerRadius="85%" 
                        paddingAngle={3}
                        dataKey="value" 
                        stroke="none"
                        cornerRadius={4}
                      >
                        {inventoryDist.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#18181B', borderColor: '#18181B', color: '#fff', borderRadius: '8px', fontSize: '11px', fontWeight: '500' }} 
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="flex flex-wrap justify-center gap-2 pt-4 w-full">
                   {inventoryDist.map((entry, index) => (
                     <div key={entry.name} className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-100 px-2 py-1 rounded-md">
                        <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-[10px] font-medium text-zinc-600 truncate max-w-[80px]" title={entry.name}>{entry.name}</span>
                     </div>
                   ))}
                </div>
                
                <div className="w-full text-center mt-3 pt-3 border-t border-zinc-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 group-hover:text-indigo-600 transition-colors">
                    Click to view full Asset Registry
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  )
}