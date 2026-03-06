'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { DataTable, Column } from '@/components/DataTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import { supabase } from '@/lib/supabaseClient'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useReactToPrint } from 'react-to-print'
import { FileText, TrendingUp, Printer, Store, RefreshCw } from 'lucide-react'

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

interface ExchangeRecord {
  id: string
  barcode: string
  exchange_value: number
  notes: string
  created_at: string
  invoices?: any // Changed to any to bypass strict array checks
  customers?: any // Changed to any to bypass strict array checks
}

export default function SalesPage() {
  const { appUser, loading } = useAuth()
  const { toast } = useToast()
  
  // Warehouse State
  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')

  // Data State
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [exchanges, setExchanges] = useState<ExchangeRecord[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [exchangesLoading, setExchangesLoading] = useState(false)

  // Reprint State
  const printRef = useRef<HTMLDivElement>(null)
  const [invoiceToPrint, setInvoiceToPrint] = useState<any>(null)
  const [isPrinting, setIsPrinting] = useState(false)

  const triggerPrint = useReactToPrint({
    contentRef: printRef,
  })

  // 1. Fetch Warehouses on Load
  useEffect(() => {
    const fetchWarehouses = async () => {
      if (!appUser) return
      try {
        const { data: whData } = await supabase
          .from('warehouses')
          .select('id, name')
          .eq('company_id', appUser.company_id)
          .eq('is_active', true)
          .order('name')

        if (whData && whData.length > 0) {
          setWarehouses(whData)
          setSelectedWarehouseId(whData[0].id)
        }
      } catch (err) {
        toast({ title: 'Error loading warehouses', variant: 'destructive' })
      }
    }
    fetchWarehouses()
  }, [appUser, toast])

  // 2. Fetch Sales & Exchange Data whenever Warehouse Changes
  useEffect(() => {
    if (!appUser || !selectedWarehouseId) return

    const fetchSalesData = async () => {
      setInvoicesLoading(true)
      setExchangesLoading(true)
      try {
        // Fetch Main Invoices
        const { data: invoicesData, error: invErr } = await supabase
          .from('invoices') 
          .select('*')
          .eq('company_id', appUser.company_id)
          .eq('warehouse_id', selectedWarehouseId)
          .order('created_at', { ascending: false })

        if (invErr) console.error("Invoice Fetch Error:", invErr)
        setInvoices(invoicesData || [])

        // Fetch Exchange Ledger Data (Joined with Invoice & Customer names)
        const { data: exchangeData, error: exErr } = await supabase
          .from('exchange_ledger')
          .select(`
            id, barcode, exchange_value, notes, created_at,
            invoices ( invoice_number ),
            customers ( full_name )
          `)
          .eq('company_id', appUser.company_id)
          .eq('warehouse_id', selectedWarehouseId)
          .order('created_at', { ascending: false })

        if (exErr && exErr.code !== '42P01') console.error("Exchange Fetch Error:", exErr)
        setExchanges(exchangeData || [])

      } catch (err) {
        console.error('Error fetching sales data:', err)
      } finally {
        setInvoicesLoading(false)
        setExchangesLoading(false)
      }
    }

    fetchSalesData()
  }, [appUser, selectedWarehouseId])

  // --- REPRINT LOGIC ---
  const handleReprint = async (invoiceId: string) => {
    setIsPrinting(true)
    toast({ title: 'Fetching Invoice...', description: 'Preparing document for print.' })
    
    try {
      const { data: invData, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (*),
          invoice_items (
            rate,
            inventory_items (
              barcode, 
              metal_type, 
              purity_karat, 
              hsn_code, 
              gross_weight_g, 
              net_weight_g, 
              total_stone_weight_cts
            )
          )
        `)
        .eq('id', invoiceId)
        .single()

      if (error) throw error

      const mappedData = {
        invoice_number: invData.invoice_number,
        date: invData.created_at,
        customer: invData.customers, 
        subtotal: invData.subtotal,
        discountAmount: invData.discount_amount,
        voucherAmount: invData.voucher_discount,
        finalTotal: invData.final_total,
        exchangeValue: invData.exchange_value || 0, // Ensure exchange value is passed to the print template!
        items: invData.invoice_items.map((i: any) => ({
          mrp: i.rate,
          barcode: i.inventory_items?.barcode,
          metal_type: i.inventory_items?.metal_type,
          purity: i.inventory_items?.purity_karat,
          hsn_code: i.inventory_items?.hsn_code || '7113',
          gross_wt: i.inventory_items?.gross_weight_g || 0,
          net_wt: i.inventory_items?.net_weight_g || 0,
          dia_wt: i.inventory_items?.total_stone_weight_cts || 0
        }))
      }

      setInvoiceToPrint(mappedData)
      
      setTimeout(() => {
        triggerPrint()
        setIsPrinting(false)
      }, 300)

    } catch (err: any) {
      console.error("Reprint Error:", err)
      toast({ title: 'Error', description: 'Could not fetch full invoice details.', variant: 'destructive' })
      setIsPrinting(false)
    }
  }

  // --- TABLE COLUMNS ---
  const invoiceColumns: Column<Invoice>[] = [
    { key: 'invoice_number', label: 'Invoice #' },
    {
      key: 'final_total',
      label: 'Collected Amount',
      render: (value) => <span className="font-mono font-bold text-slate-900">₹{value?.toLocaleString() || '0'}</span>,
    },
    {
      key: 'exchange_value',
      label: 'Exchange Value',
      render: (value) => value > 0 ? (
        <span className="font-mono font-medium text-purple-700">₹{value?.toLocaleString()}</span>
      ) : <span className="text-slate-300">--</span>,
    },
    {
      key: 'payment_mode',
      label: 'Payment Mode',
      render: (value) => (
        <Badge variant="outline" className="capitalize text-xs font-bold">
          {value || 'Cash'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (value) => <span className="text-gray-500 font-mono text-xs">{new Date(value).toLocaleString()}</span>,
    },
  ]

  const exchangeColumns: Column<ExchangeRecord>[] = [
    {
      key: 'created_at',
      label: 'Date',
      render: (value) => <span className="text-gray-500 font-mono text-xs">{new Date(value).toLocaleDateString()}</span>,
    },
    {
      key: 'invoices',
      label: 'Linked Invoice',
      render: (_, row) => <span className="font-bold text-slate-800">{row.invoices?.invoice_number || '--'}</span>
    },
    {
      key: 'customers',
      label: 'Customer Name',
      render: (_, row) => <span>{row.customers?.full_name || '--'}</span>
    },
    {
      key: 'barcode',
      label: 'Old Item Barcode',
      render: (val) => <Badge variant="secondary" className="font-mono uppercase bg-purple-50 text-purple-700 border-purple-200">{val}</Badge>
    },
    {
      key: 'exchange_value',
      label: 'Buyback Value',
      render: (value) => <span className="font-mono font-black text-purple-700">₹{value?.toLocaleString() || '0'}</span>,
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (val) => <span className="text-xs text-slate-500 truncate max-w-[200px] block">{val || '--'}</span>
    }
  ]

  if (loading || !appUser) {
    return <div className="flex items-center justify-center min-h-[50vh] text-gray-500">Loading Sales Hub...</div>
  }

  // --- KPI MATH ---
  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.final_total || 0), 0)
  const totalExchanges = invoices.reduce((sum, inv) => sum + (inv.exchange_value || 0), 0)
  const grossSalesValue = totalRevenue + totalExchanges

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6 max-w-7xl">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Sales Ledger</h1>
            <p className="text-slate-500 text-sm mt-1">Monitor branch revenue, lifetime exchanges, and reprint past invoices.</p>
          </div>
          
          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
            <div className="pl-3 pr-2 border-r border-slate-100">
               <Store className="w-4 h-4 text-slate-400" />
            </div>
            <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
              <SelectTrigger className="w-[200px] h-9 border-none bg-transparent focus:ring-0 shadow-none font-bold text-slate-700">
                <SelectValue placeholder={warehouses.length > 0 ? "Select Branch" : "Loading..."} />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">Net Revenue Collected</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
              <p className="text-xs font-medium text-slate-400 mt-1">Cash / Card / UPI Received</p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 shadow-sm bg-purple-50/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold text-purple-700 uppercase tracking-widest">Buybacks / Exchanges</CardTitle>
              <RefreshCw className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-purple-700">₹{totalExchanges.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
              <p className="text-xs font-medium text-purple-500/80 mt-1">{exchanges.length} items absorbed back to stock</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 text-white border-slate-900 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest">Gross Sales Value</CardTitle>
              <FileText className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-white">
                ₹{grossSalesValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs font-medium text-slate-400 mt-1">Total value of jewelry sold</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs & Tables */}
        <Tabs defaultValue="invoices" className="space-y-4">
          <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded-lg border border-slate-200">
            <TabsList className="bg-transparent">
              <TabsTrigger value="invoices" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Sales Invoices</TabsTrigger>
              <TabsTrigger value="exchanges" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Exchange Ledger</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="invoices" className="mt-0">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
               <CardContent className="p-0">
                  <DataTable
                    columns={invoiceColumns}
                    data={invoices}
                    loading={invoicesLoading}
                    emptyMessage="No sales invoices found for this branch."
                    actions={[
                      {
                        label: isPrinting ? 'Printing...' : 'Reprint Bill',
                        icon: Printer,
                        onClick: (row) => handleReprint(row.id),
                      },
                    ]}
                  />
               </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exchanges" className="mt-0">
             <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <DataTable
                    columns={exchangeColumns}
                    data={exchanges}
                    loading={exchangesLoading}
                    emptyMessage="No exchanges processed at this branch."
                  />
                </CardContent>
             </Card>
          </TabsContent>
        </Tabs>

        {/* REUSABLE PRINT TEMPLATE INTEGRATION */}
        <InvoicePrintTemplate ref={printRef} data={invoiceToPrint} />

    </div>
  )
}