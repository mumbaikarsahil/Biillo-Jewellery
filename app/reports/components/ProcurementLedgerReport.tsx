"use client"

import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { 
  Download, Filter, Loader2, Search, 
  RefreshCw, ShoppingCart, CreditCard, Receipt, Building2, FileText
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

export function ProcurementLedgerReport() {
  const { appUser } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  
  // Mobile UI Toggle
  const [showFilters, setShowFilters] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  const [metrics, setMetrics] = useState({
    totalProcurement: 0,
    totalPaid: 0,
    invoiceCount: 0,
    netBalance: 0
  })

  // Fetch Suppliers
  useEffect(() => {
    async function fetchSuppliers() {
      if (!appUser?.company_id) return
      const { data } = await supabase.from('suppliers')
        .select('id, supplier_name')
        .eq('company_id', appUser.company_id)
        .eq('is_active', true)
      if (data) setSuppliers(data)
    }
    fetchSuppliers()
  }, [appUser])

  const fetchData = async () => {
    if (!appUser?.company_id) return
    setLoading(true)

    try {
      // Fetch Invoices
      let invQ = supabase.from('purchase_invoices')
        .select(`
          id, invoice_number, invoice_date, total_payable, status,
          suppliers(supplier_name)
        `)
        .eq('company_id', appUser.company_id)
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate)
        .order('invoice_date', { ascending: false })

      // Fetch Payments (to calculate total paid in this period)
      let payQ = supabase.from('supplier_payments')
        .select('amount, status')
        .eq('company_id', appUser.company_id)
        .gte('payment_date', startDate)
        .lte('payment_date', endDate)

      if (filterSupplier !== 'all') {
        invQ = invQ.eq('supplier_id', filterSupplier)
        payQ = payQ.eq('supplier_id', filterSupplier)
      }
      if (filterStatus !== 'all') invQ = invQ.eq('status', filterStatus)
      if (search.trim()) invQ = invQ.ilike('invoice_number', `%${search.trim()}%`)

      const [invRes, payRes] = await Promise.all([invQ, payQ])
      
      if (invRes.error) throw invRes.error
      if (payRes.error) throw payRes.error

      setData(invRes.data || [])

      // Calculate Metrics
      let procurement = 0
      let payments = 0

      invRes.data?.forEach(inv => {
        if (inv.status === 'confirmed') procurement += (Number(inv.total_payable) || 0)
      })

      payRes.data?.forEach(pay => {
        if (pay.status === 'posted') payments += (Number(pay.amount) || 0)
      })

      setMetrics({
        totalProcurement: procurement,
        totalPaid: payments,
        invoiceCount: invRes.data?.length || 0,
        netBalance: procurement - payments
      })

    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const delay = setTimeout(() => { fetchData() }, 300)
    return () => clearTimeout(delay)
  }, [appUser, filterSupplier, filterStatus, startDate, endDate, search])

  const handleExport = () => {
    if (data.length === 0) {
      toast({ title: "Empty Data", description: "No records to export.", variant: "destructive" })
      return
    }
    setExporting(true)

    const formattedData = data.map((d) => ({
      'Invoice No': d.invoice_number,
      'Date': d.invoice_date ? format(new Date(d.invoice_date), 'dd-MMM-yyyy') : '--',
      'Supplier': d.suppliers?.supplier_name || '--',
      'Total Payable (₹)': d.total_payable || 0,
      'Status': (d.status || 'UNKNOWN').toUpperCase()
    }))

    const worksheet = XLSX.utils.json_to_sheet(formattedData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Procurement_Ledger")

    XLSX.writeFile(workbook, `Procurement_Ledger_${startDate}_to_${endDate}.xlsx`)
    
    setExporting(false)
    toast({ title: "Export Complete", description: "Procurement ledger downloaded securely." })
  }

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase tracking-widest">Confirmed</span>
      case 'cancelled': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 uppercase tracking-widest">Cancelled</span>
      case 'draft': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200 uppercase tracking-widest">Draft</span>
      default: return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-500 border border-zinc-200 uppercase tracking-widest">{status}</span>
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      
      {/* MOBILE-FIRST CAPSULE FILTERS */}
      <div className="flex flex-col gap-2.5 bg-white p-2.5 rounded-2xl border border-zinc-200 shadow-sm print:hidden">
        
        <div className="flex items-center gap-2 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input 
              placeholder="Search Invoice..." 
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

        <div className={`flex-col sm:flex-row flex-wrap items-center gap-2 ${showFilters ? 'flex' : 'hidden sm:flex'} animate-in slide-in-from-top-2 duration-200`}>
          
          <div className="flex w-full sm:w-auto items-center bg-zinc-50 border border-zinc-200 rounded-full px-3 h-9 focus-within:border-zinc-400 transition-colors min-w-0">
            <Receipt className="w-3.5 h-3.5 text-zinc-400 shrink-0 mr-1.5" />
            <input type="date" className="bg-transparent text-[11px] font-mono font-medium outline-none flex-1 min-w-0 text-zinc-700" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-zinc-300 text-[10px] uppercase font-bold mx-1 shrink-0">-</span>
            <input type="date" className="bg-transparent text-[11px] font-mono font-medium outline-none flex-1 min-w-0 text-right text-zinc-700" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          <div className="flex w-full sm:w-auto gap-2">
            <Select value={filterSupplier} onValueChange={setFilterSupplier}>
              <SelectTrigger className="h-9 text-[11px] font-bold bg-zinc-50 border-zinc-200 rounded-full flex-1 sm:w-[160px] focus:ring-0">
                <Building2 className="w-3 h-3 mr-1.5 text-zinc-500" />
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl border-zinc-200">
                <SelectItem value="all" className="text-xs font-medium rounded-lg">All Suppliers</SelectItem>
                {suppliers.map(s => <SelectItem key={s.id} value={s.id} className="text-xs font-medium rounded-lg">{s.supplier_name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 text-[11px] font-bold bg-zinc-50 border-zinc-200 rounded-full flex-1 sm:w-[130px] focus:ring-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl border-zinc-200">
                <SelectItem value="all" className="text-xs font-medium rounded-lg">All Statuses</SelectItem>
                <SelectItem value="draft" className="text-xs font-medium rounded-lg">Draft</SelectItem>
                <SelectItem value="confirmed" className="text-xs font-medium rounded-lg">Confirmed</SelectItem>
                <SelectItem value="cancelled" className="text-xs font-medium rounded-lg">Cancelled</SelectItem>
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
              <ShoppingCart className="h-3.5 w-3.5 text-zinc-400" /> Total Procurement
            </p>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1 truncate">₹{metrics.totalProcurement.toLocaleString()}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-emerald-200 bg-emerald-50/30 rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-emerald-600 mb-1 flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> Total Paid
            </p>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-emerald-900 mt-1 truncate">₹{metrics.totalPaid.toLocaleString()}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-zinc-400" /> Invoices
            </p>
            {loading ? <Skeleton className="h-8 w-12 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">{metrics.invoiceCount}</p>}
          </CardContent>
        </Card>

        <Card className={`shadow-sm rounded-2xl border ${metrics.netBalance > 0 ? 'border-amber-200 bg-amber-50/30' : 'border-zinc-200 bg-zinc-50'}`}>
          <CardContent className="p-4 sm:p-5">
            <p className={`text-[11px] font-medium mb-1 ${metrics.netBalance > 0 ? 'text-amber-600' : 'text-zinc-600'}`}>Net Period Balance</p>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className={`text-2xl sm:text-3xl font-semibold tracking-tighter mt-1 truncate ${metrics.netBalance > 0 ? 'text-amber-900' : 'text-zinc-900'}`}>₹{metrics.netBalance.toLocaleString()}</p>}
          </CardContent>
        </Card>
      </div>

      {/* DATA VIEW (Responsive: List on Mobile, Table on Desktop) */}
      <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden">
        
        {/* === MOBILE LIST VIEW === */}
        <div className="block sm:hidden divide-y divide-zinc-100">
          {loading ? (
             Array.from({ length: 5 }).map((_, i) => (
               <div key={i} className="p-4 space-y-3">
                 <div className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-5 w-16 rounded-full" /></div>
                 <div className="flex justify-between"><Skeleton className="h-3 w-32" /><Skeleton className="h-3 w-16" /></div>
               </div>
             ))
          ) : data.length === 0 ? (
            <div className="py-12 text-center text-zinc-400">
              <ShoppingCart className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold tracking-tight">No invoices found</p>
            </div>
          ) : (
            data.map((inv) => (
              <div key={inv.id} className="p-4 hover:bg-zinc-50 transition-colors">
                <div className="flex justify-between items-start mb-2.5">
                  <div>
                    <div className="font-mono text-[13px] font-bold text-zinc-900 tracking-tight">{inv.invoice_number}</div>
                    <div className="text-[11px] font-medium text-zinc-500 mt-0.5 flex items-center gap-1.5">
                      <Building2 className="h-3 w-3 text-zinc-400" />
                      {inv.suppliers?.supplier_name || 'Unknown Supplier'}
                    </div>
                  </div>
                  <div>{getStatusBadge(inv.status)}</div>
                </div>
                
                <div className="flex justify-between items-end mt-3 pt-3 border-t border-zinc-100/80">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Date</p>
                    <p className="text-xs font-semibold text-zinc-800">{inv.invoice_date ? format(new Date(inv.invoice_date), 'dd MMM yyyy') : '--'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Total Payable</p>
                    <p className="text-sm font-bold text-zinc-900 tracking-tight">₹{inv.total_payable?.toLocaleString() || '0'}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* === DESKTOP TABLE VIEW === */}
        <div className="hidden sm:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50/80">
              <TableRow className="hover:bg-transparent border-zinc-200">
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4">Invoice No</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Date</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Supplier</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-center">Status</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right pr-6">Total Payable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-zinc-100">
                    <TableCell className="px-4 py-3"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-16 mx-auto rounded-full" /></TableCell>
                    <TableCell className="pr-6"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center text-zinc-400">
                    <ShoppingCart className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-semibold tracking-tight">No invoices found</p>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-zinc-50/50 transition-colors border-zinc-100">
                    <TableCell className="px-4 py-3">
                      <div className="font-mono text-[13px] font-semibold text-zinc-900 tracking-tight">{inv.invoice_number}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-[13px] font-medium text-zinc-600">{inv.invoice_date ? format(new Date(inv.invoice_date), 'dd MMM yyyy') : '--'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-[13px] font-semibold text-zinc-800">{inv.suppliers?.supplier_name || '--'}</div>
                    </TableCell>
                    <TableCell className="text-center">{getStatusBadge(inv.status)}</TableCell>
                    <TableCell className="text-right text-[13px] font-semibold text-zinc-900 pr-6">
                      ₹{inv.total_payable?.toLocaleString() || '0'}
                    </TableCell>
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