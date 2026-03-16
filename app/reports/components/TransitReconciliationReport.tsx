"use client"

import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { 
  Download, Loader2, Search, RefreshCw, Filter,
  Calendar, ArrowRightLeft, Truck, CheckCircle2, XCircle, Store, MapPin
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

export function TransitReconciliationReport() {
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
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterOrigin, setFilterOrigin] = useState('all')
  const [filterDest, setFilterDest] = useState('all')
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  const [metrics, setMetrics] = useState({
    totalTransfers: 0,
    inTransit: 0,
    received: 0,
    cancelled: 0
  })

  // Fetch Warehouses
  useEffect(() => {
    async function fetchWarehouses() {
      if (!appUser?.company_id) return
      const { data } = await supabase.from('warehouses').select('id, name').eq('company_id', appUser.company_id)
      if (data) setWarehouses(data)
    }
    fetchWarehouses()
  }, [appUser])

  const fetchData = async () => {
    if (!appUser?.company_id) return
    setLoading(true)

    try {
      const safeEndDate = new Date(endDate)
      safeEndDate.setDate(safeEndDate.getDate() + 1)
      const safeEndDateStr = safeEndDate.toISOString().split('T')[0]

      let q = supabase.from('stock_transfers')
        .select(`
          id, transfer_number, transfer_date, status,
          from_warehouse_id, to_warehouse_id
        `)
        .eq('company_id', appUser.company_id)
        .gte('transfer_date', startDate)
        .lt('transfer_date', safeEndDateStr)
        .order('transfer_date', { ascending: false })

      // Apply Filters
      if (filterStatus !== 'all') q = q.eq('status', filterStatus)
      if (filterOrigin !== 'all') q = q.eq('from_warehouse_id', filterOrigin)
      if (filterDest !== 'all') q = q.eq('to_warehouse_id', filterDest)
      if (search.trim()) q = q.ilike('transfer_number', `%${search.trim()}%`)

      const { data: resData, error } = await q
      if (error) throw error

      setData(resData || [])

      let inTransitCount = 0
      let receivedCount = 0
      let cancelledCount = 0
      
      resData?.forEach(trf => {
        if (trf.status === 'in_transit' || trf.status === 'pending') inTransitCount++
        else if (trf.status === 'received' || trf.status === 'completed') receivedCount++
        else if (trf.status === 'cancelled') cancelledCount++
      })

      setMetrics({
        totalTransfers: resData?.length || 0,
        inTransit: inTransitCount,
        received: receivedCount,
        cancelled: cancelledCount
      })

    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // Trigger fetch when any filter changes
  useEffect(() => {
    const delay = setTimeout(() => { fetchData() }, 300)
    return () => clearTimeout(delay)
  }, [appUser, filterStatus, filterOrigin, filterDest, startDate, endDate, search])

  const handleExport = () => {
    if (data.length === 0) {
      toast({ title: "Empty Data", description: "No records to export.", variant: "destructive" })
      return
    }
    setExporting(true)

    const formattedData = data.map((d) => {
      const fromName = warehouses.find(w => w.id === d.from_warehouse_id)?.name || '--'
      const toName = warehouses.find(w => w.id === d.to_warehouse_id)?.name || '--'

      return {
        'Transfer ID': d.transfer_number,
        'Date Issued': format(new Date(d.transfer_date), 'dd-MMM-yyyy'),
        'Origin Node (From)': fromName,
        'Destination Node (To)': toName,
        'Status': (d.status || 'UNKNOWN').toUpperCase(),
        'Tracking / Notes': '--'
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(formattedData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Logistics_Ledger")

    XLSX.writeFile(workbook, `Logistics_Reconciliation_${startDate}_to_${endDate}.xlsx`)
    
    setExporting(false)
    toast({ title: "Export Complete", description: "Transit ledger downloaded securely." })
  }

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase()
    if (s === 'received' || s === 'completed') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase tracking-widest">Reconciled</span>
    }
    if (s === 'in_transit' || s === 'pending') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 uppercase tracking-widest">In Transit</span>
    }
    if (s === 'cancelled' || s === 'rejected') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 uppercase tracking-widest">Cancelled</span>
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-500 border border-zinc-200 uppercase tracking-widest">{s}</span>
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      
      {/* MOBILE-FIRST CAPSULE FILTERS */}
      <div className="flex flex-col gap-2.5 bg-white p-2.5 rounded-2xl border border-zinc-200 shadow-sm print:hidden">
        
        {/* Top Row: Persistent Search & Primary Actions */}
        <div className="flex items-center gap-2 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input 
              placeholder="Search manifest..." 
              className="pl-9 h-9 text-xs rounded-full bg-zinc-50 border-zinc-200 focus-visible:ring-zinc-400 font-medium text-zinc-800" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          
          {/* Mobile Filter Toggle */}
          <Button 
            variant={showFilters ? "default" : "outline"} 
            size="icon" 
            className={`h-9 w-9 rounded-full sm:hidden shrink-0 transition-colors ${showFilters ? 'bg-zinc-900 text-white hover:bg-zinc-800' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-100'}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
          </Button>

          {/* Desktop Only Primary Actions */}
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-zinc-200 shrink-0 hidden sm:flex text-zinc-600 hover:bg-zinc-100" onClick={fetchData}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleExport} disabled={exporting || loading} className="h-9 text-xs font-medium rounded-full hidden sm:flex shrink-0 text-zinc-700 border border-zinc-200 hover:bg-zinc-50 bg-white">
            {exporting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5 text-zinc-500" />}
            Export CSV
          </Button>
        </div>

        {/* Collapsible Filter Area */}
        <div className={`flex-col sm:flex-row flex-wrap items-center gap-2 ${showFilters ? 'flex' : 'hidden sm:flex'} animate-in slide-in-from-top-2 duration-200`}>
          
          {/* Dates */}
          <div className="flex w-full sm:w-auto items-center bg-zinc-50 border border-zinc-200 rounded-full px-3 h-9 focus-within:border-zinc-400 transition-colors min-w-0">
            <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0 mr-1.5" />
            <input type="date" className="bg-transparent text-[11px] font-mono font-medium outline-none flex-1 min-w-0 text-zinc-700" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-zinc-300 text-[10px] uppercase font-bold mx-1 shrink-0">-</span>
            <input type="date" className="bg-transparent text-[11px] font-mono font-medium outline-none flex-1 min-w-0 text-right text-zinc-700" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 sm:flex w-full sm:w-auto gap-2">
            <Select value={filterOrigin} onValueChange={setFilterOrigin}>
              <SelectTrigger className="h-9 text-[11px] font-bold bg-zinc-50 border-zinc-200 rounded-full w-full sm:w-[130px] focus:ring-0">
                <Store className="w-3 h-3 mr-1.5 text-zinc-500" />
                <SelectValue placeholder="Origin" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl border-zinc-200">
                <SelectItem value="all" className="text-xs font-medium rounded-lg">All Origins</SelectItem>
                {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs font-medium rounded-lg">{w.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterDest} onValueChange={setFilterDest}>
              <SelectTrigger className="h-9 text-[11px] font-bold bg-zinc-50 border-zinc-200 rounded-full w-full sm:w-[130px] focus:ring-0">
                <MapPin className="w-3 h-3 mr-1.5 text-zinc-500" />
                <SelectValue placeholder="Destination" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl border-zinc-200">
                <SelectItem value="all" className="text-xs font-medium rounded-lg">All Targets</SelectItem>
                {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs font-medium rounded-lg">{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex w-full sm:w-auto gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 text-[11px] font-bold bg-zinc-50 border-zinc-200 rounded-full flex-1 sm:w-[120px] focus:ring-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl border-zinc-200">
                <SelectItem value="all" className="text-xs font-medium rounded-lg">All Statuses</SelectItem>
                <SelectItem value="in_transit" className="text-xs font-medium rounded-lg">Pending Transit</SelectItem>
                <SelectItem value="received" className="text-xs font-medium rounded-lg">Reconciled</SelectItem>
                <SelectItem value="draft" className="text-xs font-medium rounded-lg">Draft</SelectItem>
                <SelectItem value="cancelled" className="text-xs font-medium rounded-lg">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {/* Mobile-only secondary actions */}
            <Button variant="outline" className="flex-1 h-9 text-xs font-medium rounded-full border-zinc-200 text-zinc-700 sm:hidden" onClick={fetchData}>
              <RefreshCw className={`h-3.5 w-3.5 mr-2 text-zinc-500 ${loading ? 'animate-spin' : ''}`} /> Sync
            </Button>
            <Button variant="outline" className="flex-1 h-9 text-xs font-medium rounded-full border-zinc-200 text-zinc-700 sm:hidden" onClick={handleExport} disabled={exporting || loading}>
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Download className="h-3.5 w-3.5 mr-2 text-zinc-500" />} CSV
            </Button>
          </div>

        </div>
      </div>

      {/* MODERN KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
              <ArrowRightLeft className="h-3.5 w-3.5 text-zinc-400" /> Total Dispatches
            </p>
            {loading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">{metrics.totalTransfers}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-zinc-400" /> In Transit
            </p>
            {loading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">{metrics.inTransit}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Reconciled
            </p>
            {loading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">{metrics.received}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 text-rose-400" /> Cancelled
            </p>
            {loading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">{metrics.cancelled}</p>}
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
                 <div className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-5 w-16 rounded-full" /></div>
                 <div className="flex justify-between"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-20" /></div>
               </div>
             ))
          ) : data.length === 0 ? (
            <div className="py-12 text-center text-zinc-400">
              <Truck className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold tracking-tight">No transit records</p>
            </div>
          ) : (
            data.map((trf) => {
              const fromName = warehouses.find(w => w.id === trf.from_warehouse_id)?.name || '--'
              const toName = warehouses.find(w => w.id === trf.to_warehouse_id)?.name || '--'

              return (
                <div key={trf.id} className="p-4 hover:bg-zinc-50 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-mono text-[13px] font-bold text-zinc-900 tracking-tight">{trf.transfer_number}</div>
                      <div className="text-[11px] text-zinc-500 font-medium mt-0.5">{format(new Date(trf.transfer_date), 'dd MMM yyyy')}</div>
                    </div>
                    <div>{getStatusBadge(trf.status)}</div>
                  </div>
                  
                  {/* Visual Route Indicator */}
                  <div className="flex items-center gap-3 mt-4 pt-3 border-t border-zinc-100/80">
                    <div className="flex-1">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Origin</p>
                      <p className="text-xs font-semibold text-zinc-800 flex items-center gap-1"><Store className="w-3 h-3 text-zinc-400"/> {fromName}</p>
                    </div>
                    <ArrowRightLeft className="w-3.5 h-3.5 text-zinc-300 mx-1 shrink-0" />
                    <div className="flex-1 text-right">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5 flex justify-end">Destination</p>
                      <p className="text-xs font-semibold text-zinc-800 flex items-center justify-end gap-1"><MapPin className="w-3 h-3 text-zinc-400"/> {toName}</p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* === DESKTOP TABLE VIEW (Visible only sm and above) === */}
        <div className="hidden sm:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50/80">
              <TableRow className="hover:bg-transparent border-zinc-200">
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4">Transfer Info</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Origin Node</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Target Node</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-zinc-100">
                    <TableCell className="px-4 py-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-20 mt-1.5" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-20 mx-auto rounded-full" /></TableCell>
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-40 text-center text-zinc-400">
                    <Truck className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-semibold tracking-tight">No transit records</p>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((trf) => {
                  const fromName = warehouses.find(w => w.id === trf.from_warehouse_id)?.name || '--'
                  const toName = warehouses.find(w => w.id === trf.to_warehouse_id)?.name || '--'

                  return (
                    <TableRow key={trf.id} className="hover:bg-zinc-50/50 transition-colors border-zinc-100">
                      <TableCell className="px-4 py-2.5 sm:py-3">
                        <div className="font-mono text-xs sm:text-[13px] font-semibold text-zinc-900 tracking-tight">{trf.transfer_number}</div>
                        <div className="text-[10px] text-zinc-500 font-medium mt-0.5">{format(new Date(trf.transfer_date), 'dd MMM yyyy')}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Store className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                          <span className="text-[13px] font-medium text-zinc-800">{fromName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                           <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                           <span className="text-[13px] font-medium text-zinc-800">{toName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center pr-4 sm:pr-0">
                        {getStatusBadge(trf.status)}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

      </Card>
    </div>
  )
}