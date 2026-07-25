'use client'

import React, { useEffect, useState, useRef } from 'react'
import { format } from 'date-fns'
import { useReactToPrint } from 'react-to-print'
import { 
  FileText, TrendingUp, Printer, Store, RefreshCw, Download, 
  Filter, Calendar, Search, ChevronRight, Landmark,
  Scale, BookOpen, Receipt, Eye, MoreHorizontal, Edit2, XCircle, ShieldAlert, X, Loader2,
  CheckCircle2, Box, Wrench, ArrowRightLeft, HandCoins, User, ChevronLeft, Ticket
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

// ✨ FIXED: Dynamic Top Scrollbar Sync Logic
const SyncedTableWrapper = ({ children }: { children: React.ReactNode }) => {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(2500);

  useEffect(() => {
    if (contentRef.current) {
      const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          setContentWidth(entry.target.scrollWidth);
        }
      });
      resizeObserver.observe(contentRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  const handleTopScroll = () => {
    if (bottomScrollRef.current && topScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleBottomScroll = () => {
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
  };

  return (
    <div className="flex flex-col w-full relative">
      {/* Top Scrollbar */}
      <div 
        ref={topScrollRef} 
        onScroll={handleTopScroll}
        className="w-full overflow-x-auto custom-scrollbar h-[12px] bg-zinc-50 border-b border-zinc-200 hidden xl:block sticky top-0 z-30"
      >
        <div style={{ width: `${contentWidth}px`, height: '1px' }}></div>
      </div>
      
      {/* Actual Table Wrapper */}
      <div 
        ref={bottomScrollRef} 
        onScroll={handleBottomScroll}
        className="w-full overflow-x-auto custom-scrollbar flex-1 pb-4"
      >
        {/* We use a w-max container to force the width calculations */}
        <div ref={contentRef} className="w-max min-w-full [&>div]:overflow-visible">
          {children}
        </div>
      </div>
    </div>
  );
};

export default function AccountsMasterPage() {
  const { appUser } = useAuth()
  const { isHQ, isLocked, selectedLocation, setSelectedLocation } = useStoreLocation()
  
  const [activeTab, setActiveTab] = useState("sales_register")
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  
  // --- PAGINATION STATES ---
  const [page, setPage] = useState(1)
  const [recordLimit, setRecordLimit] = useState(100)
  
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; 
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [search, setSearch] = useState('')

  // --- LEDGER STATES ---
  const [invoices, setInvoices] = useState<any[]>([])
  const [estimates, setEstimates] = useState<any[]>([])
  const [customOrders, setCustomOrders] = useState<any[]>([])
  const [buybacks, setBuybacks] = useState<any[]>([])
  const [repairs, setRepairs] = useState<any[]>([])
  
  // --- DYNAMIC KPI STATES ---
  const [salesKpis, setSalesKpis] = useState({ grossSales: 0, taxCollected: 0, b2bSales: 0, b2cSales: 0 })
  const [estimateKpis, setEstimateKpis] = useState({ totalValue: 0, count: 0 })
  const [customKpis, setCustomKpis] = useState({ totalValue: 0, advance: 0, pending: 0 })
  const [buybackKpis, setBuybackKpis] = useState({ gross: 0, deductions: 0, netRefund: 0 })
  const [repairKpis, setRepairKpis] = useState({ estCost: 0, advance: 0, count: 0 })

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
    documentTitle: `Document-${invoiceToPrint?.invoice_number || 'Print'}` 
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

      const from = (page - 1) * recordLimit
      const to = from + recordLimit - 1

      let salesQuery = supabase.from('invoices')
        .select(`*, customers(full_name, pan_no, id, phone), warehouses(name), invoice_items(item_id, rate, inventory_items(item_category, purity_karat, barcode, gross_weight_g, net_weight_g, total_stone_weight_cts, huid_code, hsn_code))`)
        .eq('company_id', appUser.company_id).gte('created_at', startDate).lt('created_at', safeEndDateStr).order('created_at', { ascending: false }).range(from, to)
      if (selectedLocation !== 'ALL') salesQuery = salesQuery.eq('warehouse_id', selectedLocation)
      if (search.trim()) salesQuery = salesQuery.ilike('invoice_number', `%${search.trim()}%`)

      let estQuery = supabase.from('estimates').select('*, customers(full_name, phone)').eq('company_id', appUser.company_id).gte('created_at', startDate).lt('created_at', safeEndDateStr).order('created_at', { ascending: false }).range(from, to)
      if (selectedLocation !== 'ALL') estQuery = estQuery.eq('warehouse_id', selectedLocation)
      if (search.trim()) estQuery = estQuery.ilike('estimate_number', `%${search.trim()}%`)

      let customQuery = supabase.from('custom_orders').select('*, customers(full_name, phone)').eq('company_id', appUser.company_id).gte('created_at', startDate).lt('created_at', safeEndDateStr).order('created_at', { ascending: false }).range(from, to)
      if (selectedLocation !== 'ALL') customQuery = customQuery.eq('origin_warehouse_id', selectedLocation)
      if (search.trim()) customQuery = customQuery.ilike('order_number', `%${search.trim()}%`)

      let buybackQuery = supabase.from('buybacks').select('*, customers(full_name, phone)').eq('company_id', appUser.company_id).gte('created_at', startDate).lt('created_at', safeEndDateStr).order('created_at', { ascending: false }).range(from, to)
      if (selectedLocation !== 'ALL') buybackQuery = buybackQuery.eq('warehouse_id', selectedLocation)
      
      let repairQuery = supabase.from('repair_tickets').select('*, customers(full_name, phone)').eq('company_id', appUser.company_id).gte('created_at', startDate).lt('created_at', safeEndDateStr).order('created_at', { ascending: false }).range(from, to)
      if (selectedLocation !== 'ALL') repairQuery = repairQuery.eq('origin_warehouse_id', selectedLocation)
      if (search.trim()) repairQuery = repairQuery.ilike('ticket_number', `%${search.trim()}%`)

      const [salesRes, estRes, customRes, buybackRes, repairRes] = await Promise.all([salesQuery, estQuery, customQuery, buybackQuery, repairQuery])
      
      const invData = salesRes.data || []
      const eData = estRes.data || []
      const cData = customRes.data || []
      const bData = buybackRes.data || []
      const rData = repairRes.data || []
      
      const allUserIds = [
        ...invData.map(i => i.user_id || i.created_by),
        ...eData.map(i => i.user_id || i.created_by),
        ...cData.map(i => i.user_id || i.created_by),
        ...bData.map(i => i.created_by || i.user_id),
        ...rData.map(i => i.created_by || i.user_id)
      ].filter(Boolean);

      const uniqueUserIds = [...new Set(allUserIds)];
      if (uniqueUserIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('id, full_name, role').in('id', uniqueUserIds);
        if (profilesData) {
          const profileMap = Object.fromEntries(profilesData.map(p => [p.id, p]));
          invData.forEach(item => { item.profiles = profileMap[item.user_id || item.created_by] || null; });
          eData.forEach(item => { item.profiles = profileMap[item.user_id || item.created_by] || null; });
          cData.forEach(item => { item.profiles = profileMap[item.user_id || item.created_by] || null; });
          bData.forEach(item => { item.profiles = profileMap[item.created_by || item.user_id] || null; });
          rData.forEach(item => { item.profiles = profileMap[item.created_by || item.user_id] || null; });
        }
      }

      setInvoices(invData)
      setEstimates(eData)
      setCustomOrders(cData)
      setBuybacks(bData)
      setRepairs(rData)

      let sGross = 0; let sTax = 0; let sB2b = 0; let sB2c = 0;
      invData.forEach(inv => {
        if (inv.status === 'CANCELLED') return;
        const total = Number(inv.final_total) || 0;
        sGross += total;
        sTax += (total - (total / 1.03));
        if (inv.customers?.pan_no) sB2b += total; else sB2c += total;
      })
      setSalesKpis({ grossSales: sGross, taxCollected: sTax, b2bSales: sB2b, b2cSales: sB2c })

      let eTotal = 0;
      eData.forEach(est => eTotal += (Number(est.total_amount) || 0));
      setEstimateKpis({ totalValue: eTotal, count: eData.length })

      let coTotal = 0; let coAdv = 0;
      cData.forEach(co => {
        coTotal += (Number(co.estimated_value) || 0);
        coAdv += (Number(co.advance_paid) || 0);
      });
      setCustomKpis({ totalValue: coTotal, advance: coAdv, pending: Math.max(0, coTotal - coAdv) })

      let bbGross = 0; let bbDed = 0; let bbNet = 0;
      bData.forEach(bb => {
        bbGross += (Number(bb.gross_value) || 0);
        bbDed += (Number(bb.deduction_amount) || 0);
        bbNet += (Number(bb.net_refund) || 0);
      });
      setBuybackKpis({ gross: bbGross, deductions: bbDed, netRefund: bbNet })

      let repCost = 0; let repAdv = 0;
      rData.forEach(rep => {
        repCost += (Number(rep.estimated_cost) || 0);
        repAdv += (Number(rep.advance_paid) || 0);
      });
      setRepairKpis({ estCost: repCost, advance: repAdv, count: rData.length })

    } catch (err: any) {
      toast.error("Failed to load accounting data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
  }, [selectedLocation, startDate, endDate, search, recordLimit, activeTab])

  useEffect(() => {
    const delay = setTimeout(() => { fetchAccountingData() }, 300)
    return () => clearTimeout(delay)
  }, [appUser, selectedLocation, startDate, endDate, search, page, recordLimit])

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
      const headers = [
        "Date", "Invoice Number", "Status", "Branch", "Customer Name", "PAN No", 
        "Item Barcodes", "Item Categories", "Total Gross Wt (g)", "Total Net Wt (g)", "Total Stone Wt (cts)", "HUIDs",
        "Billed By (Name)", "Billed By (Role)", 
        "Subtotal", "Manual Discount", "Voucher Code", "Voucher Discount", "Handling Fee",
        "Exchange Value", "Exchange Notes", 
        "Taxable Value", "CGST", "SGST", "Discounted Total", "Round Off", 
        "Kitty Payment", "Wallet Payment", "Advance Adjusted", "Final Total",
        "Payment Mode", "Split Payments JSON", "Transfer Type", "Transaction Reference", "Payment Remarks", 
        "Cancellation Reason", "Cancelled Original Value"
      ];
      
      const csvRows = invoices.map(inv => {
        const isCancelled = inv.status === 'CANCELLED';
        const barcodes = inv.invoice_items?.map((i:any) => i.inventory_items?.barcode).filter(Boolean).join(', ') || '';
        const categories = inv.invoice_items?.map((i:any) => i.inventory_items?.item_category).filter(Boolean).join(', ') || '';
        const totalGross = inv.invoice_items?.reduce((sum:number, i:any) => sum + (Number(i.inventory_items?.gross_weight_g) || 0), 0) || 0;
        const totalNet = inv.invoice_items?.reduce((sum:number, i:any) => sum + (Number(i.inventory_items?.net_weight_g) || 0), 0) || 0;
        const totalStone = inv.invoice_items?.reduce((sum:number, i:any) => sum + (Number(i.inventory_items?.total_stone_weight_cts) || 0), 0) || 0;
        const huids = inv.invoice_items?.map((i:any) => i.inventory_items?.huid_code).filter(Boolean).join(', ') || '';

        return [
          format(new Date(inv.created_at), 'yyyy-MM-dd HH:mm:ss'), 
          isCancelled ? `*** CANCELLED *** ${inv.invoice_number}` : inv.invoice_number, 
          inv.status || 'VALID', 
          inv.warehouses?.name || 'Unknown',
          inv.customers?.full_name || 'Walk-in', inv.customers?.pan_no || '', barcodes, categories, totalGross.toFixed(3), totalNet.toFixed(3),
          totalStone.toFixed(2), huids, inv.profiles?.full_name || 'System', inv.profiles?.role || 'N/A', 
          
          isCancelled ? 0 : (inv.subtotal || 0),
          isCancelled ? 0 : (inv.discount_amount || 0), 
          inv.voucher_code || '', 
          isCancelled ? 0 : (inv.voucher_discount || 0), 
          isCancelled ? 0 : (inv.Voucher_handling_fee || 0), 
          isCancelled ? 0 : (inv.exchange_value || 0),
          inv.exchange_notes || '', 
          isCancelled ? 0 : (inv.taxable_value || 0), 
          isCancelled ? 0 : (inv.cgst_amount || 0), 
          isCancelled ? 0 : (inv.sgst_amount || 0), 
          isCancelled ? 0 : (inv.discounted_total || 0),
          isCancelled ? 0 : (inv.round_off_amount || 0), 
          isCancelled ? 0 : (inv.kitty_payment || 0), 
          isCancelled ? 0 : (inv.wallet_payment || 0), 
          isCancelled ? 0 : (inv.advance_adjusted || 0), 
          isCancelled ? 0 : (inv.final_total || 0),
          
          inv.payment_mode || '', inv.split_payments ? JSON.stringify(inv.split_payments) : '', inv.transfer_type || '', inv.transaction_reference || '',
          inv.payment_remarks || '', inv.cancellation_reason || '',
          isCancelled ? (inv.final_total || 0) : '' 
        ];
      });
      downloadBlob(headers, csvRows, `Sales_Ledger_${startDate}_to_${endDate}.csv`);
      toast.success("Sales Ledger CSV Downloaded!");
    } 
    else if (activeTab === 'estimates') {
      if (estimates.length === 0) return toast.error("No estimates to export");
      const headers = ["Date", "Estimate Number", "Status", "Customer Name", "Phone", "Created By", "Subtotal", "Discount", "CGST", "SGST", "Final Estimated Total"];
      const csvRows = estimates.map(est => [
        format(new Date(est.created_at), 'yyyy-MM-dd HH:mm:ss'), est.estimate_number, est.status, est.customers?.full_name || 'Walk-in', est.customers?.phone || '', est.profiles?.full_name || 'System',
        est.subtotal, est.discount_amount, est.cgst, est.sgst, est.total_amount
      ]);
      downloadBlob(headers, csvRows, `Estimates_${startDate}_to_${endDate}.csv`);
    }
    else if (activeTab === 'custom_orders') {
      if (customOrders.length === 0) return toast.error("No custom orders to export");
      const headers = ["Date", "Order Number", "Status", "Customer Name", "Phone", "Created By", "Category", "Design Ref", "Exp. Gold (g)", "Exp. Dia (cts)", "Voucher Code", "Estimated Value", "Advance Paid"];
      const csvRows = customOrders.map(co => [
        format(new Date(co.created_at), 'yyyy-MM-dd HH:mm:ss'), co.order_number, co.status, co.customers?.full_name || 'Walk-in', co.customers?.phone || '', co.profiles?.full_name || 'System',
        co.item_category, co.design_reference, co.expected_gold_g, co.expected_diamond_cts, co.voucher_code || '', co.estimated_value, co.advance_paid
      ]);
      downloadBlob(headers, csvRows, `CustomOrders_${startDate}_to_${endDate}.csv`);
    }
    else if (activeTab === 'buybacks') {
      if (buybacks.length === 0) return toast.error("No buybacks to export");
      const headers = ["Date", "Status", "Customer Name", "Phone", "Handled By", "Category", "Purity", "Gross Wt (g)", "Gross Value", "Deductions", "Net Refund"];
      const csvRows = buybacks.map(bb => [
        format(new Date(bb.created_at), 'yyyy-MM-dd HH:mm:ss'), bb.status, bb.customers?.full_name || 'Walk-in', bb.customers?.phone || '', bb.profiles?.full_name || 'System',
        bb.item_category, bb.purity_karat, bb.gross_weight_g, bb.gross_value, bb.deduction_amount, bb.net_refund
      ]);
      downloadBlob(headers, csvRows, `Buybacks_${startDate}_to_${endDate}.csv`);
    }
    else if (activeTab === 'repairs') {
      if (repairs.length === 0) return toast.error("No repairs to export");
      const headers = ["Date", "Ticket Number", "Status", "Customer Name", "Phone", "Handled By", "Description", "Purity", "Gross Wt (g)", "Est. Cost", "Advance Paid"];
      const csvRows = repairs.map(rep => [
        format(new Date(rep.created_at), 'yyyy-MM-dd HH:mm:ss'), rep.ticket_number, rep.status, rep.customers?.full_name || 'Walk-in', rep.customers?.phone || '', rep.profiles?.full_name || 'System',
        rep.item_description, rep.purity, rep.gross_weight_g, rep.estimated_cost, rep.advance_paid
      ]);
      downloadBlob(headers, csvRows, `Repairs_${startDate}_to_${endDate}.csv`);
    }
  }

  const handleOpenPreview = async (item: any, type: 'invoice' | 'estimate' | 'custom' | 'repair' | 'return') => {
    setIsFetchingPreview(true)
    try {
      let mappedData: any = {};

      if (type === 'invoice') {
        const { data: invData, error } = await supabase.from('invoices').select(`*, customers (*), invoice_items (rate, inventory_items (*))`).eq('id', item.id).single()
        if (error) throw error
        const safeItems = invData.invoice_items?.map((i: any) => {
          const it = i.inventory_items || {}
          return { mrp: i.rate || it.mrp || 0, barcode: it.barcode || 'N/A', item_category: it.item_category || 'Jewellery', metal_type: it.metal_type || '-', purity: it.purity_karat || '-', hsn_code: it.hsn_code || '7113', gross_wt: it.gross_weight_g || 0, net_wt: it.net_weight_g || 0, dia_wt: it.total_stone_weight_cts || 0 }
        }) || []
        mappedData = {
          mode: 'normal', invoice_number: invData.invoice_number, date: invData.created_at, customer: invData.customers, subtotal: invData.subtotal, discountAmount: invData.discount_amount, taxableValue: invData.taxable_value, cgstAmount: invData.cgst_amount, sgstAmount: invData.sgst_amount, exchangeValue: invData.exchange_value, voucherAmount: invData.voucher_discount, kittyPayment: invData.kitty_payment || 0, walletPayment: invData.wallet_payment || 0, finalTotal: invData.final_total, items: safeItems
        }
      } 
      else if (type === 'estimate') {
        const { data: estData, error } = await supabase.from('estimates').select(`*, customers(*), estimate_items(mrp, inventory_items(*))`).eq('id', item.id).single();
        if (error) throw error;
        const safeItems = estData.estimate_items?.map((i: any) => {
          const it = i.inventory_items || {}
          return { mrp: i.mrp || 0, barcode: it.barcode || 'N/A', item_category: it.item_category || 'Jewellery', metal_type: it.metal_type || '-', purity: it.purity_karat || '-', hsn_code: it.hsn_code || '7113', gross_wt: it.gross_weight_g || 0, net_wt: it.net_weight_g || 0, dia_wt: it.total_stone_weight_cts || 0 }
        }) || []
        mappedData = {
          mode: 'estimate', invoice_number: estData.estimate_number, date: estData.created_at, customer: estData.customers,
          subtotal: estData.subtotal, discountAmount: estData.discount_amount, handlingFee: estData.handling_charge, cgstAmount: estData.cgst, sgstAmount: estData.sgst, roundOffAmount: estData.round_off, finalTotal: estData.total_amount,
          items: safeItems
        }
      }
      else if (type === 'custom') {
        mappedData = {
          mode: 'custom', invoice_number: item.order_number, date: item.created_at, customer: item.customers,
          customOrder: { designCode: item.design_reference, category: item.item_category, expectedGoldWt: item.expected_gold_g, expectedDiamondCts: item.expected_diamond_cts, estimatedValue: item.estimated_value, advancePayment: item.advance_paid },
          finalTotal: item.advance_paid
        }
      }
      else if (type === 'repair') {
        mappedData = {
          mode: 'repair', invoice_number: item.ticket_number, date: item.created_at, customer: item.customers,
          repair: { purity: item.purity, itemDescription: item.item_description, grossWeight: item.gross_weight_g, estimatedCost: item.estimated_cost },
          finalTotal: item.advance_paid
        }
      }
      else if (type === 'return') {
        mappedData = {
          mode: 'return', invoice_number: `RTN-${item.id.substring(0,6).toUpperCase()}`, date: item.created_at, customer: item.customers,
          returnDetails: { purity: item.purity_karat, itemDescription: item.item_category, grossWeight: item.gross_weight_g, articleCost: item.gross_value, discountApplied: item.deduction_amount, calculatedRefund: item.net_refund },
          finalTotal: item.net_refund
        }
      }

      setInvoiceToPrint(mappedData)
      setShowPreviewModal(true)
    } catch (err) { toast.error('Failed to format document for printing') } 
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
        await supabase.from('inventory_items').update({ status: 'in_stock' }).in('id', itemIds);
      }

      if (invoiceToCancel.voucher_code) {
        await supabase.from('vouchers').update({ status: 'registered' }).eq('code', invoiceToCancel.voucher_code);
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
    const d = new Date(inv.created_at);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0,16);

    setEditForm({
      invoice_number: inv.invoice_number || '',
      created_at: localISOTime,
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
    
    const newInvoiceNo = editForm.invoice_number?.trim().toUpperCase();
    if (!newInvoiceNo) return toast.error("Invoice number cannot be empty.");

    setIsEditing(true);
    try {
      if (newInvoiceNo !== invoiceToEdit.invoice_number) {
        const { data: existing, error: checkErr } = await supabase
          .from('invoices')
          .select('id')
          .eq('company_id', appUser.company_id)
          .eq('invoice_number', newInvoiceNo)
          .maybeSingle();

        if (existing) {
          toast.error(`Invoice number ${newInvoiceNo} is already in use!`);
          setIsEditing(false);
          return;
        }
        if (checkErr) throw checkErr;
      }

      const { error } = await supabase.from('invoices').update({
        invoice_number: newInvoiceNo,
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

      toast.success("Invoice financials and metadata updated successfully.");
      setInvoiceToEdit(null);
      fetchAccountingData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update the invoice.");
    } finally {
      setIsEditing(false);
    }
  };

  const PaginationControls = () => (
    <div className="flex items-center justify-between border-t border-zinc-200 bg-white p-3 rounded-b-2xl">
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 font-medium">Show</span>
        <Select value={recordLimit.toString()} onValueChange={(val) => setRecordLimit(Number(val))}>
          <SelectTrigger className="h-8 w-20 text-xs border-zinc-200 bg-zinc-50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="100">100</SelectItem>
            <SelectItem value="200">200</SelectItem>
            <SelectItem value="500">500</SelectItem>
            <SelectItem value="1000">1000</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-zinc-500 font-medium">records</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-zinc-500 font-medium hidden sm:block">Page {page}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1 || loading}>
            <ChevronLeft className="w-3 h-3 mr-1" /> Prev
          </Button>
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setPage(page + 1)} disabled={loading}>
            Next <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );

  // ✨ FIXED: SAFELY PARSES JSON OR STRINGIFIED JSON FOR SPLIT PAYMENTS
  const renderPaymentMode = (inv: any) => {
    if (inv.status === 'CANCELLED') return <span className="px-2 py-1 rounded bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-wider">CANCELLED</span>;
    
    // Safely attempt to parse split_payments if it was returned as a string from the DB
    let splits = inv.split_payments;
    if (typeof splits === 'string') {
      try { splits = JSON.parse(splits); } 
      catch (e) { splits = null; }
    }

    return (
      <div className="flex flex-col items-start gap-1">
        <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-700 text-[10px] font-bold uppercase tracking-wider">
          {inv.payment_mode || 'UNKNOWN'}
        </span>
        
        {inv.payment_mode === 'SPLIT' && splits && typeof splits === 'object' && (
          <div className="flex flex-col gap-0.5 mt-1 border-l-2 border-indigo-200 pl-2">
            {Object.entries(splits).map(([method, amount]: any) => (
              <span key={method} className="text-[9px] font-medium text-zinc-500">
                <strong className="text-zinc-700">{method}:</strong> ₹{Number(amount).toLocaleString()}
              </span>
            ))}
          </div>
        )}

        {Number(inv.advance_adjusted) > 0 && (
          <span className="text-[9px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mt-0.5 border border-amber-100">
            <strong>Advance Used:</strong> ₹{Number(inv.advance_adjusted).toLocaleString()}
          </span>
        )}
      </div>
    );
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

      <main className="print:hidden p-3 sm:p-6 md:p-8 max-w-[1600px] w-full min-w-0 mx-auto space-y-5 animate-in fade-in duration-500">
        
        {/* MOBILE-OPTIMIZED FILTERS */}
        <div className="flex flex-col gap-2.5 bg-white p-3 sm:p-2.5 rounded-2xl border border-zinc-200 shadow-sm w-full">
          <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input placeholder="Search Ref / Code..." className="pl-9 h-10 sm:h-9 text-sm sm:text-xs rounded-xl sm:rounded-full bg-zinc-50 border-zinc-200 focus-visible:ring-zinc-400 font-medium text-zinc-800" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            
            <Button variant={showFilters ? "default" : "outline"} size="icon" className={`h-10 w-10 sm:h-9 sm:w-9 rounded-xl sm:rounded-full sm:hidden shrink-0 transition-colors ${showFilters ? 'bg-zinc-900 text-white' : 'border-zinc-200 text-zinc-600'}`} onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-zinc-200 shrink-0 hidden sm:flex text-zinc-600 hover:bg-zinc-100" onClick={fetchAccountingData}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {/* ✨ UNIVERSAL EXPORT BUTTON FOR ALL TABS */}
            <Button className="h-9 text-xs font-medium rounded-full hidden sm:flex shrink-0 text-zinc-700 border border-zinc-200 bg-white hover:bg-zinc-50 shadow-sm" onClick={handleExportCSV}>
              <Download className="mr-2 h-3.5 w-3.5" /> Export Data to CSV
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
              <Download className="mr-2 h-4 w-4" /> Export Data to CSV
            </Button>
          </div>
        </div>

        {/* DYNAMIC ACCOUNTING KPIs BASED ON TAB */}
        {activeTab === 'sales_register' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full animate-in fade-in duration-300">
            <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl w-full">
              <CardContent className="p-4 sm:p-5">
                <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-zinc-400" /> Gross Value (inc. GST)</p>
                {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">₹{salesKpis.grossSales.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
              </CardContent>
            </Card>
            <Card className="shadow-sm border-emerald-200 bg-emerald-50/40 rounded-2xl w-full">
              <CardContent className="p-4 sm:p-5">
                <p className="text-[10px] sm:text-[11px] font-medium text-emerald-700 mb-1 flex items-center gap-1.5"><Scale className="h-3.5 w-3.5" /> Est. Tax Liability</p>
                {loading ? <Skeleton className="h-8 w-20 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-emerald-900 mt-1">₹{salesKpis.taxCollected.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
              </CardContent>
            </Card>
            <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl w-full">
              <CardContent className="p-4 sm:p-5">
                <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5 text-zinc-400" /> B2B Activity</p>
                {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">₹{salesKpis.b2bSales.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
              </CardContent>
            </Card>
            <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl w-full">
              <CardContent className="p-4 sm:p-5">
                <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5 text-zinc-400" /> B2C Activity</p>
                {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">₹{salesKpis.b2cSales.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'estimates' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full animate-in fade-in duration-300">
            <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl w-full">
              <CardContent className="p-4 sm:p-5">
                <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-zinc-400" /> Total Quoted Value</p>
                {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">₹{estimateKpis.totalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
              </CardContent>
            </Card>
            <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl w-full">
              <CardContent className="p-4 sm:p-5">
                <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-zinc-400" /> Quotes Generated</p>
                {loading ? <Skeleton className="h-8 w-20 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">{estimateKpis.count}</p>}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'custom_orders' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full animate-in fade-in duration-300">
            <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl w-full">
              <CardContent className="p-4 sm:p-5">
                <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5"><Box className="h-3.5 w-3.5 text-zinc-400" /> Total Order Value</p>
                {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">₹{customKpis.totalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
              </CardContent>
            </Card>
            <Card className="shadow-sm border-emerald-200 bg-emerald-50/40 rounded-2xl w-full">
              <CardContent className="p-4 sm:p-5">
                <p className="text-[10px] sm:text-[11px] font-medium text-emerald-700 mb-1 flex items-center gap-1.5"><HandCoins className="h-3.5 w-3.5" /> Advance Collected</p>
                {loading ? <Skeleton className="h-8 w-20 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-emerald-900 mt-1">₹{customKpis.advance.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
              </CardContent>
            </Card>
            <Card className="shadow-sm border-amber-200 bg-amber-50/40 rounded-2xl w-full">
              <CardContent className="p-4 sm:p-5">
                <p className="text-[10px] sm:text-[11px] font-medium text-amber-700 mb-1 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Pending Balance</p>
                {loading ? <Skeleton className="h-8 w-20 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-amber-900 mt-1">₹{customKpis.pending.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'buybacks' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full animate-in fade-in duration-300">
            <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl w-full">
              <CardContent className="p-4 sm:p-5">
                <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5"><ArrowRightLeft className="h-3.5 w-3.5 text-zinc-400" /> Gross Intake Value</p>
                {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">₹{buybackKpis.gross.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
              </CardContent>
            </Card>
            <Card className="shadow-sm border-rose-200 bg-rose-50/40 rounded-2xl w-full">
              <CardContent className="p-4 sm:p-5">
                <p className="text-[10px] sm:text-[11px] font-medium text-rose-700 mb-1 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Policy Deductions</p>
                {loading ? <Skeleton className="h-8 w-20 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-rose-900 mt-1">₹{buybackKpis.deductions.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
              </CardContent>
            </Card>
            <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl w-full">
              <CardContent className="p-4 sm:p-5">
                <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5"><HandCoins className="h-3.5 w-3.5 text-zinc-400" /> Net Total Refunds</p>
                {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">₹{buybackKpis.netRefund.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'repairs' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full animate-in fade-in duration-300">
            <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl w-full">
              <CardContent className="p-4 sm:p-5">
                <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5 text-zinc-400" /> Total Est. Cost</p>
                {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">₹{repairKpis.estCost.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
              </CardContent>
            </Card>
            <Card className="shadow-sm border-emerald-200 bg-emerald-50/40 rounded-2xl w-full">
              <CardContent className="p-4 sm:p-5">
                <p className="text-[10px] sm:text-[11px] font-medium text-emerald-700 mb-1 flex items-center gap-1.5"><HandCoins className="h-3.5 w-3.5" /> Advance Collected</p>
                {loading ? <Skeleton className="h-8 w-20 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-emerald-900 mt-1">₹{repairKpis.advance.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>}
              </CardContent>
            </Card>
            <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl w-full">
              <CardContent className="p-4 sm:p-5">
                <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-zinc-400" /> Total Tickets</p>
                {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">{repairKpis.count}</p>}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ACCOUNTING TABS */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0">
          <div className="w-full overflow-x-auto no-scrollbar pb-2">
            <TabsList className="bg-transparent border-none p-0 h-auto flex justify-start w-max gap-2">
              <TabsTrigger value="sales_register" className="rounded-full h-9 sm:h-10 text-xs sm:text-sm font-bold px-5 py-0 bg-white border border-zinc-200 data-[state=active]:bg-zinc-900 data-[state=active]:text-white transition-all shrink-0 shadow-sm">Sales Register</TabsTrigger>
              <TabsTrigger value="estimates" className="rounded-full h-9 sm:h-10 text-xs sm:text-sm font-bold px-5 py-0 bg-white border border-zinc-200 data-[state=active]:bg-zinc-900 data-[state=active]:text-white transition-all shrink-0 shadow-sm">Estimates / Quotes</TabsTrigger>
              <TabsTrigger value="custom_orders" className="rounded-full h-9 sm:h-10 text-xs sm:text-sm font-bold px-5 py-0 bg-white border border-zinc-200 data-[state=active]:bg-zinc-900 data-[state=active]:text-white transition-all shrink-0 shadow-sm">Custom Orders</TabsTrigger>
              <TabsTrigger value="buybacks" className="rounded-full h-9 sm:h-10 text-xs sm:text-sm font-bold px-5 py-0 bg-white border border-zinc-200 data-[state=active]:bg-zinc-900 data-[state=active]:text-white transition-all shrink-0 shadow-sm">Returns & Buybacks</TabsTrigger>
              <TabsTrigger value="repairs" className="rounded-full h-9 sm:h-10 text-xs sm:text-sm font-bold px-5 py-0 bg-white border border-zinc-200 data-[state=active]:bg-zinc-900 data-[state=active]:text-white transition-all shrink-0 shadow-sm">Repair Tickets</TabsTrigger>
            </TabsList>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: SALES REGISTER */}
          {/* ========================================================================= */}
          <TabsContent value="sales_register" className="m-0 pt-2 w-full min-w-0">
            <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl w-full min-w-0 flex flex-col">
              
              {/* ✨ DESKTOP TABLE VIEW WITH TOP SCROLL SYNC */}
              <SyncedTableWrapper>
                <Table className="w-full whitespace-nowrap border-b border-zinc-200">
                  <TableHeader className="bg-zinc-50/80 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                    <TableRow className="hover:bg-transparent border-zinc-200">
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-4 bg-zinc-50 z-20 w-[60px] text-center sticky left-0 border-r border-zinc-200">Actions</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-4 bg-zinc-50 z-20">Date</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-50 z-20">Invoice No</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-50 z-20 border-r border-zinc-200">Status</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Customer</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-l border-zinc-200 pl-4">Billed By</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider min-w-[200px]">Items Sold</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-teal-600 uppercase tracking-wider border-l border-zinc-200">Voucher</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right bg-slate-50/50 border-l border-zinc-200">Subtotal</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right bg-slate-50/50 border-l border-zinc-200">Taxable Val</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right bg-emerald-50/30">CGST</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right bg-emerald-50/30">SGST</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right bg-slate-100 border-l border-zinc-200">Final Total</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-l border-zinc-200 pl-4">Payment Breakdown</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.length === 0 ? (
                      <TableRow><TableCell colSpan={14} className="text-center py-12 text-zinc-400">No sales records found</TableCell></TableRow>
                    ) : invoices.map((inv) => {
                      const isCancelled = inv.status === 'CANCELLED'
                      return (
                        <TableRow key={inv.id} className={`border-zinc-100 hover:bg-zinc-50/50 transition-colors group ${isCancelled ? 'opacity-60 bg-red-50/30 hover:bg-red-50/50' : ''}`}>
                          <TableCell className="px-4 py-2 text-center align-middle sticky left-0 bg-white group-hover:bg-zinc-50 z-10 border-r border-zinc-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-48 rounded-xl shadow-lg border-zinc-200">
                                <DropdownMenuItem onClick={() => handleOpenPreview(inv, 'invoice')} className="cursor-pointer py-2"><Eye className="w-4 h-4 mr-2 text-indigo-500" /> View / Print Bill</DropdownMenuItem>
                                {!isCancelled && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleOpenEdit(inv)} className="cursor-pointer py-2"><Edit2 className="w-4 h-4 mr-2 text-amber-500" /> Edit Financials</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setInvoiceToCancel(inv)} className="cursor-pointer py-2 text-red-600 focus:bg-red-50 focus:text-red-700"><XCircle className="w-4 h-4 mr-2" /> Cancel Invoice</DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell className="px-4 py-2 text-[12px] font-medium text-zinc-600 whitespace-nowrap">{format(new Date(inv.created_at), 'dd MMM yy, HH:mm')}</TableCell>
                          <TableCell className="py-2 font-mono text-[12px] font-semibold text-zinc-900 border-r border-zinc-100">{inv.invoice_number} {isCancelled && <div className="text-[9px] text-red-500 font-bold uppercase tracking-widest mt-0.5">Voided</div>}</TableCell>
                          <TableCell className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${isCancelled ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>{inv.status || 'VALID'}</span></TableCell>
                          <TableCell className="px-4 py-2 min-w-[160px]"><span className="text-[12px] font-semibold text-zinc-800 whitespace-nowrap truncate">{inv.customers?.full_name || 'Walk-in'}</span></TableCell>
                          <TableCell className="px-4 py-2 border-l border-zinc-200"><span className="text-[12px] font-medium text-zinc-700 whitespace-nowrap">{inv.profiles?.full_name || 'System'}</span></TableCell>
                          <TableCell className="py-2 min-w-[200px]">
                             <div className="flex flex-col gap-1 max-h-[40px] overflow-y-auto custom-scrollbar pr-1">
                               {inv.invoice_items?.map((i: any, idx: number) => <span key={idx} className="text-[10px] font-medium text-zinc-600 bg-zinc-100/50 px-1.5 py-0.5 rounded truncate"><span className="font-mono font-bold text-zinc-400 mr-1">[{i.inventory_items?.barcode || '?'}]</span>{i.inventory_items?.item_category || 'Item'}</span>)}
                             </div>
                          </TableCell>

                          <TableCell className="px-4 py-2 border-l border-zinc-200">
                             {inv.voucher_code ? (
                                <div className="flex flex-col">
                                   <span className="text-[10px] font-mono font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded uppercase">{inv.voucher_code}</span>
                                   <span className="text-[10px] font-bold text-teal-600 mt-0.5">- ₹{Number(inv.voucher_discount).toLocaleString()}</span>
                                </div>
                             ) : (
                                <span className="text-[10px] text-zinc-400 font-medium">None</span>
                             )}
                          </TableCell>

                          <TableCell className="py-2 text-right text-[12px] font-medium text-zinc-700 bg-slate-50/50 border-l border-zinc-200">₹{(Number(inv.subtotal) || 0).toLocaleString()}</TableCell>
                          <TableCell className="py-2 text-right text-[12px] font-bold text-zinc-800 bg-slate-50/50 border-l border-zinc-200">₹{(Number(inv.taxable_value) || 0).toLocaleString()}</TableCell>
                          <TableCell className="py-2 text-right text-[12px] font-medium text-emerald-600 bg-emerald-50/30">₹{(Number(inv.cgst_amount) || 0).toLocaleString()}</TableCell>
                          <TableCell className="py-2 text-right text-[12px] font-medium text-emerald-600 bg-emerald-50/30">₹{(Number(inv.sgst_amount) || 0).toLocaleString()}</TableCell>
                          <TableCell className="py-2 text-right text-[13px] font-black text-zinc-900 bg-slate-100 border-l border-zinc-200">₹{(Number(inv.final_total) || 0).toLocaleString()}</TableCell>
                          
                          {/* ✨ DETAILED PAYMENT BREAKDOWN */}
                          <TableCell className="px-4 py-2 border-l border-zinc-200 align-top">
                             {renderPaymentMode(inv)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </SyncedTableWrapper>

              {/* ✨ MOBILE & TABLET CARD VIEW */}
              <div className="xl:hidden flex flex-col divide-y divide-zinc-100 flex-1 overflow-y-auto">
                {invoices.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400 text-sm">No sales records found</div>
                ) : invoices.map((inv) => {
                  const isCancelled = inv.status === 'CANCELLED';
                  return (
                    <div key={inv.id} className={`p-4 flex flex-col gap-3 relative ${isCancelled ? 'opacity-60 bg-red-50/30' : 'bg-white'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-bold text-zinc-900">{inv.invoice_number}</span>
                            <Badge className={`text-[9px] uppercase tracking-widest ${isCancelled ? 'bg-red-100 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{inv.status || 'VALID'}</Badge>
                          </div>
                          <div className="text-[11px] text-zinc-500 font-medium">{format(new Date(inv.created_at), 'dd MMM yy, hh:mm a')}</div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8 rounded-lg text-zinc-600 border-zinc-200"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border-zinc-200">
                            <DropdownMenuItem onClick={() => handleOpenPreview(inv, 'invoice')} className="cursor-pointer py-2"><Eye className="w-4 h-4 mr-2 text-indigo-500" /> View Bill</DropdownMenuItem>
                            {!isCancelled && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleOpenEdit(inv)} className="cursor-pointer py-2"><Edit2 className="w-4 h-4 mr-2 text-amber-500" /> Edit Financials</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setInvoiceToCancel(inv)} className="cursor-pointer py-2 text-red-600 focus:bg-red-50"><XCircle className="w-4 h-4 mr-2" /> Cancel Invoice</DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="flex justify-between bg-zinc-50/50 p-2.5 rounded-lg border border-zinc-100">
                        <div>
                          <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5 flex items-center gap-1"><User className="w-3 h-3"/> Customer</p>
                          <p className="text-xs font-semibold text-zinc-800">{inv.customers?.full_name || 'Walk-in'}</p>
                          {inv.customers?.phone && <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{inv.customers.phone}</p>}
                        </div>
                        <div className="text-right border-l border-zinc-200 pl-3">
                          <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Billed By</p>
                          <p className="text-xs font-semibold text-zinc-800">{inv.profiles?.full_name || 'System'}</p>
                        </div>
                      </div>

                      {inv.voucher_code && (
                         <div className="flex justify-between items-center bg-teal-50/50 px-2.5 py-1.5 rounded-lg border border-teal-100">
                            <div className="flex items-center gap-1.5">
                               <Ticket className="w-3 h-3 text-teal-600" />
                               <span className="text-[10px] font-mono font-bold text-teal-700 uppercase">{inv.voucher_code}</span>
                            </div>
                            <span className="text-[10px] font-bold text-teal-600">- ₹{Number(inv.voucher_discount).toLocaleString()}</span>
                         </div>
                      )}

                      <div className="flex justify-between items-end pt-2 border-t border-zinc-100">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Pay Breakdown</p>
                          {renderPaymentMode(inv)}
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Final Total</p>
                          <p className="text-lg font-black text-indigo-600 tracking-tight">₹{(Number(inv.final_total) || 0).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <PaginationControls />
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 2: ESTIMATES */}
          {/* ========================================================================= */}
          <TabsContent value="estimates" className="m-0 pt-2 w-full min-w-0">
            <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl w-full min-w-0 flex flex-col">
              <SyncedTableWrapper>
                <Table className="w-full whitespace-nowrap border-b border-zinc-200">
                  <TableHeader className="bg-slate-50/80 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                    <TableRow className="hover:bg-transparent border-zinc-200">
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-4 bg-zinc-50 z-20 w-[60px] text-center sticky left-0 border-r border-zinc-200">Actions</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-4 bg-zinc-50 z-20">Date</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-50 z-20">Estimate No</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-50 z-20 border-r border-zinc-200">Status</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Customer / Contact</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-l border-zinc-200 pl-4">Created By</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right bg-slate-50/50 border-l border-zinc-200">Subtotal</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right bg-slate-50/50 border-l border-zinc-200">Discount</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right bg-slate-100 border-l border-zinc-200">Estimated Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {estimates.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-12 text-zinc-400">No estimates found</TableCell></TableRow>
                    ) : estimates.map((est) => (
                        <TableRow key={est.id} className="border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                          <TableCell className="px-4 py-2 text-center align-middle sticky left-0 bg-white group-hover:bg-zinc-50 z-10 border-r border-zinc-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => handleOpenPreview(est, 'estimate')}><Eye className="h-4 w-4" /></Button>
                          </TableCell>
                          <TableCell className="px-4 py-2 text-[12px] font-medium text-zinc-600 whitespace-nowrap">{format(new Date(est.created_at), 'dd MMM yy, HH:mm')}</TableCell>
                          <TableCell className="py-2 font-mono text-[12px] font-semibold text-zinc-900 border-r border-zinc-100">{est.estimate_number}</TableCell>
                          <TableCell className="px-4 py-2"><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-200">{est.status}</span></TableCell>
                          <TableCell className="px-4 py-2 min-w-[160px]">
                            <span className="text-[12px] font-semibold text-zinc-800 whitespace-nowrap truncate block">{est.customers?.full_name || 'Walk-in'}</span>
                            {est.customers?.phone && <span className="text-[10px] text-zinc-500 font-mono">{est.customers.phone}</span>}
                          </TableCell>
                          <TableCell className="px-4 py-2 border-l border-zinc-200"><span className="text-[12px] font-medium text-zinc-700 whitespace-nowrap">{est.profiles?.full_name || 'System'}</span></TableCell>
                          <TableCell className="py-2 text-right text-[12px] font-medium text-zinc-700 bg-slate-50/50 border-l border-zinc-200">₹{(Number(est.subtotal) || 0).toLocaleString()}</TableCell>
                          <TableCell className="py-2 text-right text-[12px] font-bold text-red-500 bg-slate-50/50 border-l border-zinc-200">₹{(Number(est.discount_amount) || 0).toLocaleString()}</TableCell>
                          <TableCell className="py-2 text-right text-[13px] font-black text-zinc-900 bg-slate-100 border-l border-zinc-200">₹{(Number(est.total_amount) || 0).toLocaleString()}</TableCell>
                        </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SyncedTableWrapper>

              <div className="xl:hidden flex flex-col divide-y divide-zinc-100 flex-1 overflow-y-auto">
                {estimates.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400 text-sm">No estimates found</div>
                ) : estimates.map((est) => (
                  <div key={est.id} className="p-4 flex flex-col gap-3 bg-white">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-bold text-zinc-900">{est.estimate_number}</span>
                          <Badge className="bg-blue-50 text-blue-600 border-blue-200 text-[9px] uppercase tracking-widest">{est.status}</Badge>
                        </div>
                        <div className="text-[11px] text-zinc-500 font-medium">{format(new Date(est.created_at), 'dd MMM yy, hh:mm a')}</div>
                      </div>
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg text-indigo-600 border-zinc-200 hover:bg-indigo-50" onClick={() => handleOpenPreview(est, 'estimate')}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex justify-between bg-zinc-50/50 p-2.5 rounded-lg border border-zinc-100">
                      <div>
                        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Customer</p>
                        <p className="text-xs font-semibold text-zinc-800">{est.customers?.full_name || 'Walk-in'}</p>
                        {est.customers?.phone && <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{est.customers.phone}</p>}
                      </div>
                      <div className="text-right border-l border-zinc-200 pl-3">
                        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Created By</p>
                        <p className="text-xs font-semibold text-zinc-800">{est.profiles?.full_name || 'System'}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-end pt-2 border-t border-zinc-100">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Subtotal / Discount</p>
                        <p className="text-[10px] font-medium text-zinc-600">₹{(Number(est.subtotal) || 0).toLocaleString()} <span className="text-red-500 ml-1">(-₹{(Number(est.discount_amount) || 0).toLocaleString()})</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Estimated Total</p>
                        <p className="text-lg font-black text-zinc-900 tracking-tight">₹{(Number(est.total_amount) || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <PaginationControls />
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 3: CUSTOM ORDERS */}
          {/* ========================================================================= */}
          <TabsContent value="custom_orders" className="m-0 pt-2 w-full min-w-0">
            <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl w-full min-w-0 flex flex-col">
              <SyncedTableWrapper>
                <Table className="w-full whitespace-nowrap border-b border-zinc-200">
                  <TableHeader className="bg-purple-50/50 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                    <TableRow className="hover:bg-transparent border-purple-100">
                      <TableHead className="h-11 text-[10px] font-bold text-purple-700 uppercase tracking-wider px-4 bg-purple-50/50 z-20 w-[60px] text-center sticky left-0 border-r border-purple-100">Actions</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-purple-700 uppercase tracking-wider px-4">Date</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-purple-700 uppercase tracking-wider">Order No</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-purple-700 uppercase tracking-wider border-r border-purple-100">Status</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-purple-700 uppercase tracking-wider">Customer</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-purple-700 uppercase tracking-wider border-l border-purple-100 pl-4">Created By</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-purple-700 uppercase tracking-wider">Category / Design</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-teal-700 uppercase tracking-wider border-l border-purple-100">Voucher</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-purple-700 uppercase tracking-wider text-right border-l border-purple-100">Est. Value</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-purple-700 uppercase tracking-wider text-right border-l border-purple-100">Advance Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customOrders.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-12 text-zinc-400">No custom orders found</TableCell></TableRow>
                    ) : customOrders.map((co) => (
                        <TableRow key={co.id} className="border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                          <TableCell className="px-4 py-2 text-center align-middle sticky left-0 bg-white group-hover:bg-zinc-50 z-10 border-r border-zinc-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-purple-500 hover:text-purple-700 hover:bg-purple-100" onClick={() => handleOpenPreview(co, 'custom')}><Eye className="h-4 w-4" /></Button>
                          </TableCell>
                          <TableCell className="px-4 py-2 text-[12px] font-medium text-zinc-600 whitespace-nowrap">{format(new Date(co.created_at), 'dd MMM yy, HH:mm')}</TableCell>
                          <TableCell className="py-2 font-mono text-[12px] font-semibold text-zinc-900 border-r border-zinc-100">{co.order_number}</TableCell>
                          <TableCell className="px-4 py-2"><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-purple-100 text-purple-700 border border-purple-200">{co.status.replace(/_/g, ' ')}</span></TableCell>
                          <TableCell className="px-4 py-2 min-w-[160px]">
                            <span className="text-[12px] font-semibold text-zinc-800 whitespace-nowrap truncate block">{co.customers?.full_name || 'Walk-in'}</span>
                            {co.customers?.phone && <span className="text-[10px] text-zinc-500 font-mono">{co.customers.phone}</span>}
                          </TableCell>
                          <TableCell className="px-4 py-2 border-l border-purple-100"><span className="text-[12px] font-medium text-zinc-700 whitespace-nowrap">{co.profiles?.full_name || 'System'}</span></TableCell>
                          <TableCell className="py-2">
                             <span className="text-[12px] font-semibold text-zinc-800 block">{co.item_category}</span>
                             <span className="text-[10px] text-zinc-500 font-mono">{co.design_reference}</span>
                          </TableCell>
                          <TableCell className="px-4 py-2 border-l border-purple-100">
                             {co.voucher_code ? (
                                <div className="flex flex-col">
                                   <span className="text-[10px] font-mono font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded uppercase">{co.voucher_code}</span>
                                   <span className="text-[10px] font-bold text-teal-600 mt-0.5">- ₹{Number(co.voucher_amount).toLocaleString()}</span>
                                </div>
                             ) : (
                                <span className="text-[10px] text-zinc-400 font-medium">None</span>
                             )}
                          </TableCell>
                          <TableCell className="py-2 text-right text-[12px] font-medium text-zinc-700 border-l border-purple-100">₹{(Number(co.estimated_value) || 0).toLocaleString()}</TableCell>
                          <TableCell className="py-2 text-right text-[13px] font-black text-emerald-600 border-l border-purple-100">₹{(Number(co.advance_paid) || 0).toLocaleString()}</TableCell>
                        </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SyncedTableWrapper>

              <div className="xl:hidden flex flex-col divide-y divide-zinc-100 flex-1 overflow-y-auto">
                {customOrders.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400 text-sm">No custom orders found</div>
                ) : customOrders.map((co) => (
                  <div key={co.id} className="p-4 flex flex-col gap-3 bg-white">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-bold text-zinc-900">{co.order_number}</span>
                          <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[9px] uppercase tracking-widest">{co.status.replace(/_/g, ' ')}</Badge>
                        </div>
                        <div className="text-[11px] text-zinc-500 font-medium">{format(new Date(co.created_at), 'dd MMM yy, hh:mm a')}</div>
                      </div>
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg text-purple-600 border-zinc-200 hover:bg-purple-50" onClick={() => handleOpenPreview(co, 'custom')}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex justify-between bg-zinc-50/50 p-2.5 rounded-lg border border-zinc-100">
                      <div>
                        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Customer</p>
                        <p className="text-xs font-semibold text-zinc-800">{co.customers?.full_name || 'Walk-in'}</p>
                        {co.customers?.phone && <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{co.customers.phone}</p>}
                      </div>
                      <div className="text-right border-l border-zinc-200 pl-3">
                        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Created By</p>
                        <p className="text-xs font-semibold text-zinc-800">{co.profiles?.full_name || 'System'}</p>
                      </div>
                    </div>

                    {co.voucher_code && (
                       <div className="flex justify-between items-center bg-teal-50/50 px-2.5 py-1.5 rounded-lg border border-teal-100">
                          <div className="flex items-center gap-1.5">
                             <Ticket className="w-3 h-3 text-teal-600" />
                             <span className="text-[10px] font-mono font-bold text-teal-700 uppercase">{co.voucher_code}</span>
                          </div>
                          <span className="text-[10px] font-bold text-teal-600">- ₹{Number(co.voucher_amount).toLocaleString()}</span>
                       </div>
                    )}

                    <div className="mt-1">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Category / Design</p>
                      <p className="text-xs font-semibold text-zinc-800">{co.item_category} <span className="text-[10px] text-zinc-500 font-mono ml-1">({co.design_reference})</span></p>
                    </div>

                    <div className="flex justify-between items-end pt-2 border-t border-zinc-100">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Est. Value</p>
                        <p className="text-xs font-medium text-zinc-700">₹{(Number(co.estimated_value) || 0).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Advance Paid</p>
                        <p className="text-lg font-black text-emerald-600 tracking-tight">₹{(Number(co.advance_paid) || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <PaginationControls />
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 4: BUYBACKS / RETURNS */}
          {/* ========================================================================= */}
          <TabsContent value="buybacks" className="m-0 pt-2 w-full min-w-0">
            <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl w-full min-w-0 flex flex-col">
              <SyncedTableWrapper>
                <Table className="w-full whitespace-nowrap border-b border-zinc-200">
                  <TableHeader className="bg-rose-50/50 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                    <TableRow className="hover:bg-transparent border-rose-100">
                      <TableHead className="h-11 text-[10px] font-bold text-rose-700 uppercase tracking-wider px-4 bg-rose-50/50 z-20 w-[60px] text-center sticky left-0 border-r border-rose-100">Actions</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-rose-700 uppercase tracking-wider px-4">Date</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-rose-700 uppercase tracking-wider border-r border-rose-100">Status</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-rose-700 uppercase tracking-wider">Customer</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-rose-700 uppercase tracking-wider border-l border-rose-100 pl-4">Handled By</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-rose-700 uppercase tracking-wider">Physical Details</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-rose-700 uppercase tracking-wider text-right border-l border-rose-100">Gross Value</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-rose-700 uppercase tracking-wider text-right border-l border-rose-100">Deductions</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-rose-700 uppercase tracking-wider text-right border-l border-rose-100">Net Refund</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {buybacks.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-12 text-zinc-400">No buyback records found</TableCell></TableRow>
                    ) : buybacks.map((bb) => (
                        <TableRow key={bb.id} className="border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                          <TableCell className="px-4 py-2 text-center align-middle sticky left-0 bg-white group-hover:bg-zinc-50 z-10 border-r border-zinc-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-100" onClick={() => handleOpenPreview(bb, 'return')}><Eye className="h-4 w-4" /></Button>
                          </TableCell>
                          <TableCell className="px-4 py-2 text-[12px] font-medium text-zinc-600 whitespace-nowrap">{format(new Date(bb.created_at), 'dd MMM yy, HH:mm')}</TableCell>
                          <TableCell className="px-4 py-2 border-r border-zinc-100"><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-rose-100 text-rose-700 border border-rose-200">{bb.status}</span></TableCell>
                          <TableCell className="px-4 py-2 min-w-[160px]">
                            <span className="text-[12px] font-semibold text-zinc-800 whitespace-nowrap truncate block">{bb.customers?.full_name || 'Walk-in'}</span>
                            {bb.customers?.phone && <span className="text-[10px] text-zinc-500 font-mono">{bb.customers.phone}</span>}
                          </TableCell>
                          <TableCell className="px-4 py-2 border-l border-rose-100"><span className="text-[12px] font-medium text-zinc-700 whitespace-nowrap">{bb.profiles?.full_name || 'System'}</span></TableCell>
                          <TableCell className="py-2">
                             <span className="text-[12px] font-semibold text-zinc-800 block">{bb.item_category} ({bb.purity_karat})</span>
                             <span className="text-[10px] text-zinc-500 font-mono">Gross Wt: {bb.gross_weight_g}g</span>
                          </TableCell>
                          <TableCell className="py-2 text-right text-[12px] font-medium text-zinc-700 border-l border-zinc-200">₹{(Number(bb.gross_value) || 0).toLocaleString()}</TableCell>
                          <TableCell className="py-2 text-right text-[12px] font-bold text-rose-500 border-l border-zinc-200">- ₹{(Number(bb.deduction_amount) || 0).toLocaleString()}</TableCell>
                          <TableCell className="py-2 text-right text-[13px] font-black text-rose-700 border-l border-zinc-200">₹{(Number(bb.net_refund) || 0).toLocaleString()}</TableCell>
                        </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SyncedTableWrapper>

              <div className="xl:hidden flex flex-col divide-y divide-zinc-100 flex-1 overflow-y-auto">
                {buybacks.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400 text-sm">No buyback records found</div>
                ) : buybacks.map((bb) => (
                  <div key={bb.id} className="p-4 flex flex-col gap-3 bg-white">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-bold text-zinc-900">RTN-{bb.id.substring(0,6).toUpperCase()}</span>
                          <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[9px] uppercase tracking-widest">{bb.status}</Badge>
                        </div>
                        <div className="text-[11px] text-zinc-500 font-medium">{format(new Date(bb.created_at), 'dd MMM yy, hh:mm a')}</div>
                      </div>
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg text-rose-600 border-zinc-200 hover:bg-rose-50" onClick={() => handleOpenPreview(bb, 'return')}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex justify-between bg-zinc-50/50 p-2.5 rounded-lg border border-zinc-100">
                      <div>
                        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Customer</p>
                        <p className="text-xs font-semibold text-zinc-800">{bb.customers?.full_name || 'Walk-in'}</p>
                        {bb.customers?.phone && <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{bb.customers.phone}</p>}
                      </div>
                      <div className="text-right border-l border-zinc-200 pl-3">
                        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Handled By</p>
                        <p className="text-xs font-semibold text-zinc-800">{bb.profiles?.full_name || 'System'}</p>
                      </div>
                    </div>

                    <div className="mt-1">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Physical Details</p>
                      <p className="text-xs font-semibold text-zinc-800">{bb.item_category} ({bb.purity_karat}) <span className="text-[10px] text-zinc-500 font-mono ml-1">[{bb.gross_weight_g}g]</span></p>
                    </div>

                    <div className="flex justify-between items-end pt-2 border-t border-zinc-100">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Gross / Deduct</p>
                        <p className="text-[10px] font-medium text-zinc-600">₹{(Number(bb.gross_value) || 0).toLocaleString()} <span className="text-rose-500 ml-1">(-₹{(Number(bb.deduction_amount) || 0).toLocaleString()})</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Net Refund</p>
                        <p className="text-lg font-black text-rose-600 tracking-tight">₹{(Number(bb.net_refund) || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <PaginationControls />
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 5: REPAIR TICKETS */}
          {/* ========================================================================= */}
          <TabsContent value="repairs" className="m-0 pt-2 w-full min-w-0">
            <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl w-full min-w-0 flex flex-col">
              <SyncedTableWrapper>
                <Table className="w-full whitespace-nowrap border-b border-zinc-200">
                  <TableHeader className="bg-amber-50/50 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                    <TableRow className="hover:bg-transparent border-amber-100">
                      <TableHead className="h-11 text-[10px] font-bold text-amber-700 uppercase tracking-wider px-4 bg-amber-50/50 z-20 w-[60px] text-center sticky left-0 border-r border-amber-100">Actions</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-amber-700 uppercase tracking-wider px-4">Date</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-amber-700 uppercase tracking-wider">Ticket No</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-amber-700 uppercase tracking-wider border-r border-amber-100">Status</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-amber-700 uppercase tracking-wider">Customer</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-amber-700 uppercase tracking-wider border-l border-amber-100 pl-4">Handled By</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-amber-700 uppercase tracking-wider">Item Details</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-amber-700 uppercase tracking-wider text-right border-l border-amber-100">Est. Cost</TableHead>
                      <TableHead className="h-11 text-[10px] font-bold text-amber-700 uppercase tracking-wider text-right border-l border-amber-100">Advance Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repairs.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-12 text-zinc-400">No repair tickets found</TableCell></TableRow>
                    ) : repairs.map((rep) => (
                        <TableRow key={rep.id} className="border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                          <TableCell className="px-4 py-2 text-center align-middle sticky left-0 bg-white group-hover:bg-zinc-50 z-10 border-r border-zinc-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-amber-600 hover:text-amber-700 hover:bg-amber-100" onClick={() => handleOpenPreview(rep, 'repair')}><Eye className="h-4 w-4" /></Button>
                          </TableCell>
                          <TableCell className="px-4 py-2 text-[12px] font-medium text-zinc-600 whitespace-nowrap">{format(new Date(rep.created_at), 'dd MMM yy, HH:mm')}</TableCell>
                          <TableCell className="py-2 font-mono text-[12px] font-semibold text-zinc-900 border-r border-zinc-100">{rep.ticket_number}</TableCell>
                          <TableCell className="px-4 py-2"><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-200">{rep.status.replace(/_/g, ' ')}</span></TableCell>
                          <TableCell className="px-4 py-2 min-w-[160px]">
                            <span className="text-[12px] font-semibold text-zinc-800 whitespace-nowrap truncate block">{rep.customers?.full_name || 'Walk-in'}</span>
                            {rep.customers?.phone && <span className="text-[10px] text-zinc-500 font-mono">{rep.customers.phone}</span>}
                          </TableCell>
                          <TableCell className="px-4 py-2 border-l border-amber-100"><span className="text-[12px] font-medium text-zinc-700 whitespace-nowrap">{rep.profiles?.full_name || 'System'}</span></TableCell>
                          <TableCell className="py-2">
                             <span className="text-[12px] font-semibold text-zinc-800 block">{rep.item_description}</span>
                             <span className="text-[10px] text-zinc-500 font-mono">{rep.purity} • {rep.gross_weight_g}g</span>
                          </TableCell>
                          <TableCell className="py-2 text-right text-[12px] font-medium text-zinc-700 border-l border-zinc-200">₹{(Number(rep.estimated_cost) || 0).toLocaleString()}</TableCell>
                          <TableCell className="py-2 text-right text-[13px] font-black text-emerald-600 border-l border-zinc-200">₹{(Number(rep.advance_paid) || 0).toLocaleString()}</TableCell>
                        </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SyncedTableWrapper>

              <div className="xl:hidden flex flex-col divide-y divide-zinc-100 flex-1 overflow-y-auto">
                {repairs.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400 text-sm">No repair tickets found</div>
                ) : repairs.map((rep) => (
                  <div key={rep.id} className="p-4 flex flex-col gap-3 bg-white">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-bold text-zinc-900">{rep.ticket_number}</span>
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] uppercase tracking-widest">{rep.status.replace(/_/g, ' ')}</Badge>
                        </div>
                        <div className="text-[11px] text-zinc-500 font-medium">{format(new Date(rep.created_at), 'dd MMM yy, hh:mm a')}</div>
                      </div>
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg text-amber-600 border-zinc-200 hover:bg-amber-50" onClick={() => handleOpenPreview(rep, 'repair')}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex justify-between bg-zinc-50/50 p-2.5 rounded-lg border border-zinc-100">
                      <div>
                        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Customer</p>
                        <p className="text-xs font-semibold text-zinc-800">{rep.customers?.full_name || 'Walk-in'}</p>
                        {rep.customers?.phone && <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{rep.customers.phone}</p>}
                      </div>
                      <div className="text-right border-l border-zinc-200 pl-3">
                        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Handled By</p>
                        <p className="text-xs font-semibold text-zinc-800">{rep.profiles?.full_name || 'System'}</p>
                      </div>
                    </div>

                    <div className="mt-1">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Item Details</p>
                      <p className="text-xs font-semibold text-zinc-800">{rep.item_description} <span className="text-[10px] text-zinc-500 font-mono ml-1">[{rep.purity} • {rep.gross_weight_g}g]</span></p>
                    </div>

                    <div className="flex justify-between items-end pt-2 border-t border-zinc-100">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Est. Cost</p>
                        <p className="text-xs font-medium text-zinc-700">₹{(Number(rep.estimated_cost) || 0).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Advance Paid</p>
                        <p className="text-lg font-black text-emerald-600 tracking-tight">₹{(Number(rep.advance_paid) || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <PaginationControls />
            </Card>
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
          <DialogContent className="sm:max-w-[850px] md:mt-8 h-auto max-h-[85vh] border-zinc-200/60 shadow-2xl rounded-2xl p-0 overflow-hidden bg-white flex flex-col">
            <DialogHeader className="bg-zinc-50 border-b border-zinc-100 p-5 shrink-0 select-none">
              <DialogTitle className="flex items-center gap-2 text-indigo-600 text-lg font-bold">
                <Edit2 className="w-5 h-5" /> Edit Ledger Entry
              </DialogTitle>
              <DialogDescription className="text-xs font-medium text-zinc-500 mt-1.5">
                Modify financial details and metadata for <strong className="text-zinc-900">{invoiceToEdit?.invoice_number}</strong>. This updates the ledger in-place.
              </DialogDescription>
            </DialogHeader>
            
            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* ROW 1: Identifiers & Dates */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Invoice Number</Label>
                  <Input className="h-10 font-mono font-bold bg-white border-zinc-200" value={editForm.invoice_number} onChange={(e) => setEditForm({...editForm, invoice_number: e.target.value.toUpperCase()})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Date & Time</Label>
                  <Input type="datetime-local" className="h-10 bg-zinc-50/50 border-zinc-200" value={editForm.created_at} onChange={(e) => setEditForm({...editForm, created_at: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Payment Remarks</Label>
                  <Input className="h-10 bg-zinc-50/50 border-zinc-200" value={editForm.payment_remarks} onChange={(e) => setEditForm({...editForm, payment_remarks: e.target.value})} />
                </div>

                <div className="col-span-1 md:col-span-3 border-t border-zinc-100 my-1"></div>

                {/* ROW 2: Core Financials */}
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
                
                {/* ROW 3: Taxes & Final Total */}
                <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-5 items-end">
                  <div className="grid grid-cols-2 gap-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 h-fit">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">CGST Amount</Label>
                      <Input type="number" className="h-10 font-mono font-medium bg-white border-emerald-200" value={editForm.cgst_amount} onChange={(e) => setEditForm({...editForm, cgst_amount: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">SGST Amount</Label>
                      <Input type="number" className="h-10 font-mono font-medium bg-white border-emerald-200" value={editForm.sgst_amount} onChange={(e) => setEditForm({...editForm, sgst_amount: e.target.value})} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-indigo-600 mb-2 block">Net Final Total</Label>
                    <Input type="number" className="h-14 font-mono font-black text-2xl border-indigo-200 bg-indigo-50/30 shadow-inner" value={editForm.final_total} onChange={(e) => setEditForm({...editForm, final_total: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter className="p-4 bg-zinc-50 border-t border-zinc-100 sm:justify-between flex-row shrink-0">
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
              {/* ✨ Notice the arrow function () => triggerPrint() */}
              <Button 
  onClick={(e) => {
    e.preventDefault();
    triggerPrint();
  }} 
  className="h-9 sm:h-9 w-full sm:w-auto px-6 text-[11px] font-bold uppercase tracking-widest rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
>
  <Printer className="h-3.5 w-3.5 mr-2" /> Print Document
</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        </main>

       {/* ✨ OFF-SCREEN WRAPPER: Pure CSS, absolutely NO inline styles (-10000px) */}
<div id="print-wrapper" className="fixed top-0 left-0 -z-[9999] opacity-0 pointer-events-none">
  
  <div id="true-print-container" ref={printRef} className="w-[210mm] bg-white text-black">
    <InvoicePrintTemplate data={invoiceToPrint} />
  </div>

</div>
      
      <style dangerouslySetInnerHTML={{__html:`
  @media print {
    /* 1. Hide the entire normal app UI */
    body * {
      visibility: hidden !important;
    }
    
    /* 2. Un-hide the wrapper AND the true print container */
    #print-wrapper, #print-wrapper *, 
    #true-print-container, #true-print-container * {
      visibility: visible !important;
    }
    
    /* 3. Snap the wrapper perfectly to the top-left AND pull it to the front */
    #print-wrapper {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      opacity: 1 !important;
      z-index: 99999 !important; /* ✨ THE FIX: Pulls the invoice above the white background! */
      width: 210mm !important;
      margin: 0 !important;
      padding: 0 !important;
    }
  }

  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
`}} />
    </div>
  )
}