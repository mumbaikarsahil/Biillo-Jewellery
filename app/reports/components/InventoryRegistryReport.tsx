"use client"

import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { 
  Download, Filter, Loader2, Package, Search, 
  RefreshCw, FileText, Store, Layers
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import {
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow
} from '@/components/ui/table'

export function InventoryRegistryReport() {
  const { appUser } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  
  // Mobile UI Toggle
  const [showFilters, setShowFilters] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [filterWarehouse, setFilterWarehouse] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterMetal, setFilterMetal] = useState('all')

  // Summary Metrics
  const [metrics, setMetrics] = useState({
    totalItems: 0,
    totalGrossWt: 0,
    totalNetWt: 0,
    totalValue: 0
  })

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

  const fetchData = async () => {
    if (!appUser?.company_id) return
    setLoading(true)

    try {
      let q = supabase.from('inventory_items')
        .select(`
          id, barcode, item_category, metal_type, purity_karat, 
          gross_weight_g, net_weight_g, cost_total, status, created_at,
          warehouses(name)
        `)
        .eq('company_id', appUser.company_id)
        .order('created_at', { ascending: false })
        .limit(1000)

      if (filterWarehouse !== 'all') q = q.eq('warehouse_id', filterWarehouse)
      if (filterStatus !== 'all') q = q.eq('status', filterStatus)
      if (filterMetal !== 'all') q = q.eq('metal_type', filterMetal)
      if (search.trim()) q = q.ilike('barcode', `%${search.trim()}%`)

      const { data: resData, error } = await q
      if (error) throw error

      setData(resData || [])

      const m = (resData || []).reduce((acc, curr) => ({
        totalItems: acc.totalItems + 1,
        totalGrossWt: acc.totalGrossWt + (Number(curr.gross_weight_g) || 0),
        totalNetWt: acc.totalNetWt + (Number(curr.net_weight_g) || 0),
        totalValue: acc.totalValue + (Number(curr.cost_total) || 0)
      }), { totalItems: 0, totalGrossWt: 0, totalNetWt: 0, totalValue: 0 })
      
      setMetrics(m)

    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const delay = setTimeout(() => { fetchData() }, 300)
    return () => clearTimeout(delay)
  }, [appUser, filterWarehouse, filterStatus, filterMetal, search])

  const handleExport = () => {
    if (data.length === 0) {
      toast({ title: "Empty Data", description: "No records to export.", variant: "destructive" })
      return
    }
    setExporting(true)

    const formattedData = data.map((d) => ({
      'Barcode': d.barcode,
      'Category': d.item_category || '--',
      'Metal': d.metal_type,
      'Purity': d.purity_karat,
      'Gross Wt (g)': d.gross_weight_g,
      'Net Wt (g)': d.net_weight_g,
      'Total Value (₹)': d.cost_total,
      'Status': d.status.replace('_', ' ').toUpperCase(),
      'Location': d.warehouses?.name || '--',
      'Date Added': format(new Date(d.created_at), 'dd-MMM-yyyy')
    }))

    const headers = Object.keys(formattedData[0])
    const csvContent = [
      headers.join(','),
      ...formattedData.map(row => headers.map(h => `"${(row as any)[h] || ''}"`).join(','))
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
    switch (status) {
      case 'in_stock': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase tracking-widest">In Stock</span>
      case 'sold': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200 uppercase tracking-widest">Sold</span>
      case 'in_transit': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 uppercase tracking-widest">Transit</span>
      default: return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-500 border border-zinc-200 uppercase tracking-widest">{status.replace('_', ' ')}</span>
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      
      {/* MOBILE-FIRST CAPSULE FILTERS */}
      <div className="flex flex-col gap-2.5 bg-white p-2.5 rounded-2xl border border-zinc-200 shadow-sm print:hidden">
        
        {/* Top Row: Persistent Search & Actions */}
        <div className="flex items-center gap-2 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input 
              placeholder="Scan or search..." 
              className="pl-9 h-9 text-xs rounded-full bg-zinc-50 border-zinc-200 focus-visible:ring-zinc-400 font-medium text-zinc-800" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          
          <Button 
            variant={showFilters ? "default" : "outline"} 
            size="icon" 
            className={`h-9 w-9 rounded-full sm:hidden shrink-0 transition-colors ${showFilters ? 'bg-zinc-900 text-white' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-100'}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
          </Button>

          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-zinc-200 shrink-0 hidden sm:flex text-zinc-600 hover:bg-zinc-100" onClick={fetchData}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleExport} disabled={exporting || loading} className="h-9 text-xs font-medium rounded-full hidden sm:flex shrink-0 text-zinc-700 border border-zinc-200 hover:bg-zinc-50 bg-white">
            {exporting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-2 h-3.5 w-3.5 text-zinc-500" />}
            Export CSV
          </Button>
        </div>

        {/* Collapsible Filters */}
        <div className={`flex-col sm:flex-row flex-wrap items-center gap-2 ${showFilters ? 'flex' : 'hidden sm:flex'} animate-in slide-in-from-top-2 duration-200`}>
          
          <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
            <SelectTrigger className="h-9 text-[11px] font-bold bg-zinc-50 border-zinc-200 rounded-full w-full sm:w-[140px] focus:ring-0">
              <Store className="w-3 h-3 mr-1.5 text-zinc-500" />
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-xl border-zinc-200">
              <SelectItem value="all" className="text-xs font-medium rounded-lg">All Locations</SelectItem>
              {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs font-medium rounded-lg">{w.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="grid grid-cols-2 sm:flex w-full sm:w-auto gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 text-[11px] font-bold bg-zinc-50 border-zinc-200 rounded-full w-full sm:w-[130px] focus:ring-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl border-zinc-200">
                <SelectItem value="all" className="text-xs font-medium rounded-lg">All Statuses</SelectItem>
                <SelectItem value="in_stock" className="text-xs font-medium rounded-lg">In Stock</SelectItem>
                <SelectItem value="sold" className="text-xs font-medium rounded-lg">Sold</SelectItem>
                <SelectItem value="in_transit" className="text-xs font-medium rounded-lg">In Transit</SelectItem>
                <SelectItem value="memo" className="text-xs font-medium rounded-lg">On Memo</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterMetal} onValueChange={setFilterMetal}>
              <SelectTrigger className="h-9 text-[11px] font-bold bg-zinc-50 border-zinc-200 rounded-full w-full sm:w-[130px] focus:ring-0">
                <Layers className="w-3 h-3 mr-1.5 text-zinc-500" />
                <SelectValue placeholder="Metal" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl border-zinc-200">
                <SelectItem value="all" className="text-xs font-medium rounded-lg">All Metals</SelectItem>
                <SelectItem value="Gold" className="text-xs font-medium rounded-lg">Gold</SelectItem>
                <SelectItem value="Silver" className="text-xs font-medium rounded-lg">Silver</SelectItem>
                <SelectItem value="Platinum" className="text-xs font-medium rounded-lg">Platinum</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 w-full sm:hidden mt-1">
            <Button variant="outline" className="flex-1 h-9 text-xs font-medium rounded-full border-zinc-200 text-zinc-700" onClick={fetchData}>
              <RefreshCw className={`h-3.5 w-3.5 mr-2 text-zinc-500 ${loading ? 'animate-spin' : ''}`} /> Sync
            </Button>
            <Button variant="outline" className="flex-1 h-9 text-xs font-medium rounded-full border-zinc-200 text-zinc-700" onClick={handleExport} disabled={exporting || loading}>
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <FileText className="h-3.5 w-3.5 mr-2 text-zinc-500" />} CSV
            </Button>
          </div>
        </div>
      </div>

      {/* MODERN KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-zinc-400" /> Total Assets
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
            <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">Valuation</p>
            {loading ? <Skeleton className="h-8 w-32 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">₹{metrics.totalValue.toLocaleString()}</p>}
          </CardContent>
        </Card>
      </div>

      {/* DATA VIEW (Responsive: List on Mobile, Table on Desktop) */}
      <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden">
        
        {/* === MOBILE LIST VIEW (Visible only below sm breakpoint) === */}
        <div className="block sm:hidden divide-y divide-zinc-100">
          {loading ? (
             Array.from({ length: 5 }).map((_, i) => (
               <div key={i} className="p-4 space-y-3">
                 <div className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-16" /></div>
                 <div className="flex gap-4"><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-16" /></div>
               </div>
             ))
          ) : data.length === 0 ? (
            <div className="py-12 text-center text-zinc-400">
              <Package className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold tracking-tight">No assets found</p>
            </div>
          ) : (
            data.map((item) => (
              <div key={item.id} className="p-4 hover:bg-zinc-50 transition-colors">
                <div className="flex justify-between items-start mb-2.5">
                  <div>
                    <div className="font-mono text-[13px] font-bold text-zinc-900 tracking-tight">{item.barcode}</div>
                    <div className="text-[11px] font-medium text-zinc-500 mt-0.5 flex items-center gap-1.5">
                      {item.item_category || '--'} 
                      <span className="w-1 h-1 rounded-full bg-zinc-300" />
                      {item.warehouses?.name || 'Global'}
                    </div>
                  </div>
                  <div>{getStatusBadge(item.status)}</div>
                </div>
                
                <div className="flex justify-between items-end mt-3 pt-3 border-t border-zinc-100/80">
                  <div className="flex gap-4">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Specs</p>
                      <p className="text-xs font-semibold text-zinc-800">{item.metal_type} <span className="text-[10px] text-zinc-500 font-medium">{item.purity_karat || ''}</span></p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Weight</p>
                      <p className="text-xs font-semibold text-zinc-800">{item.gross_weight_g}g <span className="text-[10px] text-zinc-500 font-medium">({item.net_weight_g}g N)</span></p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Value</p>
                    <p className="text-sm font-bold text-emerald-600 tracking-tight">₹{item.cost_total?.toLocaleString() || '0'}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* === DESKTOP TABLE VIEW (Visible only sm and above) === */}
        <div className="hidden sm:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50/80">
              <TableRow className="hover:bg-transparent border-zinc-200">
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4">Identifier</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Specs</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right">Gross</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right">Net</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-center">Status</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Node</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right pr-6">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
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
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center text-zinc-400">
                    <Package className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-semibold tracking-tight">No assets found</p>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item) => (
                  <TableRow key={item.id} className="hover:bg-zinc-50/50 transition-colors border-zinc-100">
                    <TableCell className="px-4 py-2.5 sm:py-3">
                      <div className="font-mono text-xs sm:text-[13px] font-semibold text-zinc-900 tracking-tight">{item.barcode}</div>
                      <div className="text-[10px] text-zinc-400 font-medium mt-0.5">{item.item_category || '--'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-semibold text-zinc-700">{item.metal_type}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">{item.purity_karat || '--'}</div>
                    </TableCell>
                    <TableCell className="text-right text-[13px] font-medium text-zinc-800">{item.gross_weight_g}<span className="text-[10px] text-zinc-400 ml-0.5">g</span></TableCell>
                    <TableCell className="text-right text-[13px] font-medium text-zinc-500">{item.net_weight_g}<span className="text-[10px] text-zinc-400 ml-0.5">g</span></TableCell>
                    <TableCell className="text-center">{getStatusBadge(item.status)}</TableCell>
                    <TableCell className="text-xs text-zinc-500 font-medium">{item.warehouses?.name || '--'}</TableCell>
                    <TableCell className="text-right text-[13px] font-semibold text-zinc-900 pr-6">₹{item.cost_total?.toLocaleString() || '0'}</TableCell>
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