'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { DataTable, Column } from '@/components/DataTable'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import { supabase } from '@/lib/supabaseClient'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useReactToPrint } from 'react-to-print'
import { 
  FileText, 
  TrendingUp, 
  Printer, 
  Store, 
  RefreshCw, 
  Download, 
  Filter, 
  Calendar,
  CreditCard,
  Search,
  ChevronRight
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

// IMPORT THE SHARED PRINT COMPONENT
import { InvoicePrintTemplate } from '@/components/InvoicePrintTemplate'

interface Invoice {
  id: string
  invoice_number: string
  customer_id: string
  final_total: number 
  exchange_value: number
  payment_mode: string
  created_at: string
}

export default function SalesPage() {
  const { appUser } = useAuth()
  
  // Warehouse State
  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all')

  // Filter States
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('all')

  // Data State
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [exchanges, setExchanges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Reprint State
  const printRef = useRef<HTMLDivElement>(null)
  const [invoiceToPrint, setInvoiceToPrint] = useState<any>(null)
  const [isPrinting, setIsPrinting] = useState(false)

  const triggerPrint = useReactToPrint({
    contentRef: printRef,
  })

  // 1. Fetch Warehouses
  useEffect(() => {
    const fetchWarehouses = async () => {
      if (!appUser) return
      const { data: whData } = await supabase
        .from('warehouses')
        .select('id, name')
        .eq('company_id', appUser.company_id)
        .eq('is_active', true)
        .order('name')

      if (whData) setWarehouses(whData)
    }
    fetchWarehouses()
  }, [appUser])

  // 2. Fetch Sales Data with Filters
  const fetchSalesData = async () => {
    if (!appUser) return
    setLoading(true)
    try {
      let query = supabase
        .from('invoices')
        .select('*')
        .eq('company_id', appUser.company_id)
        .order('created_at', { ascending: false })

      if (selectedWarehouseId !== 'all') {
        query = query.eq('warehouse_id', selectedWarehouseId)
      }
      if (startDate) query = query.gte('created_at', `${startDate}T00:00:00Z`)
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59Z`)
      if (paymentFilter !== 'all') query = query.eq('payment_mode', paymentFilter)

      const { data, error } = await query
      if (error) throw error
      setInvoices(data || [])

      // Fetch Exchanges
      let exQuery = supabase
        .from('exchange_ledger')
        .select('*, invoices(invoice_number), customers(full_name)')
        .eq('company_id', appUser.company_id)
      
      if (selectedWarehouseId !== 'all') exQuery = exQuery.eq('warehouse_id', selectedWarehouseId)
      
      const { data: exData } = await exQuery
      setExchanges(exData || [])

    } catch (err: any) {
      toast.error("Failed to load ledger data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSalesData()
  }, [appUser, selectedWarehouseId, startDate, endDate, paymentFilter])

  // --- EXPORT TO CSV ---
  const exportToCSV = () => {
    if (invoices.length === 0) return toast.error("No data to export")
    
    const headers = ["Date", "Invoice #", "Payment Mode", "Exchange Value", "Collected Total"]
    const rows = invoices.map(inv => [
      new Date(inv.created_at).toLocaleDateString(),
      inv.invoice_number,
      inv.payment_mode || 'Cash',
      inv.exchange_value || 0,
      inv.final_total
    ])

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `Sales_Report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("CSV Report Downloaded")
  }

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
        voucherAmount: invData.voucher_discount,
        finalTotal: invData.final_total,
        exchangeValue: invData.exchange_value || 0,
        items: invData.invoice_items.map((i: any) => ({
          mrp: i.rate,
          barcode: i.inventory_items?.barcode,
          net_wt: i.inventory_items?.net_weight_g || 0,
        }))
      })
      
      setTimeout(() => {
        triggerPrint()
        setIsPrinting(false)
      }, 300)
    } catch (err) {
      toast.error('Reprint failed')
      setIsPrinting(false)
    }
  }

  // --- SKELETON ---
  const TableSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-md border border-border/40" />
      ))}
    </div>
  )

  const invoiceColumns: Column<Invoice>[] = [
    { key: 'invoice_number', label: 'Reference' },
    {
      key: 'final_total',
      label: 'Cash Flow',
      render: (val) => <span className="font-mono font-bold text-foreground">₹{val?.toLocaleString()}</span>,
    },
    {
      key: 'payment_mode',
      label: 'Mode',
      render: (val) => (
        <Badge variant="outline" className="text-[10px] font-bold uppercase border-border/60">{val || 'Cash'}</Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Timestamp',
      render: (val) => <span className="text-muted-foreground font-mono text-[11px]">{new Date(val).toLocaleString()}</span>,
    },
  ]

  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.final_total || 0), 0)

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* --- IDE HEADER TOOLBAR --- */}
      <header className="sticky top-0 z-40 w-full bg-background border-b border-border px-4 h-12 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <Separator orientation="vertical" className="h-4" />
          <nav className="flex items-center gap-1.5 text-sm font-medium">
            <span className="text-muted-foreground">Sales</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground">Revenue Ledger</span>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 text-xs font-medium text-muted-foreground" onClick={fetchSalesData}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Sync
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold px-3 border-border" onClick={exportToCSV}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-[1200px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
        
        {/* KPI SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <div className="p-4 rounded-xl border border-border bg-card shadow-none">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Settled Revenue</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black tracking-tighter">₹{totalRevenue.toLocaleString()}</p>
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px]">Live</Badge>
              </div>
           </div>
           <div className="p-4 rounded-xl border border-purple-100 bg-purple-50/20 shadow-none">
              <p className="text-[10px] font-black uppercase tracking-widest text-purple-600 mb-1">Buyback Activity</p>
              <p className="text-2xl font-black tracking-tighter text-purple-700">{exchanges.length} <span className="text-xs font-normal">Events</span></p>
           </div>
           <div className="p-4 rounded-xl border border-border bg-slate-900 shadow-xl">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Transactions</p>
              <p className="text-2xl font-black tracking-tighter text-white">{invoices.length}</p>
           </div>
        </div>

        {/* FILTER BAR - IDE STYLE */}
        <Card className="shadow-none border-border/60 bg-muted/20">
          <CardContent className="p-3 flex flex-wrap items-center gap-4">
             <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Store className="w-3.5 h-3.5 text-muted-foreground" />
                <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border font-bold">
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Global (All Branches)</SelectItem>
                    {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
             </div>

             <div className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border w-32">
                    <SelectValue placeholder="Payment Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modes</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                    <SelectItem value="UPI">UPI / Digital</SelectItem>
                  </SelectContent>
                </Select>
             </div>

             <div className="flex items-center gap-2 border-l border-border pl-4">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <Input type="date" className="h-8 text-[10px] w-32 bg-background border-border" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <span className="text-muted-foreground text-xs">to</span>
                <Input type="date" className="h-8 text-[10px] w-32 bg-background border-border" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
             </div>
          </CardContent>
        </Card>

        {/* DATA SECTION */}
        <Tabs defaultValue="invoices" className="w-full">
          <TabsList className="bg-transparent border-b border-border w-full justify-start h-10 rounded-none gap-6 px-0 mb-4">
            <TabsTrigger value="invoices" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-1 text-xs font-bold transition-all">
              Settled Invoices
            </TabsTrigger>
            <TabsTrigger value="exchanges" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-1 text-xs font-bold transition-all">
              Exchange Registry
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="m-0">
            {loading ? <TableSkeleton /> : (
              <Card className="border-border/60 shadow-none overflow-hidden rounded-xl">
                <DataTable
                  columns={invoiceColumns}
                  data={invoices}
                  loading={false}
                  actions={[
                    {
                      label: isPrinting ? 'Syncing...' : 'Reprint',
                      icon: Printer,
                      onClick: (row) => handleReprint(row.id),
                    },
                  ]}
                />
              </Card>
            )}
          </TabsContent>
          
          {/* Exchange Content... */}
        </Tabs>

        <InvoicePrintTemplate ref={printRef} data={invoiceToPrint} />
      </main>
    </div>
  )
}