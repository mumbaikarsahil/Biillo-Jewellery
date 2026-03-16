"use client"

import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { 
  Download, Loader2, Search, RefreshCw, 
  TrendingUp, Calendar, Store, CreditCard, Receipt
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

export function SalesVelocityReport() {
  const { appUser } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  
  // Filters
  const [search, setSearch] = useState('')
  const [filterWarehouse, setFilterWarehouse] = useState('all')
  const [filterPayment, setFilterPayment] = useState('all')
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    invoiceCount: 0,
    avgOrderValue: 0,
    topPaymentMode: '--'
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

      // FIXED: Removed warehouses(name) because of missing Foreign Key.
      // Instead, we just fetch warehouse_id and map the name ourselves.
      let q = supabase.from('invoices')
        .select(`
          id, invoice_number, created_at, final_total, payment_mode, warehouse_id,
          customers(full_name, phone)
        `)
        .eq('company_id', appUser.company_id)
        .gte('created_at', startDate)
        .lt('created_at', safeEndDateStr)
        .order('created_at', { ascending: false })

      if (filterWarehouse !== 'all') q = q.eq('warehouse_id', filterWarehouse)
      if (filterPayment !== 'all') q = q.eq('payment_mode', filterPayment)
      if (search.trim()) q = q.ilike('invoice_number', `%${search.trim()}%`)

      const { data: resData, error } = await q
      if (error) throw error

      setData(resData || [])

      let totalRev = 0
      const paymentCounts: Record<string, number> = {}
      
      resData?.forEach(inv => {
        totalRev += (Number(inv.final_total) || 0)
        const mode = inv.payment_mode || 'Unknown'
        paymentCounts[mode] = (paymentCounts[mode] || 0) + 1
      })

      let topMode = '--'
      let maxCount = 0
      for (const [mode, count] of Object.entries(paymentCounts)) {
        if (count > maxCount) { maxCount = count; topMode = mode }
      }

      setMetrics({
        totalRevenue: totalRev,
        invoiceCount: resData?.length || 0,
        avgOrderValue: resData?.length ? totalRev / resData.length : 0,
        topPaymentMode: topMode.toUpperCase()
      })

    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" })
      console.error("Sales Report Fetch Error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const delay = setTimeout(() => { fetchData() }, 300)
    return () => clearTimeout(delay)
  }, [appUser, filterWarehouse, filterPayment, startDate, endDate, search])

  const handleExport = () => {
    if (data.length === 0) {
      toast({ title: "Empty Data", description: "No records to export.", variant: "destructive" })
      return
    }
    setExporting(true)

    const formattedData = data.map((d) => {
      // Find the warehouse name from our pre-fetched list
      const wName = warehouses.find(w => w.id === d.warehouse_id)?.name || '--'

      return {
        'Invoice No': d.invoice_number,
        'Date & Time': format(new Date(d.created_at), 'dd-MMM-yyyy HH:mm'),
        'Customer Name': d.customers?.full_name || 'Walk-in Customer',
        'Customer Phone': d.customers?.phone || '--',
        'Location': wName,
        'Payment Mode': (d.payment_mode || 'CASH').toUpperCase(),
        'Invoice Total (₹)': d.final_total
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(formattedData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales_Ledger")

    XLSX.writeFile(workbook, `Sales_Velocity_Report_${startDate}_to_${endDate}.xlsx`)
    
    setExporting(false)
    toast({ title: "Export Complete", description: "Sales Ledger downloaded securely." })
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      
      {/* NATIVE APP STYLE FILTERS */}
      <div className="flex flex-col gap-2 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
        
        {/* Top Row: Search & Location */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input placeholder="Search invoice..." className="pl-8 h-9 text-xs bg-gray-50 border-gray-200 rounded-lg focus-visible:ring-gray-300" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          
          <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
            <SelectTrigger className="w-[110px] sm:w-[140px] h-9 text-xs font-bold bg-gray-50 border-gray-200 rounded-lg shrink-0">
              <Store className="w-3.5 h-3.5 mr-1.5 text-gray-500 hidden sm:block" />
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Bottom Row: Dates, Payment & Actions */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center bg-gray-50 border border-gray-200 rounded-lg px-2 h-9 focus-within:ring-1 focus-within:ring-gray-300 min-w-0">
            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0 mr-1.5 hidden sm:block" />
            <input type="date" className="bg-transparent text-[10px] sm:text-[11px] font-mono font-bold outline-none flex-1 min-w-0" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-gray-300 text-[9px] uppercase font-bold mx-1 shrink-0">to</span>
            <input type="date" className="bg-transparent text-[10px] sm:text-[11px] font-mono font-bold outline-none flex-1 min-w-0 text-right" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          
          <Select value={filterPayment} onValueChange={setFilterPayment}>
            <SelectTrigger className="w-[90px] sm:w-[130px] h-9 text-xs font-bold bg-gray-50 border-gray-200 rounded-lg shrink-0">
              <SelectValue placeholder="Mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modes</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="upi">UPI / Bank</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-gray-200 shrink-0" onClick={fetchData}>
            <RefreshCw className={`h-3.5 w-3.5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button onClick={handleExport} disabled={exporting || loading} variant="outline" size="icon" className="h-9 w-9 rounded-lg border-gray-200 shrink-0 sm:hidden">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-gray-600" />}
          </Button>
          
          <Button onClick={handleExport} disabled={exporting || loading} className="h-9 text-xs font-bold rounded-lg hidden sm:flex shrink-0">
            {exporting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
            Export CSV
          </Button>
        </div>
      </div>

      {/* COMPACT KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        <Card className="shadow-none border-gray-200 bg-white rounded-xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-500 shrink-0" /> <span className="truncate">Gross Revenue</span>
            </p>
            {loading ? <Skeleton className="h-6 w-20" /> : <p className="text-lg sm:text-xl font-black text-gray-900 truncate">₹{metrics.totalRevenue.toLocaleString()}</p>}
          </CardContent>
        </Card>
        
        <Card className="shadow-none border-gray-200 bg-white rounded-xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1">
              <Receipt className="h-3 w-3 text-blue-500 shrink-0" /> <span className="truncate">Invoices</span>
            </p>
            {loading ? <Skeleton className="h-6 w-12" /> : <p className="text-lg sm:text-xl font-black text-gray-900 truncate">{metrics.invoiceCount}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-none border-gray-200 bg-white rounded-xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-amber-500 shrink-0" /> <span className="truncate">Avg Order</span>
            </p>
            {loading ? <Skeleton className="h-6 w-16" /> : <p className="text-lg sm:text-xl font-black text-gray-900 truncate">₹{metrics.avgOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-none border-emerald-200 bg-emerald-50/50 rounded-xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[9px] sm:text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1">
              <CreditCard className="h-3 w-3 shrink-0" /> <span className="truncate">Top Mode</span>
            </p>
            {loading ? <Skeleton className="h-6 w-16" /> : <p className="text-lg sm:text-xl font-black text-emerald-800 truncate">{metrics.topPaymentMode}</p>}
          </CardContent>
        </Card>
      </div>

      {/* DATA TABLE */}
      <Card className="shadow-sm border-border bg-white rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow className="hover:bg-transparent border-gray-200">
                <TableHead className="h-10 text-[11px] font-bold uppercase tracking-widest text-gray-500 px-4">Invoice</TableHead>
                <TableHead className="h-10 text-[11px] font-bold uppercase tracking-widest text-gray-500">Customer</TableHead>
                <TableHead className="h-10 text-[11px] font-bold uppercase tracking-widest text-gray-500 hidden sm:table-cell">Location</TableHead>
                <TableHead className="h-10 text-[11px] font-bold uppercase tracking-widest text-gray-500 text-center">Mode</TableHead>
                <TableHead className="h-10 text-[11px] font-bold uppercase tracking-widest text-gray-500 text-right pr-4 sm:pr-6">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-gray-100">
                    <TableCell className="px-4 py-3"><Skeleton className="h-4 w-20" /><Skeleton className="h-3 w-24 mt-1.5" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-12 mx-auto rounded-full" /></TableCell>
                    <TableCell className="pr-4 sm:pr-6"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-gray-400">
                    <Receipt className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-bold uppercase tracking-widest">No sales records</p>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((inv) => {
                  // Find Warehouse Name safely
                  const wName = warehouses.find(w => w.id === inv.warehouse_id)?.name || '--'

                  return (
                    <TableRow key={inv.id} className="hover:bg-gray-50/50 transition-colors border-gray-100">
                      <TableCell className="px-4 py-2.5 sm:py-3">
                        <div className="font-mono text-[13px] font-black text-gray-900">{inv.invoice_number}</div>
                        <div className="text-[10px] text-gray-400 font-bold tracking-tighter">{format(new Date(inv.created_at), 'dd MMM yy, HH:mm')}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-bold text-gray-700">{inv.customers?.full_name || 'Walk-in'}</div>
                        <div className="text-[10px] text-gray-400 font-medium">{inv.customers?.phone || '--'}</div>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 font-medium hidden sm:table-cell">
                        {wName}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="px-2 py-0.5 rounded text-[9px] font-black bg-gray-100 text-gray-600 uppercase tracking-widest">
                          {inv.payment_mode || 'Cash'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-black text-emerald-600 pr-4 sm:pr-6 text-[13px] sm:text-sm">
                        ₹{inv.final_total?.toLocaleString() || '0'}
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