'use client'

import React, { useEffect, useState, useRef } from 'react'
import { format } from 'date-fns'
import { useReactToPrint } from 'react-to-print'
import { 
  FileText, TrendingUp, Printer, Store, RefreshCw, Download, 
  Filter, Calendar, Search, ChevronRight, Landmark,
  Scale, BookOpen, Receipt, Eye, MoreHorizontal, Edit2, XCircle, ShieldAlert, X, Loader2,
  CheckCircle2
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useStoreLocation } from '@/hooks/useStoreLocation'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export default function AccountsMasterPage() {
  const { appUser } = useAuth()
  const { isHQ, isLocked, selectedLocation, setSelectedLocation } = useStoreLocation()
  
  const [activeTab, setActiveTab] = useState("sales_register")
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; 
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [search, setSearch] = useState('')

  const [invoices, setInvoices] = useState<any[]>([])
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([])
  
  const [kpis, setKpis] = useState({ grossSales: 0, taxCollected: 0, b2bSales: 0, b2cSales: 0 })

  const printRef = useRef<HTMLDivElement>(null)
  const [invoiceToPrint, setInvoiceToPrint] = useState<any>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [isFetchingPreview, setIsFetchingPreview] = useState(false)

  const [invoiceToCancel, setInvoiceToCancel] = useState<any>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  const [invoiceToEdit, setInvoiceToEdit] = useState<any>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [isEditing, setIsEditing] = useState(false)
  
  const triggerPrint = useReactToPrint({ 
    contentRef: printRef,
    documentTitle: `Invoice-${invoiceToPrint?.invoice_number || 'Doc'}` 
  })

  useEffect(() => {
    const fetchWarehouses = async () => {
      if (!appUser?.company_id) return
      const { data } = await supabase.from('warehouses').select('id, name').eq('company_id', appUser.company_id).eq('is_active', true)
      
      if (data) {
        setWarehouses(data)
        if (!selectedLocation && !isHQ) setSelectedLocation(data[0].id)
      }
    }
    fetchWarehouses()
  }, [appUser, isHQ, selectedLocation, setSelectedLocation])

  const fetchAccountingData = async () => {
    if (!appUser?.company_id || !selectedLocation) return
    setLoading(true)
    try {
      const safeEndDate = new Date(endDate)
      safeEndDate.setDate(safeEndDate.getDate() + 1)
      const safeEndDateStr = safeEndDate.toISOString().split('T')[0]

      let salesQuery = supabase
        .from('invoices')
        .select(`
          *, 
          customers(full_name, pan_no, id),
          warehouses(name),
          invoice_items(
            item_id,
            rate,
            inventory_items(
              item_category, purity_karat, barcode, 
              gross_weight_g, net_weight_g, total_stone_weight_cts, 
              huid_code, hsn_code
            )
          )
        `)
        .eq('company_id', appUser.company_id)
        .gte('created_at', startDate)
        .lt('created_at', safeEndDateStr)
        .order('created_at', { ascending: false })

      if (selectedLocation !== 'ALL') salesQuery = salesQuery.eq('warehouse_id', selectedLocation)
      if (search.trim()) salesQuery = salesQuery.ilike('invoice_number', `%${search.trim()}%`)

      let purchaseQuery = supabase
        .from('purchase_invoices')
        .select(`
          *,
          suppliers(supplier_name, gstin),
          warehouses(name),
          purchase_invoice_items(*)
        `)
        .eq('company_id', appUser.company_id)
        .gte('invoice_date', startDate)
        .lt('invoice_date', safeEndDateStr)
        .order('invoice_date', { ascending: false })

      if (selectedLocation !== 'ALL') purchaseQuery = purchaseQuery.eq('warehouse_id', selectedLocation)
      if (search.trim()) purchaseQuery = purchaseQuery.ilike('invoice_number', `%${search.trim()}%`)

      const [salesRes, purchaseRes] = await Promise.all([salesQuery, purchaseQuery])
      if (salesRes.error) throw salesRes.error
      if (purchaseRes.error) throw purchaseRes.error

      const invData = salesRes.data || []
      const purchData = purchaseRes.data || []

      if (invData.length > 0) {
        const uniqueUserIds = [...new Set(invData.map(inv => inv.user_id).filter(Boolean))];
        if (uniqueUserIds.length > 0) {
          const { data: profilesData, error: profErr } = await supabase
            .from('profiles').select('id, full_name, role').in('id', uniqueUserIds);
            
          if (profilesData && !profErr) {
            const profileMap = Object.fromEntries(profilesData.map(p => [p.id, p]));
            invData.forEach(inv => { inv.profiles = profileMap[inv.user_id] || null; });
          }
        }
      }

      setInvoices(invData)
      setPurchaseInvoices(purchData)

      let gross = 0; let tax = 0; let b2b = 0; let b2c = 0;
      invData.forEach(inv => {
        if (inv.status === 'CANCELLED') return;
        const total = Number(inv.final_total) || 0
        gross += total
        const baseValue = total / 1.03
        tax += (total - baseValue)
        if (inv.customers?.pan_no) b2b += total; else b2c += total;
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
  }, [appUser, selectedLocation, startDate, endDate, search])

  // --- CSV EXPORT LOGIC FULLY RESTORED ---
  const downloadBlob = (headers: string[], rows: any[][], filename: string) => {
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleExportCSV = () => {
    if (activeTab === 'sales_register') {
      if (invoices.length === 0) return toast.error("No sales data to export");

      // ✨ Upgraded Headers to include Inventory Items Schema details
      const headers = [
        "Date", "Invoice Number", "Status", "Branch", "Customer Name", "PAN No", 
        "Item Barcodes", "Item Categories", "Total Gross Wt (g)", "Total Net Wt (g)", "Total Stone Wt (cts)", "HUIDs",
        "Billed By (Name)", "Billed By (Role)", 
        "Subtotal", "Manual Discount", "Voucher Code", "Voucher Discount", "Handling Fee",
        "Exchange Value", "Exchange Notes", 
        "Taxable Value", "CGST", "SGST", "Discounted Total", "Round Off", 
        "Kitty Payment", "Wallet Payment", "Advance Adjusted", "Final Total",
        "Payment Mode", "Split Payments JSON", "Transfer Type", "Transaction Reference", "Payment Remarks", "Cancellation Reason"
      ];

      const csvRows = invoices.map(inv => {
        // Aggregate inventory details for the CSV
        const barcodes = inv.invoice_items?.map((i:any) => i.inventory_items?.barcode).filter(Boolean).join(', ') || '';
        const categories = inv.invoice_items?.map((i:any) => i.inventory_items?.item_category).filter(Boolean).join(', ') || '';
        const totalGross = inv.invoice_items?.reduce((sum:number, i:any) => sum + (Number(i.inventory_items?.gross_weight_g) || 0), 0) || 0;
        const totalNet = inv.invoice_items?.reduce((sum:number, i:any) => sum + (Number(i.inventory_items?.net_weight_g) || 0), 0) || 0;
        const totalStone = inv.invoice_items?.reduce((sum:number, i:any) => sum + (Number(i.inventory_items?.total_stone_weight_cts) || 0), 0) || 0;
        const huids = inv.invoice_items?.map((i:any) => i.inventory_items?.huid_code).filter(Boolean).join(', ') || '';

        return [
          format(new Date(inv.created_at), 'yyyy-MM-dd HH:mm:ss'),
          inv.invoice_number,
          inv.status || 'VALID',
          inv.warehouses?.name || 'Unknown',
          inv.customers?.full_name || 'Walk-in',
          inv.customers?.pan_no || '',
          barcodes,
          categories,
          totalGross.toFixed(3),
          totalNet.toFixed(3),
          totalStone.toFixed(2),
          huids,
          inv.profiles?.full_name || 'System',
          inv.profiles?.role || 'N/A',
          inv.subtotal || 0,
          inv.discount_amount || 0,
          inv.voucher_code || '',
          inv.voucher_discount || 0,
          inv.Voucher_handling_fee || 0,
          inv.exchange_value || 0,
          inv.exchange_notes || '',
          inv.taxable_value || 0,
          inv.cgst_amount || 0,
          inv.sgst_amount || 0,
          inv.discounted_total || 0,
          inv.round_off_amount || 0,
          inv.kitty_payment || 0,
          inv.wallet_payment || 0,
          inv.advance_adjusted || 0,
          inv.final_total || 0,
          inv.payment_mode || '',
          inv.split_payments ? JSON.stringify(inv.split_payments) : '',
          inv.transfer_type || '',
          inv.transaction_reference || '',
          inv.payment_remarks || '',
          inv.cancellation_reason || ''
        ];
      });

      downloadBlob(headers, csvRows, `Master_Sales_Ledger_${startDate}_to_${endDate}.csv`);
      toast.success("Sales Ledger CSV Downloaded!");

    } else if (activeTab === 'purchase_register') {
      if (purchaseInvoices.length === 0) return toast.error("No purchase data to export");

      const headers = [
        "Date", "Invoice Number", "Branch / Warehouse", "Supplier Name", "GSTIN", 
        "Items Purchased",
        "Taxable Amount", "CGST", "SGST", "IGST", "Total Tax", "Round Off", "Final Payable", "Status"
      ];

      const csvRows = purchaseInvoices.map(inv => {
        const totalAmount = Number(inv.total_amount) || 0;
        const totalTax = Number(inv.total_tax) || 0;
        const totalPayable = Number(inv.total_payable) || 0;
        const roundOff = Number(inv.round_off_amount) || 0;
        
        const isIgst = inv.gst_type === 'IGST';
        const cgst = isIgst ? 0 : totalTax / 2;
        const sgst = isIgst ? 0 : totalTax / 2;
        const igst = isIgst ? totalTax : 0;

        const itemsString = inv.purchase_invoice_items?.map((pi: any) => {
          const typeStr = pi.item_type?.replace('_', ' ').toUpperCase();
          const unit = pi.item_type === 'diamond_lot' ? 'ct' : 'g';
          return `[${typeStr}] ${pi.description || 'N/A'} (Qty: ${pi.quantity || '-'}, Wt: ${pi.weight || '-'}${unit})`;
        }).join(' | ') || 'No Items';

        return [
          format(new Date(inv.invoice_date), 'yyyy-MM-dd'),
          inv.invoice_number,
          inv.warehouses?.name || 'Unknown',
          inv.suppliers?.supplier_name || 'Unknown',
          inv.suppliers?.gstin || '',
          itemsString,
          totalAmount,
          cgst,
          sgst,
          igst,
          totalTax,
          roundOff,
          totalPayable,
          inv.status
        ]
      });

      downloadBlob(headers, csvRows, `Master_Purchase_Ledger_${startDate}_to_${endDate}.csv`);
      toast.success("Purchase Ledger CSV Downloaded!");
    }
  }

  const handleOpenSalesPreview = async (invoiceId: string) => {
    setIsFetchingPreview(true)
    try {
      const { data: invData, error } = await supabase
        .from('invoices').select(`*, customers (*), invoice_items (rate, inventory_items (*))`)
        .eq('id', invoiceId).single()
      if (error) throw error

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
        kittyPayment: invData.kitty_payment || 0,
        walletPayment: invData.wallet_payment || 0,
        finalTotal: invData.final_total,
        items: safeItems
      }

      setInvoiceToPrint(mappedData)
      setShowPreviewModal(true)
    } catch (err) { toast.error('Failed to retrieve full ledger details') } 
    finally { setIsFetchingPreview(false) }
  }

  const executeCancelInvoice = async () => {
    if (!invoiceToCancel || !appUser) return;
    if (!cancelReason.trim()) return toast.error("A cancellation reason is strictly required for the audit trail.");
    
    setIsCancelling(true);
    try {
      const { error: invError } = await supabase.from('invoices').update({
        status: 'CANCELLED',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: cancelReason.trim(),
        cancelled_by: appUser.id
      }).eq('id', invoiceToCancel.id);
      
      if (invError) throw invError;

      const itemIds = invoiceToCancel.invoice_items?.map((i: any) => i.item_id).filter(Boolean);
      if (itemIds && itemIds.length > 0) {
        const { error: restockError } = await supabase.from('inventory_items').update({
          status: 'in_stock'
        }).in('id', itemIds);
        if (restockError) console.error("Failed to restock items:", restockError);
      }

      if (invoiceToCancel.voucher_code) {
        const { error: vouchError } = await supabase.from('vouchers').update({ status: 'registered' }).eq('code', invoiceToCancel.voucher_code);
        if (vouchError) console.error("Failed to revert voucher:", vouchError);
      }

      const kittyReturn = Number(invoiceToCancel.kitty_payment) || 0;
      const walletReturn = Number(invoiceToCancel.wallet_payment) || 0;
      if ((kittyReturn > 0 || walletReturn > 0) && invoiceToCancel.customer_id) {
        const { data: customerData } = await supabase.from('customers').select('store_credit_balance, pavitram_points').eq('id', invoiceToCancel.customer_id).single();
        if (customerData) {
          await supabase.from('customers').update({
            store_credit_balance: Number(customerData.store_credit_balance || 0) + kittyReturn,
            pavitram_points: Number(customerData.pavitram_points || 0) + walletReturn
          }).eq('id', invoiceToCancel.customer_id);
        }
      }

      toast.success(`Invoice ${invoiceToCancel.invoice_number} has been voided and ledger reverted.`);
      setInvoiceToCancel(null);
      setCancelReason('');
      fetchAccountingData();
    } catch (err: any) {
      toast.error(err.message || "Failed to void the invoice.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleOpenEdit = (inv: any) => {
    setInvoiceToEdit(inv);
    setEditForm({
      created_at: inv.created_at.split('T')[0],
      subtotal: inv.subtotal,
      discount_amount: inv.discount_amount,
      taxable_value: inv.taxable_value,
      cgst_amount: inv.cgst_amount,
      sgst_amount: inv.sgst_amount,
      final_total: inv.final_total,
      payment_remarks: inv.payment_remarks || ''
    });
  };

  const executeEditInvoice = async () => {
    if (!invoiceToEdit || !appUser) return;
    setIsEditing(true);
    try {
      const { error } = await supabase.from('invoices').update({
        created_at: new Date(editForm.created_at).toISOString(),
        subtotal: Number(editForm.subtotal),
        discount_amount: Number(editForm.discount_amount),
        taxable_value: Number(editForm.taxable_value),
        cgst_amount: Number(editForm.cgst_amount),
        sgst_amount: Number(editForm.sgst_amount),
        final_total: Number(editForm.final_total),
        payment_remarks: editForm.payment_remarks
      }).eq('id', invoiceToEdit.id);

      if (error) throw error;

      toast.success("Invoice financials updated successfully.");
      setInvoiceToEdit(null);
      fetchAccountingData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update the invoice.");
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50/50 font-sans pb-20 sm:pb-0 w-full max-w-[100vw] overflow-x-hidden">
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

      <main className="p-3 sm:p-6 md:p-8 max-w-[1600px] w-full min-w-0 mx-auto space-y-5 animate-in fade-in duration-500">
        
        {/* MOBILE-OPTIMIZED FILTERS */}
        <div className="flex flex-col gap-2.5 bg-white p-3 sm:p-2.5 rounded-2xl border border-zinc-200 shadow-sm w-full">
          <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input placeholder="Search Txn/Invoice..." className="pl-9 h-10 sm:h-9 text-sm sm:text-xs rounded-xl sm:rounded-full bg-zinc-50 border-zinc-200 focus-visible:ring-zinc-400 font-medium text-zinc-800" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            
            <Button variant={showFilters ? "default" : "outline"} size="icon" className={`h-10 w-10 sm:h-9 sm:w-9 rounded-xl sm:rounded-full sm:hidden shrink-0 transition-colors ${showFilters ? 'bg-zinc-900 text-white' : 'border-zinc-200 text-zinc-600'}`} onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-zinc-200 shrink-0 hidden sm:flex text-zinc-600 hover:bg-zinc-100" onClick={fetchAccountingData}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button className="h-9 text-xs font-medium rounded-full hidden sm:flex shrink-0 text-zinc-700 border border-zinc-200 bg-white hover:bg-zinc-50 shadow-sm" onClick={handleExportCSV}>
              <Download className="mr-2 h-3.5 w-3.5" /> {activeTab === 'sales_register' ? 'Export Sales CSV' : activeTab === 'purchase_register' ? 'Export Purchase CSV' : 'Export CSV'}
            </Button>
          </div>

          <div className={`flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full ${showFilters ? 'flex' : 'hidden sm:flex'} animate-in slide-in-from-top-2 duration-200`}>
            <Select value={selectedLocation || ''} onValueChange={setSelectedLocation} disabled={isLocked}>
              <SelectTrigger className="h-10 sm:h-9 text-xs sm:text-[11px] font-bold bg-zinc-50 border-zinc-200 rounded-xl sm:rounded-full w-full sm:w-[150px]">
                <Store className="w-4 h-4 sm:w-3 sm:h-3 mr-1.5 text-zinc-500" />
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl border-zinc-200">
                {isHQ && <SelectItem value="ALL" className="text-xs font-bold text-indigo-600 rounded-lg">All Branches (HQ)</SelectItem>}
                {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs font-medium rounded-lg">{w.name}</SelectItem>)}
              </SelectContent>
            </Select>

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
            
            <Button className="h-10 text-xs font-bold rounded-xl flex sm:hidden w-full text-zinc-700 border border-zinc-200 bg-white shadow-sm mt-1" onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" /> Export Ledger CSV
            </Button>
          </div>
        </div>

        {/* ACCOUNTING KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full">
          <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl w-full">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-zinc-400" /> Gross Value (inc. GST)</p>
              {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">₹{kpis.grossSales.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
            </CardContent>
          </Card>
          <Card className="shadow-sm border-emerald-200 bg-emerald-50/40 rounded-2xl w-full">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[10px] sm:text-[11px] font-medium text-emerald-700 mb-1 flex items-center gap-1.5"><Scale className="h-3.5 w-3.5" /> Est. Tax Liability</p>
              {loading ? <Skeleton className="h-8 w-20 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-emerald-900 mt-1">₹{kpis.taxCollected.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
            </CardContent>
          </Card>
          <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl w-full">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5 text-zinc-400" /> B2B Activity</p>
              {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">₹{kpis.b2bSales.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
            </CardContent>
          </Card>
          <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl w-full">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5 text-zinc-400" /> B2C Activity</p>
              {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">₹{kpis.b2cSales.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
            </CardContent>
          </Card>
        </div>

        {/* ACCOUNTING TABS */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0">
          <div className="w-full overflow-x-auto no-scrollbar pb-2">
            <TabsList className="bg-transparent border-none p-0 h-auto flex justify-start w-max gap-2">
              <TabsTrigger value="sales_register" className="rounded-full h-9 sm:h-10 text-xs sm:text-sm font-bold px-5 py-0 bg-white border border-zinc-200 data-[state=active]:bg-zinc-900 data-[state=active]:text-white transition-all shrink-0 shadow-sm">Sales Register (GSTR-1)</TabsTrigger>
              <TabsTrigger value="purchase_register" className="rounded-full h-9 sm:h-10 text-xs sm:text-sm font-bold px-5 py-0 bg-white border border-zinc-200 data-[state=active]:bg-zinc-900 data-[state=active]:text-white transition-all shrink-0 shadow-sm">Purchase Register (GSTR-2)</TabsTrigger>
              <TabsTrigger value="tax_summary" className="rounded-full h-9 sm:h-10 text-xs sm:text-sm font-bold px-5 py-0 bg-white border border-zinc-200 data-[state=active]:bg-zinc-900 data-[state=active]:text-white transition-all shrink-0 shadow-sm">Tax Summary (GSTR-3B)</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="sales_register" className="m-0 pt-2 w-full min-w-0">
            <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl w-full min-w-0 overflow-hidden">
              
              {/* MOBILE CARDS VIEW */}
              <div className="block xl:hidden divide-y divide-zinc-100 bg-zinc-50/50 w-full">
                {loading ? (
                  <div className="p-4"><Skeleton className="h-24 w-full rounded-xl" /></div>
                ) : invoices.length === 0 ? (
                  <div className="py-12 text-center text-zinc-400 bg-white">
                    <FileText className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-semibold tracking-tight">No transactions found</p>
                  </div>
                ) : (
                  invoices.map((inv) => {
                    const isCancelled = inv.status === 'CANCELLED'
                    const isB2B = !!inv.customers?.pan_no
                    const itemsText = inv.invoice_items?.map((i: any) => i.inventory_items?.item_category).filter(Boolean).join(', ') || 'No Items'
                    const total = Number(inv.final_total) || 0

                    return (
                      <div key={inv.id} className={`p-4 bg-white m-2 rounded-xl shadow-sm border border-zinc-100 transition-all ${isCancelled ? 'opacity-60 bg-red-50/30' : ''}`}>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-mono text-sm font-bold text-zinc-900 tracking-tight flex items-center gap-2">
                              {inv.invoice_number}
                              {isCancelled && <Badge variant="outline" className="h-4 px-1 text-[9px] bg-red-100 text-red-600 border-red-200 uppercase tracking-widest">Voided</Badge>}
                            </div>
                            <div className="text-[11px] text-zinc-500 font-medium mt-1">{format(new Date(inv.created_at), 'dd MMM yyyy, HH:mm')}</div>
                          </div>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border-zinc-200">
                              <DropdownMenuItem onClick={() => handleOpenSalesPreview(inv.id)} className="cursor-pointer py-2">
                                <Eye className="w-4 h-4 mr-2 text-indigo-500" /> View / Print Bill
                              </DropdownMenuItem>
                              {!isCancelled && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleOpenEdit(inv)} className="cursor-pointer py-2">
                                    <Edit2 className="w-4 h-4 mr-2 text-amber-500" /> Edit Financials
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setInvoiceToCancel(inv)} className="cursor-pointer py-2 text-red-600 focus:bg-red-50 focus:text-red-700">
                                    <XCircle className="w-4 h-4 mr-2" /> Cancel Invoice
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        
                        <div className="flex justify-between items-center bg-zinc-50 rounded-lg p-2.5 border border-zinc-100 mb-3">
                          <div className="flex flex-col max-w-[60%]">
                            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Customer</span>
                            <span className="text-xs font-semibold text-zinc-800 truncate">{inv.customers?.full_name || 'Walk-in'}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Branch</span>
                            <span className="text-xs font-medium text-zinc-600">{inv.warehouses?.name || 'HQ'}</span>
                          </div>
                        </div>

                        <p className="text-[11px] text-zinc-500 truncate mb-3" title={itemsText}>
                          <span className="font-semibold text-zinc-700">Items:</span> {itemsText}
                        </p>

                        <div className="flex justify-between items-end border-t border-zinc-100 pt-3">
                          <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 border border-zinc-200 text-[9px] uppercase tracking-widest shadow-none">
                            {inv.payment_mode?.startsWith('SPLIT') ? 'SPLIT PMT' : inv.payment_mode}
                          </Badge>
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Final Total</span>
                            <span className="text-lg font-black text-zinc-900 leading-none mt-0.5">₹{total.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* DESKTOP TABLE VIEW */}
              <div className="hidden xl:block w-full overflow-x-auto custom-scrollbar pb-2">
                <Table className="w-full whitespace-nowrap">
                  <TableHeader className="bg-zinc-50/80 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                    <TableRow className="hover:bg-transparent border-zinc-200">
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-4 bg-zinc-50 z-20 w-[60px] text-center sticky left-0 border-r border-zinc-200">Actions</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-4 bg-zinc-50 z-20">Date</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-50 z-20">Invoice No</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-50 z-20 border-r border-zinc-200">Status</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Customer / Party</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider min-w-[200px]">Items Sold</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right bg-slate-50/50 border-l border-zinc-200">Subtotal</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right bg-slate-50/50 border-l border-zinc-200">Taxable Val</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right bg-emerald-50/30">CGST</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right bg-emerald-50/30">SGST</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right bg-slate-100 border-l border-zinc-200">Final Total</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-center border-l border-zinc-200">Pay Mode</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => {
                      const isCancelled = inv.status === 'CANCELLED'
                      const sub = Number(inv.subtotal) || 0;
                      const taxable = Number(inv.taxable_value) || 0;
                      const cgst = Number(inv.cgst_amount) || 0;
                      const sgst = Number(inv.sgst_amount) || 0;
                      const total = Number(inv.final_total) || 0;

                      return (
                        <TableRow key={inv.id} className={`border-zinc-100 hover:bg-zinc-50/50 transition-colors group ${isCancelled ? 'opacity-60 bg-red-50/30 hover:bg-red-50/50' : ''}`}>
                          
                          {/* ACTION MENU */}
                          <TableCell className="px-4 py-2 text-center align-middle sticky left-0 bg-white group-hover:bg-zinc-50 z-10 border-r border-zinc-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-48 rounded-xl shadow-lg border-zinc-200">
                                <DropdownMenuItem onClick={() => handleOpenSalesPreview(inv.id)} className="cursor-pointer py-2">
                                  <Eye className="w-4 h-4 mr-2 text-indigo-500" /> View / Print Bill
                                </DropdownMenuItem>
                                {!isCancelled && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleOpenEdit(inv)} className="cursor-pointer py-2">
                                      <Edit2 className="w-4 h-4 mr-2 text-amber-500" /> Edit Financials
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setInvoiceToCancel(inv)} className="cursor-pointer py-2 text-red-600 focus:bg-red-50 focus:text-red-700">
                                      <XCircle className="w-4 h-4 mr-2" /> Cancel Invoice
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>

                          <TableCell className="px-4 py-2 text-[12px] font-medium text-zinc-600 whitespace-nowrap">{format(new Date(inv.created_at), 'dd MMM yy, HH:mm')}</TableCell>
                          <TableCell className="py-2 font-mono text-[12px] font-semibold text-zinc-900 border-r border-zinc-100">
                            {inv.invoice_number}
                            {isCancelled && <div className="text-[9px] text-red-500 font-bold uppercase tracking-widest mt-0.5">Voided</div>}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${isCancelled ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                              {inv.status || 'VALID'}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-2 min-w-[160px]">
                            <span className="text-[12px] font-semibold text-zinc-800 whitespace-nowrap truncate">{inv.customers?.full_name || 'Walk-in'}</span>
                          </TableCell>
                          <TableCell className="py-2 min-w-[200px]">
                             <div className="flex flex-col gap-1 max-h-[40px] overflow-y-auto custom-scrollbar pr-1">
                               {inv.invoice_items?.map((i: any, idx: number) => {
                                 const item = i.inventory_items;
                                 return <span key={idx} className="text-[10px] font-medium text-zinc-600 bg-zinc-100/50 px-1.5 py-0.5 rounded truncate"><span className="font-mono font-bold text-zinc-400 mr-1">[{item?.barcode || '?'}]</span>{item?.item_category || 'Item'}</span>
                               })}
                             </div>
                          </TableCell>
                          <TableCell className="py-2 text-right text-[12px] font-medium text-zinc-700 bg-slate-50/50 border-l border-zinc-200">₹{sub.toLocaleString()}</TableCell>
                          <TableCell className="py-2 text-right text-[12px] font-bold text-zinc-800 bg-slate-50/50 border-l border-zinc-200">₹{taxable.toLocaleString()}</TableCell>
                          <TableCell className="py-2 text-right text-[12px] font-medium text-emerald-600 bg-emerald-50/30">₹{cgst.toLocaleString()}</TableCell>
                          <TableCell className="py-2 text-right text-[12px] font-medium text-emerald-600 bg-emerald-50/30">₹{sgst.toLocaleString()}</TableCell>
                          <TableCell className="py-2 text-right text-[13px] font-black text-zinc-900 bg-slate-100 border-l border-zinc-200">₹{total.toLocaleString()}</TableCell>
                          <TableCell className="py-2 text-center border-l border-zinc-200">
                            <span className="px-2 py-1 rounded bg-zinc-100 border border-zinc-200 text-zinc-600 text-[10px] font-bold uppercase tracking-wider">{inv.payment_mode}</span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
          <TabsContent value="purchase_register">
             <div className="py-12 text-center text-zinc-400 bg-white rounded-2xl border border-zinc-200 shadow-sm">
                <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-semibold tracking-tight">Purchase records will appear here.</p>
             </div>
          </TabsContent>
          <TabsContent value="tax_summary">
            <div className="py-20 border border-dashed border-zinc-300 bg-white rounded-2xl flex flex-col items-center justify-center text-zinc-400 w-full">
              <Scale className="h-10 w-10 mb-3 opacity-20" />
              <h3 className="text-sm font-semibold tracking-tight text-zinc-600 mb-1">Monthly Tax Summary (GSTR-3B)</h3>
              <p className="text-[11px] font-medium">Auto-calculated offsets between Output Tax and ITC.</p>
            </div>
          </TabsContent>
        </Tabs>

        {/* --- CANCELLATION MODAL --- */}
        <Dialog open={!!invoiceToCancel} onOpenChange={(open) => !open && setInvoiceToCancel(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <ShieldAlert className="w-5 h-5" /> Void Invoice
              </DialogTitle>
              <DialogDescription>
                You are about to permanently cancel Invoice <strong className="text-zinc-900">{invoiceToCancel?.invoice_number}</strong>. This will return items to stock and revert applied vouchers.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Cancellation Reason (Required)</Label>
                <Input 
                  id="reason" 
                  placeholder="e.g. Customer changed mind, incorrect payment method..." 
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInvoiceToCancel(null)}>Keep Invoice</Button>
              <Button variant="destructive" onClick={executeCancelInvoice} disabled={isCancelling || !cancelReason.trim()}>
                {isCancelling ? 'Voiding...' : 'Confirm Void'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* --- EDIT FINANCIALS MODAL --- */}
        <Dialog open={!!invoiceToEdit} onOpenChange={(open) => !open && setInvoiceToEdit(null)}>
          <DialogContent className="sm:max-w-[600px] border-zinc-200/60 shadow-2xl rounded-2xl p-0 overflow-hidden bg-white">
            <DialogHeader className="bg-zinc-50 border-b border-zinc-100 p-5 shrink-0 select-none">
              <DialogTitle className="flex items-center gap-2 text-indigo-600 text-lg font-bold">
                <Edit2 className="w-5 h-5" /> Edit Ledger Entry
              </DialogTitle>
              <DialogDescription className="text-xs font-medium text-zinc-500 mt-1.5">
                Modify financial details for <strong className="text-zinc-900">{invoiceToEdit?.invoice_number}</strong>. This updates the ledger in-place without generating a new invoice number.
              </DialogDescription>
            </DialogHeader>
            
            <div className="p-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Invoice Date</Label>
                  <Input type="date" className="h-10 bg-zinc-50/50" value={editForm.created_at} onChange={(e) => setEditForm({...editForm, created_at: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Payment Remarks / Reference</Label>
                  <Input className="h-10 bg-zinc-50/50" value={editForm.payment_remarks} onChange={(e) => setEditForm({...editForm, payment_remarks: e.target.value})} />
                </div>

                <div className="col-span-1 sm:col-span-2 border-t border-zinc-100 my-1"></div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Subtotal</Label>
                  <Input type="number" className="h-10 font-mono font-medium" value={editForm.subtotal} onChange={(e) => setEditForm({...editForm, subtotal: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Manual Discount</Label>
                  <Input type="number" className="h-10 font-mono font-medium border-red-200 focus-visible:ring-red-500" value={editForm.discount_amount} onChange={(e) => setEditForm({...editForm, discount_amount: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Taxable Value</Label>
                  <Input type="number" className="h-10 font-mono font-medium bg-zinc-50" value={editForm.taxable_value} onChange={(e) => setEditForm({...editForm, taxable_value: e.target.value})} />
                </div>
                
                <div className="space-y-1.5 col-span-1 sm:col-span-2 mt-2">
                   <div className="grid grid-cols-2 gap-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">CGST Amount</Label>
                        <Input type="number" className="h-10 font-mono font-medium bg-white border-emerald-200" value={editForm.cgst_amount} onChange={(e) => setEditForm({...editForm, cgst_amount: e.target.value})} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">SGST Amount</Label>
                        <Input type="number" className="h-10 font-mono font-medium bg-white border-emerald-200" value={editForm.sgst_amount} onChange={(e) => setEditForm({...editForm, sgst_amount: e.target.value})} />
                      </div>
                   </div>
                </div>

                <div className="space-y-1.5 col-span-1 sm:col-span-2 mt-2">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-indigo-600 mb-2 block">Net Final Total</Label>
                  <Input type="number" className="h-14 font-mono font-black text-2xl border-indigo-200 bg-indigo-50/30 shadow-inner" value={editForm.final_total} onChange={(e) => setEditForm({...editForm, final_total: e.target.value})} />
                </div>
              </div>
            </div>
            <DialogFooter className="p-4 bg-zinc-50 border-t border-zinc-100 sm:justify-between flex-row">
              <Button variant="ghost" className="h-10 font-bold text-zinc-500 hover:text-zinc-800 rounded-lg" onClick={() => setInvoiceToEdit(null)}>Discard</Button>
              <Button className="h-10 px-8 font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm" onClick={executeEditInvoice} disabled={isEditing}>
                {isEditing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                {isEditing ? 'Saving...' : 'Save Adjustments'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* --- PRINT MODAL (Windows 11 Aesthetic) --- */}
        <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
          <DialogContent 
            className="max-w-[900px] w-full h-[100dvh] sm:h-[90vh] sm:w-[95vw] border border-zinc-200/50 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] p-0 rounded-none sm:rounded-2xl bg-white/95 backdrop-blur-xl flex flex-col m-0 sm:m-auto overflow-hidden ring-1 ring-black/5"
            aria-describedby="print-dialog-description"
          >
            <DialogHeader className="p-3 sm:p-4 border-b border-zinc-200/50 bg-zinc-50/50 shrink-0 flex flex-row items-center justify-between select-none">
              <div className="flex items-center gap-3 text-zinc-800">
                <div className="p-1.5 bg-indigo-100/80 rounded-md text-indigo-600 shadow-sm border border-indigo-200/50">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex flex-col items-start">
                  <DialogTitle className="text-[13px] font-semibold tracking-tight leading-none">
                    Invoice Document Preview
                  </DialogTitle>
                  <DialogDescription id="print-dialog-description" className="text-[10px] font-medium text-zinc-500 mt-1 leading-none">
                    {invoiceToPrint?.invoice_number ? `Viewing ${invoiceToPrint.invoice_number}` : 'Loading document...'}
                  </DialogDescription>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-zinc-500 hover:bg-red-500 hover:text-white rounded-md transition-all" 
                  onClick={() => setShowPreviewModal(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </DialogHeader>
            
            <div className="flex-1 overflow-auto bg-zinc-100/80 p-4 sm:p-8 custom-scrollbar shadow-inner relative flex items-start justify-center">
               {isFetchingPreview ? (
                  <div className="m-auto flex flex-col items-center justify-center text-zinc-400">
                    <Loader2 className="h-6 w-6 animate-spin mb-3" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Retrieving Document...</span>
                  </div>
               ) : invoiceToPrint ? (
                 <div className="shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-white shrink-0 border border-zinc-200/60 rounded-sm overflow-hidden ring-1 ring-black/5 transition-all">
                    <InvoicePrintTemplate data={invoiceToPrint} />
                 </div>
               ) : null}
            </div>

            <DialogFooter className="bg-zinc-50/80 backdrop-blur-md p-4 border-t border-zinc-200/50 shrink-0 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
              <Button 
                variant="outline" 
                className="h-9 sm:h-9 w-full sm:w-auto px-5 text-[11px] font-bold uppercase tracking-widest rounded-lg border-zinc-300 text-zinc-700 hover:bg-zinc-100 bg-white shadow-sm transition-all" 
                onClick={() => setShowPreviewModal(false)}
              >
                Close Window
              </Button>
              <Button 
                onClick={triggerPrint} 
                className="h-9 sm:h-9 w-full sm:w-auto px-6 text-[11px] font-bold uppercase tracking-widest rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_2px_10px_rgba(79,70,229,0.2)] transition-all"
              >
                <Printer className="h-3.5 w-3.5 mr-2" /> Print Document
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="hidden"><InvoicePrintTemplate ref={printRef} data={invoiceToPrint} /></div>
      </main>

      <style dangerouslySetInnerHTML={{__html:`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 1rem); }
      `}} />
    </div>
  )
}