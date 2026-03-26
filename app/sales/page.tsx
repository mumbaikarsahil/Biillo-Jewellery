'use client'

import React, { useEffect, useState, useRef } from 'react'
import { format } from 'date-fns'
import { useReactToPrint } from 'react-to-print'
import { 
  FileText, TrendingUp, Printer, Store, RefreshCw, Download, 
  Filter, Calendar, Search, ChevronRight, Landmark,
  Scale, BookOpen, Receipt, Eye
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { InvoicePrintTemplate } from '@/components/InvoicePrintTemplate'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

// Explicit Table imports for custom Vercel-style rendering
import {
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow
} from '@/components/ui/table'

export default function AccountsMasterPage() {
  const { appUser } = useAuth()
  
  // States
  const [activeTab, setActiveTab] = useState("sales_register")
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('all')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; 
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [search, setSearch] = useState('')

  const [invoices, setInvoices] = useState<any[]>([])
  
  // Financial KPIs
  const [kpis, setKpis] = useState({ grossSales: 0, taxCollected: 0, b2bSales: 0, b2cSales: 0 })

  // --- PRINT & PREVIEW STATE ---
  const printRef = useRef<HTMLDivElement>(null)
  const [invoiceToPrint, setInvoiceToPrint] = useState<any>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [isFetchingPreview, setIsFetchingPreview] = useState(false)
  
  const triggerPrint = useReactToPrint({ 
    contentRef: printRef,
    documentTitle: `Invoice-${invoiceToPrint?.invoice_number || 'Doc'}` 
  })

  useEffect(() => {
    const fetchWarehouses = async () => {
      if (!appUser?.company_id) return
      const { data } = await supabase.from('warehouses').select('id, name').eq('company_id', appUser.company_id)
      if (data) setWarehouses(data)
    }
    fetchWarehouses()
  }, [appUser])

  const fetchAccountingData = async () => {
    if (!appUser?.company_id) return
    setLoading(true)
    try {
      const safeEndDate = new Date(endDate)
      safeEndDate.setDate(safeEndDate.getDate() + 1)
      const safeEndDateStr = safeEndDate.toISOString().split('T')[0]

      let query = supabase
        .from('invoices')
        .select(`*, customers(full_name, pan_no)`)
        .eq('company_id', appUser.company_id)
        .gte('created_at', startDate)
        .lt('created_at', safeEndDateStr)
        .order('created_at', { ascending: false })

      if (selectedWarehouseId !== 'all') query = query.eq('warehouse_id', selectedWarehouseId)
      if (search.trim()) query = query.ilike('invoice_number', `%${search.trim()}%`)

      const { data, error } = await query
      if (error) throw error

      setInvoices(data || [])

      let gross = 0; let tax = 0; let b2b = 0; let b2c = 0;

      data?.forEach(inv => {
        const total = Number(inv.final_total) || 0
        gross += total
        const baseValue = total / 1.03
        tax += (total - baseValue)

        if (inv.customers?.pan_no) b2b += total
        else b2c += total
      })

      setKpis({ grossSales: gross, taxCollected: tax, b2bSales: b2b, b2cSales: b2c })

    } catch (err: any) {
      toast.error("Failed to load accounting data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const delay = setTimeout(() => { fetchAccountingData() }, 300)
    return () => clearTimeout(delay)
  }, [appUser, selectedWarehouseId, startDate, endDate, search])

  // --- FETCH & OPEN PREVIEW MODAL (Bulletproof Mapping) ---
  const handleOpenPreview = async (invoiceId: string) => {
    setIsFetchingPreview(true)
    try {
      const { data: invData, error } = await supabase
        .from('invoices')
        .select(`*, customers (*), invoice_items (rate, inventory_items (*))`)
        .eq('id', invoiceId)
        .single()

      if (error) throw error

      // Safely map the nested relational data to prevent rendering crashes
      const safeItems = invData.invoice_items?.map((i: any) => {
        const itemObj = i.inventory_items || {}
        return { 
          mrp: i.rate || itemObj.mrp || 0, 
          barcode: itemObj.barcode || 'N/A',
          item_category: itemObj.item_category || 'Jewellery',
          metal_type: itemObj.metal_type || '-',
          purity: itemObj.purity_karat || '-',
          hsn_code: itemObj.hsn_code || '7113',
          gross_wt: itemObj.gross_weight_g || 0,
          net_wt: itemObj.net_weight_g || 0,
          dia_wt: itemObj.total_stone_weight_cts || 0
        }
      }) || []

      const mappedData = {
        mode: 'normal',
        invoice_number: invData.invoice_number,
        date: invData.created_at,
        customer: invData.customers, 
        subtotal: invData.subtotal,
        discountAmount: invData.discount_amount,
        taxableValue: invData.taxable_value,
        cgstAmount: invData.cgst_amount,
        sgstAmount: invData.sgst_amount,
        exchangeValue: invData.exchange_value,
        voucherAmount: invData.voucher_discount,
        finalTotal: invData.final_total,
        items: safeItems
      }

      setInvoiceToPrint(mappedData)
      setShowPreviewModal(true)
    } catch (err) {
      toast.error('Failed to retrieve full ledger details')
    } finally {
      setIsFetchingPreview(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50/50 font-sans pb-20 sm:pb-0">
      
      {/* HEADER */}
      <header className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur-md border-b border-zinc-200 px-4 h-14 flex items-center justify-between shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-zinc-900 flex items-center justify-center">
            <Landmark className="h-4 w-4 text-white" />
          </div>
          <Separator orientation="vertical" className="h-5 bg-zinc-200 hidden sm:block" />
          <nav className="flex items-center gap-1.5 text-sm font-medium">
            <span className="text-zinc-500">Finance & Accounts</span>
            <ChevronRight className="h-4 w-4 text-zinc-400" />
            <span className="font-semibold text-zinc-900 tracking-tight">Tax & Ledgers</span>
          </nav>
        </div>
      </header>

      <main className="p-3 sm:p-6 md:p-8 max-w-[1400px] w-full mx-auto space-y-5 animate-in fade-in duration-500">
        
        {/* MOBILE-OPTIMIZED FILTERS */}
        <div className="flex flex-col gap-2.5 bg-white p-3 sm:p-2.5 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input 
                placeholder="Search Txn/Invoice..." 
                className="pl-9 h-10 sm:h-9 text-sm sm:text-xs rounded-xl sm:rounded-full bg-zinc-50 border-zinc-200 focus-visible:ring-zinc-400 font-medium text-zinc-800" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
            </div>
            
            <Button 
              variant={showFilters ? "default" : "outline"} 
              size="icon" 
              className={`h-10 w-10 sm:h-9 sm:w-9 rounded-xl sm:rounded-full sm:hidden shrink-0 transition-colors ${showFilters ? 'bg-zinc-900 text-white' : 'border-zinc-200 text-zinc-600'}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
            </Button>

            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-zinc-200 shrink-0 hidden sm:flex text-zinc-600 hover:bg-zinc-100" onClick={fetchAccountingData}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button className="h-9 text-xs font-medium rounded-full hidden sm:flex shrink-0 text-zinc-700 border border-zinc-200 bg-white hover:bg-zinc-50 shadow-sm">
              <Download className="mr-2 h-3.5 w-3.5" /> Export Data
            </Button>
          </div>

          <div className={`flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 ${showFilters ? 'flex' : 'hidden sm:flex'} animate-in slide-in-from-top-2 duration-200`}>
            <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
              <SelectTrigger className="h-10 sm:h-9 text-xs sm:text-[11px] font-bold bg-zinc-50 border-zinc-200 rounded-xl sm:rounded-full w-full sm:w-[150px]">
                <Store className="w-4 h-4 sm:w-3 sm:h-3 mr-1.5 text-zinc-500" />
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl border-zinc-200">
                <SelectItem value="all" className="text-xs font-medium rounded-lg">Global Scope</SelectItem>
                {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs font-medium rounded-lg">{w.name}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Fully Responsive Stacked Date Picker for Mobile */}
            <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center bg-zinc-50 border border-zinc-200 rounded-xl sm:rounded-full px-3 py-2 sm:py-0 sm:h-9 focus-within:border-zinc-400 min-w-0 gap-2 sm:gap-0">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-zinc-400 shrink-0 mr-1.5" />
                <span className="text-[10px] font-bold text-zinc-400 uppercase sm:hidden w-12">From</span>
                <input type="date" className="bg-transparent text-sm sm:text-[11px] font-mono font-medium outline-none flex-1 text-zinc-700 w-full" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <span className="text-zinc-300 text-[10px] uppercase font-bold mx-1 shrink-0 hidden sm:block">-</span>
              <div className="flex items-center border-t border-zinc-200 pt-2 sm:pt-0 sm:border-t-0">
                 <span className="text-[10px] font-bold text-zinc-400 uppercase sm:hidden w-12 pl-5 sm:pl-0">To</span>
                 <input type="date" className="bg-transparent text-sm sm:text-[11px] font-mono font-medium outline-none flex-1 text-right sm:text-left text-zinc-700 w-full" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* ACCOUNTING KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-zinc-400" /> Gross Value (inc. GST)
              </p>
              {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">₹{kpis.grossSales.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-emerald-200 bg-emerald-50/40 rounded-2xl">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[10px] sm:text-[11px] font-medium text-emerald-700 mb-1 flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5" /> Est. Tax Liability
              </p>
              {loading ? <Skeleton className="h-8 w-20 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-emerald-900 mt-1">₹{kpis.taxCollected.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-zinc-400" /> B2B Activity
              </p>
              {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">₹{kpis.b2bSales.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-zinc-400" /> B2C Activity
              </p>
              {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">₹{kpis.b2cSales.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
            </CardContent>
          </Card>
        </div>

        {/* ACCOUNTING TABS */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="w-full overflow-x-auto no-scrollbar pb-2">
            <TabsList className="bg-transparent border-none p-0 h-auto flex justify-start w-max gap-2">
              <TabsTrigger value="sales_register" className="rounded-full h-9 sm:h-10 text-xs sm:text-sm font-bold px-5 py-0 bg-white border border-zinc-200 data-[state=active]:bg-zinc-900 data-[state=active]:text-white transition-all shrink-0 shadow-sm">
                Sales Register (GSTR-1)
              </TabsTrigger>
              <TabsTrigger value="purchase_register" className="rounded-full h-9 sm:h-10 text-xs sm:text-sm font-bold px-5 py-0 bg-white border border-zinc-200 data-[state=active]:bg-zinc-900 data-[state=active]:text-white transition-all shrink-0 shadow-sm">
                Purchase Register (GSTR-2)
              </TabsTrigger>
              <TabsTrigger value="tax_summary" className="rounded-full h-9 sm:h-10 text-xs sm:text-sm font-bold px-5 py-0 bg-white border border-zinc-200 data-[state=active]:bg-zinc-900 data-[state=active]:text-white transition-all shrink-0 shadow-sm">
                Tax Summary (GSTR-3B)
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="sales_register" className="m-0 pt-2">
            <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden">
              
              {/* MOBILE LIST VIEW (Richer & Clearer) */}
              <div className="block sm:hidden divide-y divide-zinc-100 bg-zinc-50/50">
                {loading ? (
                  <div className="p-4"><Skeleton className="h-24 w-full rounded-xl" /></div>
                ) : invoices.length === 0 ? (
                  <div className="py-12 text-center text-zinc-400 bg-white">
                    <FileText className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-semibold tracking-tight">No transactions found</p>
                  </div>
                ) : (
                  invoices.map((inv) => {
                    const total = Number(inv.final_total) || 0
                    const base = total / 1.03
                    const tax = total - base
                    const isB2B = !!inv.customers?.pan_no

                    return (
                      <div key={inv.id} className="p-4 bg-white m-2 rounded-xl shadow-sm border border-zinc-100">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-mono text-sm font-bold text-zinc-900 tracking-tight">{inv.invoice_number}</div>
                            <div className="text-[11px] text-zinc-500 font-medium mt-0.5">{format(new Date(inv.created_at), 'dd MMM yyyy, HH:mm')}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${isB2B ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-zinc-100 text-zinc-600 border border-zinc-200'}`}>
                            {isB2B ? 'B2B' : 'B2C'}
                          </span>
                        </div>
                        
                        <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-100 mb-3 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Customer</span>
                            <span className="text-xs font-semibold text-zinc-800">{inv.customers?.full_name || 'Walk-in Consumer'}</span>
                          </div>
                          <div className="flex justify-between border-t border-zinc-200 pt-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Taxable Value</span>
                            <span className="text-xs font-bold text-zinc-700">₹{base.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/70">GST Applied</span>
                            <span className="text-xs font-bold text-emerald-600">+ ₹{tax.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center mt-2">
                           <div className="flex flex-col">
                             <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Net Invoice Total</span>
                             <span className="text-lg font-black text-zinc-900 leading-tight">₹{total.toLocaleString()}</span>
                           </div>
                           <Button variant="secondary" size="sm" className="h-9 px-4 text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg" onClick={() => handleOpenPreview(inv.id)}>
                             <Eye className="h-4 w-4 mr-1.5" /> View
                           </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* DESKTOP TABLE VIEW */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader className="bg-zinc-50/80">
                    <TableRow className="hover:bg-transparent border-zinc-200">
                      <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4">Date</TableHead>
                      <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Invoice No</TableHead>
                      <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Customer / Party</TableHead>
                      <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-center">Type</TableHead>
                      <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right">Taxable Amt</TableHead>
                      <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right">GST Amt</TableHead>
                      <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right">Invoice Total</TableHead>
                      <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-center pr-4">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => {
                      const total = Number(inv.final_total) || 0
                      const base = total / 1.03
                      const tax = total - base
                      const isB2B = !!inv.customers?.pan_no

                      return (
                        <TableRow key={inv.id} className="border-zinc-100">
                          <TableCell className="px-4 text-[13px] font-medium text-zinc-600">{format(new Date(inv.created_at), 'dd MMM yy')}</TableCell>
                          <TableCell className="font-mono text-[13px] font-semibold text-zinc-900">{inv.invoice_number}</TableCell>
                          <TableCell className="text-[13px] font-semibold text-zinc-800">{inv.customers?.full_name || 'Walk-in Consumer'}</TableCell>
                          <TableCell className="text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${isB2B ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-zinc-100 text-zinc-600 border border-zinc-200'}`}>
                              {isB2B ? 'B2B' : 'B2C'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-[13px] font-medium text-zinc-600">₹{base.toLocaleString(undefined, {maximumFractionDigits:0})}</TableCell>
                          <TableCell className="text-right text-[13px] font-medium text-emerald-600">₹{tax.toLocaleString(undefined, {maximumFractionDigits:0})}</TableCell>
                          <TableCell className="text-right text-[13px] font-bold text-zinc-900">₹{total.toLocaleString()}</TableCell>
                          <TableCell className="text-center pr-4">
                            <Button variant="outline" size="sm" className="h-8 px-3 text-xs font-semibold text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-md" onClick={() => handleOpenPreview(inv.id)}>
                              <Eye className="h-3.5 w-3.5 mr-1.5" /> View
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* Placeholders for future implementation */}
          <TabsContent value="purchase_register" className="m-0 pt-2">
            <div className="py-20 border border-dashed border-zinc-300 bg-white rounded-2xl flex flex-col items-center justify-center text-zinc-400">
              <BookOpen className="h-10 w-10 mb-3 opacity-20" />
              <h3 className="text-sm font-semibold tracking-tight text-zinc-600 mb-1">Purchase Register (GSTR-2)</h3>
              <p className="text-[11px] font-medium">Inward supply and Input Tax Credit (ITC) data will appear here.</p>
            </div>
          </TabsContent>

          <TabsContent value="tax_summary" className="m-0 pt-2">
            <div className="py-20 border border-dashed border-zinc-300 bg-white rounded-2xl flex flex-col items-center justify-center text-zinc-400">
              <Scale className="h-10 w-10 mb-3 opacity-20" />
              <h3 className="text-sm font-semibold tracking-tight text-zinc-600 mb-1">Monthly Tax Summary (GSTR-3B)</h3>
              <p className="text-[11px] font-medium">Auto-calculated offsets between Output Tax and ITC.</p>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* --- FULL-SCREEN MOBILE & MODAL DESKTOP PREVIEW --- */}
        <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
          <DialogContent className="max-w-[850px] w-full h-[100dvh] sm:h-[90vh] sm:w-[95vw] border-0 sm:border border-zinc-200 shadow-2xl p-0 rounded-none sm:rounded-xl bg-zinc-100 flex flex-col m-0 sm:m-auto">
            <DialogTitle className="sr-only">Invoice Document Preview</DialogTitle>
            
            <DialogHeader className="p-3 sm:p-5 border-b border-zinc-200 bg-white shrink-0 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-900">
                <FileText className="w-5 h-5 text-indigo-600" />
                <span className="text-sm sm:text-base font-bold">Ledger Document</span>
              </div>
              <Button variant="ghost" size="icon" className="sm:hidden text-zinc-500" onClick={() => setShowPreviewModal(false)}>
                 <span className="text-xs font-bold uppercase tracking-widest">X</span>
              </Button>
            </DialogHeader>
            
            {/* Document Render Area (Allows smooth horizontal pan on mobile) */}
            <div className="flex-1 overflow-auto bg-zinc-400/20 p-2 sm:p-6 custom-scrollbar shadow-inner relative">
               {isFetchingPreview ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500">
                    <RefreshCw className="h-6 w-6 animate-spin mb-3" />
                    <span className="text-xs font-bold uppercase tracking-widest">Retrieving Document...</span>
                  </div>
               ) : invoiceToPrint ? (
                 <div className="min-w-max flex justify-center p-2 sm:p-0">
                   <div className="shadow-2xl bg-white shrink-0 border border-slate-200">
                      <InvoicePrintTemplate data={invoiceToPrint} />
                   </div>
                 </div>
               ) : null}
            </div>

            {/* Sticky Action Footer */}
            <DialogFooter className="bg-white p-4 border-t border-zinc-200 shrink-0 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 rounded-none sm:rounded-b-xl pb-safe">
              <Button 
                variant="outline" 
                className="h-12 sm:h-10 w-full sm:w-auto text-xs font-bold uppercase tracking-widest rounded-xl sm:rounded-lg border-zinc-300 text-zinc-700 hover:bg-zinc-50" 
                onClick={() => setShowPreviewModal(false)}
              >
                Close View
              </Button>
              <Button 
                onClick={triggerPrint} 
                className="h-12 sm:h-10 w-full sm:w-auto px-6 text-xs font-bold uppercase tracking-widest rounded-xl sm:rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              >
                <Printer className="h-4 w-4 mr-2" /> Print Document
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Hidden template container used exclusively by react-to-print */}
        <div className="hidden">
          <InvoicePrintTemplate ref={printRef} data={invoiceToPrint} />
        </div>

      </main>

      <style dangerouslySetInnerHTML={{__html:`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
        /* Safe Area support for newer iPhones */
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 1rem); }
      `}} />
    </div>
  )
}