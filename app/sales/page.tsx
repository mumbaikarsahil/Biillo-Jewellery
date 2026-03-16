'use client'

import React, { useEffect, useState, useRef } from 'react'
import { format } from 'date-fns'
import { useReactToPrint } from 'react-to-print'
import { 
  FileText, TrendingUp, Printer, Store, RefreshCw, Download, 
  Filter, Calendar, CreditCard, Search, ChevronRight, Landmark,
  Scale, BookOpen, Receipt
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
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; // Default to 1st of month
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [search, setSearch] = useState('')

  const [invoices, setInvoices] = useState<any[]>([])
  
  // Financial KPIs
  const [kpis, setKpis] = useState({
    grossSales: 0,
    taxCollected: 0,
    b2bSales: 0,
    b2cSales: 0
  })

  const printRef = useRef<HTMLDivElement>(null)
  const [invoiceToPrint, setInvoiceToPrint] = useState<any>(null)
  const [isPrinting, setIsPrinting] = useState(false)
  const triggerPrint = useReactToPrint({ contentRef: printRef })

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

      // GST/Accounting Math Logic (Estimated based on 3% GST standard for jewelry)
      let gross = 0
      let tax = 0
      let b2b = 0
      let b2c = 0

      data?.forEach(inv => {
        const total = Number(inv.final_total) || 0
        gross += total
        // Rough estimation: Reverse calculation of 3% GST (Total = Base * 1.03)
        const baseValue = total / 1.03
        tax += (total - baseValue)

        // If customer has PAN/GSTIN, it's usually B2B, otherwise B2C
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

  const handleReprint = async (invoiceId: string) => {
    setIsPrinting(true)
    try {
      const { data: invData, error } = await supabase
        .from('invoices')
        .select(`*, customers (*), invoice_items (rate, inventory_items (*))`)
        .eq('id', invoiceId)
        .single()

      if (error) throw error
      setInvoiceToPrint({
        invoice_number: invData.invoice_number,
        date: invData.created_at,
        customer: invData.customers, 
        subtotal: invData.subtotal,
        discountAmount: invData.discount_amount,
        finalTotal: invData.final_total,
        items: invData.invoice_items.map((i: any) => ({ mrp: i.rate, barcode: i.inventory_items?.barcode }))
      })
      setTimeout(() => { triggerPrint(); setIsPrinting(false) }, 300)
    } catch (err) {
      toast.error('Reprint failed')
      setIsPrinting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50/50 font-sans">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-zinc-200 px-4 h-14 flex items-center justify-between shadow-sm print:hidden">
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
        
        {/* MOBILE-FIRST CAPSULE FILTERS */}
        <div className="flex flex-col gap-2.5 bg-white p-2.5 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <Input 
                placeholder="Search Txn/Invoice..." 
                className="pl-9 h-9 text-xs rounded-full bg-zinc-50 border-zinc-200 focus-visible:ring-zinc-400 font-medium text-zinc-800" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
            </div>
            
            <Button 
              variant={showFilters ? "default" : "outline"} 
              size="icon" 
              className={`h-9 w-9 rounded-full sm:hidden shrink-0 transition-colors ${showFilters ? 'bg-zinc-900 text-white' : 'border-zinc-200 text-zinc-600'}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
            </Button>

            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-zinc-200 shrink-0 hidden sm:flex text-zinc-600" onClick={fetchAccountingData}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button className="h-9 text-xs font-medium rounded-full hidden sm:flex shrink-0 text-zinc-700 border border-zinc-200 bg-white shadow-sm">
              <Download className="mr-2 h-3.5 w-3.5" /> Export Data
            </Button>
          </div>

          <div className={`flex-col sm:flex-row flex-wrap items-center gap-2 ${showFilters ? 'flex' : 'hidden sm:flex'} animate-in slide-in-from-top-2 duration-200`}>
            
            <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
              <SelectTrigger className="h-9 text-[11px] font-bold bg-zinc-50 border-zinc-200 rounded-full w-full sm:w-[150px]">
                <Store className="w-3 h-3 mr-1.5 text-zinc-500" />
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl border-zinc-200">
                <SelectItem value="all" className="text-xs font-medium rounded-lg">Global Scope</SelectItem>
                {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs font-medium rounded-lg">{w.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="flex w-full sm:w-auto items-center bg-zinc-50 border border-zinc-200 rounded-full px-3 h-9 focus-within:border-zinc-400 min-w-0">
              <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0 mr-1.5" />
              <input type="date" className="bg-transparent text-[11px] font-mono font-medium outline-none flex-1 min-w-0 text-zinc-700" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <span className="text-zinc-300 text-[10px] uppercase font-bold mx-1 shrink-0">-</span>
              <input type="date" className="bg-transparent text-[11px] font-mono font-medium outline-none flex-1 min-w-0 text-right text-zinc-700" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>

        {/* ACCOUNTING KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-zinc-400" /> Gross Value (incl. GST)
              </p>
              {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">₹{kpis.grossSales.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-emerald-200 bg-emerald-50/40 rounded-2xl">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[11px] font-medium text-emerald-700 mb-1 flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5" /> Est. Tax Liability
              </p>
              {loading ? <Skeleton className="h-8 w-20 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-emerald-900 mt-1">₹{kpis.taxCollected.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-zinc-400" /> B2B Transactions
              </p>
              {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">₹{kpis.b2bSales.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-zinc-400" /> B2C Transactions
              </p>
              {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">₹{kpis.b2cSales.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
            </CardContent>
          </Card>
        </div>

        {/* ACCOUNTING TABS */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="w-full overflow-x-auto no-scrollbar pb-2">
            <TabsList className="bg-transparent border-none p-0 h-auto flex justify-start w-max gap-2">
              <TabsTrigger value="sales_register" className="rounded-full h-9 text-xs font-bold px-4 py-0 bg-white border border-zinc-200 data-[state=active]:bg-zinc-900 data-[state=active]:text-white transition-all shrink-0">
                Sales Register (GSTR-1)
              </TabsTrigger>
              <TabsTrigger value="purchase_register" className="rounded-full h-9 text-xs font-bold px-4 py-0 bg-white border border-zinc-200 data-[state=active]:bg-zinc-900 data-[state=active]:text-white transition-all shrink-0">
                Purchase Register (GSTR-2)
              </TabsTrigger>
              <TabsTrigger value="tax_summary" className="rounded-full h-9 text-xs font-bold px-4 py-0 bg-white border border-zinc-200 data-[state=active]:bg-zinc-900 data-[state=active]:text-white transition-all shrink-0">
                Tax Summary (GSTR-3B)
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="sales_register" className="m-0 pt-2">
            <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden">
              
              {/* MOBILE LIST VIEW */}
              <div className="block sm:hidden divide-y divide-zinc-100">
                {loading ? (
                  <div className="p-4"><Skeleton className="h-12 w-full" /></div>
                ) : invoices.length === 0 ? (
                  <div className="py-12 text-center text-zinc-400">
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
                      <div key={inv.id} className="p-4 hover:bg-zinc-50">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-mono text-[13px] font-bold text-zinc-900">{inv.invoice_number}</div>
                            <div className="text-[11px] text-zinc-500 font-medium mt-0.5">{format(new Date(inv.created_at), 'dd MMM yyyy')}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${isB2B ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-zinc-100 text-zinc-600 border border-zinc-200'}`}>
                            {isB2B ? 'B2B' : 'B2C'}
                          </span>
                        </div>
                        <div className="flex justify-between items-end pt-3 border-t border-zinc-100">
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Customer</p>
                            <p className="text-xs font-semibold text-zinc-800">{inv.customers?.full_name || 'Walk-in'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Taxable + GST</p>
                            <p className="text-sm font-bold text-zinc-900 tracking-tight">
                              ₹{base.toLocaleString(undefined, {maximumFractionDigits:0})} + <span className="text-emerald-600">₹{tax.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                            </p>
                          </div>
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
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900" onClick={() => handleReprint(inv.id)}>
                              <Printer className="h-4 w-4" />
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
        
        <InvoicePrintTemplate ref={printRef} data={invoiceToPrint} />
      </main>

      <style dangerouslySetInnerHTML={{__html:`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  )
}