'use client'

import React, { useEffect, useState, useRef } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { 
  FileText, Printer, Store, RefreshCw, Download, 
  Filter, Calendar, Search, ChevronRight,
  Eye, MoreHorizontal, Edit2, XCircle, ShieldAlert, Loader2,
  CheckCircle2, ArrowLeft, Building2, Layers
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useStoreLocation } from '@/hooks/useStoreLocation'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
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

export default function PurchasesLedgerPage() {
  const { appUser } = useAuth()
  const { isHQ, isLocked, selectedLocation, setSelectedLocation } = useStoreLocation()
  
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const [page, setPage] = useState(1)
  const [recordLimit, setRecordLimit] = useState(100)
  
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; 
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [search, setSearch] = useState('')

  const [purchases, setPurchases] = useState<any[]>([])

  const [invoiceToCancel, setInvoiceToCancel] = useState<any>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  const [invoiceToEdit, setInvoiceToEdit] = useState<any>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [isEditing, setIsEditing] = useState(false)
  
  useEffect(() => {
    const fetchWarehouses = async () => {
      if (!appUser?.company_id) return
      const { data } = await supabase.from('warehouses').select('*').eq('company_id', appUser.company_id).eq('is_active', true)
      
      if (data) {
        setWarehouses(data)
        if (!selectedLocation && !isHQ) setSelectedLocation(data[0].id)
      }
    }
    fetchWarehouses()
  }, [appUser, isHQ, selectedLocation, setSelectedLocation])

  const fetchPurchasesData = async () => {
    if (!appUser?.company_id || !selectedLocation) return
    setLoading(true)
    try {
      const safeEndDate = new Date(endDate)
      safeEndDate.setDate(safeEndDate.getDate() + 1)
      const safeEndDateStr = safeEndDate.toISOString().split('T')[0]

      const from = (page - 1) * recordLimit
      const to = from + recordLimit - 1

      let q = supabase.from('purchase_invoices')
        .select(`
          *, 
          suppliers(supplier_name, gstin), 
          warehouses(name), 
          purchase_invoice_items(id, item_type, reference_id, description, quantity, weight, rate, line_total, tax_amount)
        `)
        .eq('company_id', appUser.company_id)
        .gte('created_at', startDate)
        .lt('created_at', safeEndDateStr)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (selectedLocation !== 'ALL') q = q.eq('warehouse_id', selectedLocation)
      if (search.trim()) q = q.ilike('invoice_number', `%${search.trim()}%`)

      const { data, error } = await q
      if (error) throw error

      setPurchases(data || [])
    } catch (err: any) {
      toast.error("Failed to load purchases data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
  }, [selectedLocation, startDate, endDate, search, recordLimit])

  useEffect(() => {
    const delay = setTimeout(() => { fetchPurchasesData() }, 300)
    return () => clearTimeout(delay)
  }, [appUser, selectedLocation, startDate, endDate, search, page, recordLimit])

  const executeCancelPurchase = async () => {
    if (!invoiceToCancel || !appUser) return;
    if (!cancelReason.trim()) return toast.error("A cancellation reason is strictly required for the audit trail.");
    
    setIsCancelling(true);
    try {
      // 1. Mark Purchase Invoice as Cancelled
      const { error: invError } = await supabase.from('purchase_invoices').update({
        status: 'cancelled', // Matches your schema constraint
        cancellation_reason: cancelReason.trim(),
        cancelled_at: new Date().toISOString(),
        cancelled_by: appUser.id
      }).eq('id', invoiceToCancel.id);
      
      if (invError) throw invError;

      // 2. Remove Items from Active Raw Material Inventory
      const goldIds = invoiceToCancel.purchase_invoice_items?.filter((i: any) => i.item_type === 'gold_batch').map((i: any) => i.reference_id).filter(Boolean);
      const diamondIds = invoiceToCancel.purchase_invoice_items?.filter((i: any) => i.item_type === 'diamond_lot').map((i: any) => i.reference_id).filter(Boolean);

      if (goldIds && goldIds.length > 0) {
        await supabase.from('inventory_gold_batches').delete().in('id', goldIds);
      }
      if (diamondIds && diamondIds.length > 0) {
        await supabase.from('inventory_diamond_lots').delete().in('id', diamondIds);
      }

      toast.success(`Purchase record voided and raw materials deleted from vault.`);
      setInvoiceToCancel(null);
      setCancelReason('');
      fetchPurchasesData();
    } catch (err: any) {
      toast.error(err.message || "Failed to void the purchase record.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleOpenEdit = (inv: any) => {
    setInvoiceToEdit(inv);
    setEditForm({
      invoice_number: inv.invoice_number || '',
      subtotal: inv.subtotal || 0,
      total_tax: inv.total_tax || 0,
      round_off: inv.round_off || 0,
      grand_total: inv.grand_total || 0,
      notes: inv.notes || ''
    });
  };

  const executeEditPurchase = async () => {
    if (!invoiceToEdit || !appUser) return;
    
    const newInvoiceNo = editForm.invoice_number?.trim().toUpperCase();
    if (!newInvoiceNo) return toast.error("Document number cannot be empty.");

    setIsEditing(true);
    try {
      if (newInvoiceNo !== invoiceToEdit.invoice_number) {
        const { data: existing, error: checkErr } = await supabase
          .from('purchase_invoices')
          .select('id')
          .eq('company_id', appUser.company_id)
          .eq('supplier_id', invoiceToEdit.supplier_id)
          .eq('invoice_number', newInvoiceNo)
          .maybeSingle();

        if (existing) {
          toast.error(`Invoice number ${newInvoiceNo} already exists for this supplier!`);
          setIsEditing(false);
          return;
        }
        if (checkErr) throw checkErr;
      }

      const payload = {
        invoice_number: newInvoiceNo,
        subtotal: Number(editForm.subtotal),
        total_tax: Number(editForm.total_tax),
        round_off: Number(editForm.round_off),
        grand_total: Number(editForm.grand_total),
        notes: editForm.notes
      };

      const { error } = await supabase.from('purchase_invoices').update(payload).eq('id', invoiceToEdit.id);
      if (error) throw error;

      toast.success("Purchase financials updated successfully.");
      setInvoiceToEdit(null);
      fetchPurchasesData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update the document.");
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 font-sans pb-20 w-full">
      <header className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 h-14 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/purchases">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-gray-100 text-gray-500"><ArrowLeft className="h-4 w-4" strokeWidth={1.5} /></Button>
          </Link>
          <Separator orientation="vertical" className="h-5 bg-gray-200" />
          <nav className="flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap">
            <span className="text-gray-500">Procurement</span>
            <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
            <span className="font-semibold text-gray-900 tracking-tight">Purchase Ledger</span>
          </nav>
        </div>
      </header>

      <main className="p-4 sm:p-6 md:p-8 max-w-[1600px] w-full mx-auto space-y-5 animate-in fade-in duration-500">
        
        <div className="flex flex-col gap-3 bg-white p-3 sm:p-3 rounded-2xl border border-gray-200 shadow-sm w-full">
          <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search Invoice No..." className="pl-9 h-10 sm:h-9 text-sm rounded-xl bg-gray-50 border-gray-200 focus-visible:ring-blue-500/20 font-medium" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            
            <Button variant={showFilters ? "default" : "outline"} size="icon" className={`h-10 w-10 sm:h-9 sm:w-9 rounded-xl shrink-0 transition-colors ${showFilters ? 'bg-blue-600 text-white' : 'border-gray-200 text-gray-600'}`} onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-gray-200 shrink-0 text-gray-600 hover:bg-gray-100" onClick={fetchPurchasesData}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className={`flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full ${showFilters ? 'flex' : 'hidden sm:flex'} animate-in slide-in-from-top-2 duration-200`}>
            <Select value={selectedLocation || ''} onValueChange={setSelectedLocation} disabled={isLocked}>
              <SelectTrigger className="h-10 sm:h-9 text-xs sm:text-[11px] font-bold bg-gray-50 border-gray-200 rounded-xl w-full sm:w-[180px]">
                <Store className="w-4 h-4 sm:w-3 sm:h-3 mr-1.5 text-gray-500" />
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-lg border-gray-100">
                {isHQ && <SelectItem value="ALL" className="text-xs font-bold text-blue-600">All Branches (HQ)</SelectItem>}
                {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs font-medium">{w.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 sm:py-0 sm:h-9 focus-within:border-blue-300 min-w-0 gap-2 sm:gap-0">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-gray-400 shrink-0 mr-1.5" />
                <span className="text-[10px] font-bold text-gray-400 uppercase sm:hidden w-12">From</span>
                <input type="date" className="bg-transparent text-sm sm:text-[11px] font-mono font-medium outline-none flex-1 text-gray-700 w-full" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <span className="text-gray-300 text-[10px] uppercase font-bold mx-2 shrink-0 hidden sm:block">-</span>
              <div className="flex items-center border-t border-gray-200 pt-2 sm:pt-0 sm:border-t-0">
                 <span className="text-[10px] font-bold text-gray-400 uppercase sm:hidden w-12 pl-5 sm:pl-0">To</span>
                 <input type="date" className="bg-transparent text-sm sm:text-[11px] font-mono font-medium outline-none flex-1 text-right sm:text-left text-gray-700 w-full" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <Card className="shadow-sm border-gray-200 bg-white rounded-2xl w-full flex flex-col overflow-hidden">
          <div className="overflow-x-auto min-h-[400px] custom-scrollbar">
            <Table className="w-full whitespace-nowrap">
              <TableHeader className="bg-gray-50/80 sticky top-0 z-10 shadow-sm border-b border-gray-200">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="h-11 text-[10px] font-bold text-gray-500 uppercase tracking-wider px-4 bg-gray-50 z-20 w-[60px] text-center sticky left-0 border-r border-gray-200">Actions</TableHead>
                  <TableHead className="h-11 text-[10px] font-bold text-gray-500 uppercase tracking-wider px-4">Date</TableHead>
                  <TableHead className="h-11 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Invoice No</TableHead>
                  <TableHead className="h-11 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200">Status</TableHead>
                  <TableHead className="h-11 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Supplier</TableHead>
                  <TableHead className="h-11 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-l border-gray-200">Items / Barcodes</TableHead>
                  <TableHead className="h-11 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right border-l border-gray-200">Subtotal</TableHead>
                  <TableHead className="h-11 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right border-l border-gray-200">Total Tax</TableHead>
                  <TableHead className="h-11 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right border-l border-gray-200 bg-blue-50/30 text-blue-700">Grand Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-300" /></TableCell></TableRow>
                ) : purchases.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-12 text-gray-400 text-sm">No purchase records found.</TableCell></TableRow>
                ) : purchases.map((inv) => {
                  const isCancelled = inv.status === 'CANCELLED'
                  return (
                    <TableRow key={inv.id} className={`border-gray-100 hover:bg-gray-50/50 transition-colors group ${isCancelled ? 'opacity-60 bg-red-50/30' : ''}`}>
                      <TableCell className="px-4 py-2 text-center align-middle sticky left-0 bg-white group-hover:bg-gray-50 z-10 border-r border-gray-200">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-200"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-48 rounded-xl shadow-lg border-gray-200 p-1">
                            {!isCancelled ? (
                              <>
                                <DropdownMenuItem onClick={() => handleOpenEdit(inv)} className="cursor-pointer py-2 rounded-lg"><Edit2 className="w-4 h-4 mr-2 text-amber-500" /> Edit Financials</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setInvoiceToCancel(inv)} className="cursor-pointer py-2 rounded-lg text-red-600 focus:bg-red-50 focus:text-red-700"><XCircle className="w-4 h-4 mr-2" /> Cancel & Void</DropdownMenuItem>
                              </>
                            ) : (
                              <div className="p-2 text-xs text-red-500 font-medium">Record is Voided</div>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="px-4 py-2 text-[12px] font-medium text-gray-600 whitespace-nowrap">{format(new Date(inv.created_at), 'dd MMM yy')}</TableCell>
                      <TableCell className="py-2 font-mono text-[12px] font-bold text-gray-900">{inv.invoice_number}</TableCell>
                      <TableCell className="px-4 py-2 border-r border-gray-100"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${isCancelled ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>{inv.status}</span></TableCell>
                      <TableCell className="px-4 py-2 min-w-[160px]">
                        <span className="text-[12px] font-semibold text-gray-800 whitespace-nowrap truncate block">{inv.suppliers?.supplier_name || 'Unknown'}</span>
                        <span className="text-[10px] text-gray-500 font-mono">{inv.suppliers?.gstin}</span>
                      </TableCell>
                      <TableCell className="py-2 min-w-[250px] border-l border-gray-100 px-4 align-top">
                         <div className="flex flex-col gap-1.5 max-h-[80px] overflow-y-auto custom-scrollbar pr-2">
                           {inv.purchase_invoice_items?.map((i: any, idx: number) => (
                             <div key={idx} className="text-[10px] font-medium text-gray-600 bg-gray-100/60 px-2 py-1 rounded w-full">
                               <span className="font-mono font-bold text-gray-400 mr-1">
                                 [{i.item_type === 'gold_batch' ? 'GOLD' : 'STONE'}]
                               </span>
                               {i.description || 'Raw Material'} <span className="font-bold">({i.weight} {i.item_type === 'gold_batch' ? 'g' : 'cts'})</span>
                             </div>
                           ))}
                         </div>
                      </TableCell>
                      <TableCell className="py-2 text-right text-[12px] font-medium text-gray-700 border-l border-gray-200">₹{(Number(inv.subtotal) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                      <TableCell className="py-2 text-right text-[12px] font-medium text-gray-600 border-l border-gray-200">₹{(Number(inv.total_tax) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                      <TableCell className="py-2 text-right text-[13px] font-black text-blue-700 bg-blue-50/30 border-l border-gray-200 pr-4">₹{(Number(inv.grand_total) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* --- CANCELLATION MODAL --- */}
        <Dialog open={!!invoiceToCancel} onOpenChange={(open) => !open && setInvoiceToCancel(null)}>
          <DialogContent className="sm:max-w-[425px] border-none shadow-2xl rounded-2xl">
            <DialogHeader className="p-5 border-b border-gray-100 bg-red-50/30">
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <ShieldAlert className="w-5 h-5" /> Void Purchase Record
              </DialogTitle>
              <DialogDescription className="text-xs mt-1.5 text-gray-500">
                You are about to permanently void Purchase Invoice <strong className="text-gray-900">{invoiceToCancel?.invoice_number}</strong>. This will automatically mark all associated items in the inventory as <strong className="text-red-600">Cancelled</strong>, removing them from live stock.
              </DialogDescription>
            </DialogHeader>
            <div className="p-5">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Cancellation Reason (Required)</Label>
                <Input 
                  placeholder="e.g. Items returned to vendor, incorrect billing..." 
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
            </div>
            <DialogFooter className="p-4 border-t border-gray-100 bg-gray-50">
              <Button variant="outline" className="h-9 rounded-xl" onClick={() => setInvoiceToCancel(null)}>Keep Document</Button>
              <Button variant="destructive" className="h-9 rounded-xl" onClick={executeCancelPurchase} disabled={isCancelling || !cancelReason.trim()}>
                {isCancelling ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : 'Confirm Void'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* --- EDIT FINANCIALS MODAL --- */}
        <Dialog open={!!invoiceToEdit} onOpenChange={(open) => !open && setInvoiceToEdit(null)}>
          <DialogContent className="sm:max-w-[500px] border-none shadow-2xl rounded-2xl p-0 overflow-hidden bg-white flex flex-col">
            <DialogHeader className="bg-gray-50 border-b border-gray-100 p-5 shrink-0 select-none">
              <DialogTitle className="flex items-center gap-2 text-blue-600 text-lg font-bold">
                <Edit2 className="w-5 h-5" /> Edit Ledger Entry
              </DialogTitle>
              <DialogDescription className="text-xs font-medium text-gray-500 mt-1.5">
                Modify financial details and metadata for <strong className="text-gray-900">{invoiceToEdit?.invoice_number}</strong>. This updates the ledger in-place without affecting the physical inventory quantities.
              </DialogDescription>
            </DialogHeader>
            
            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 gap-5">
                
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Document Number</Label>
                  <Input className="h-10 font-mono font-bold bg-white border-gray-200 rounded-xl" value={editForm.invoice_number} onChange={(e) => setEditForm({...editForm, invoice_number: e.target.value.toUpperCase()})} />
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Notes / Remarks</Label>
                  <Input className="h-10 bg-gray-50 border-gray-200 rounded-xl" value={editForm.notes} onChange={(e) => setEditForm({...editForm, notes: e.target.value})} />
                </div>

                <div className="border-t border-gray-100 my-1"></div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1.5">
                     <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Subtotal</Label>
                     <Input type="number" step="0.01" className="h-10 font-mono font-medium rounded-xl" value={editForm.subtotal} onChange={(e) => setEditForm({...editForm, subtotal: e.target.value})} />
                   </div>
                   <div className="space-y-1.5">
                     <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Tax</Label>
                     <Input type="number" step="0.01" className="h-10 font-mono font-medium rounded-xl" value={editForm.total_tax} onChange={(e) => setEditForm({...editForm, total_tax: e.target.value})} />
                   </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 items-end">
                   <div className="space-y-1.5">
                     <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Round Off</Label>
                     <Input type="number" step="0.01" className="h-10 font-mono font-medium rounded-xl" value={editForm.round_off} onChange={(e) => setEditForm({...editForm, round_off: e.target.value})} />
                   </div>
                   <div className="space-y-1.5">
                     <Label className="text-[11px] font-black uppercase tracking-widest text-blue-600 mb-2 block">Grand Total</Label>
                     <Input type="number" step="0.01" className="h-12 font-mono font-black text-xl border-blue-200 bg-blue-50/30 rounded-xl shadow-inner" value={editForm.grand_total} onChange={(e) => setEditForm({...editForm, grand_total: e.target.value})} />
                   </div>
                </div>

              </div>
            </div>
            
            <DialogFooter className="p-4 bg-gray-50 border-t border-gray-100 sm:justify-between flex-row shrink-0">
              <Button variant="ghost" className="h-10 font-bold text-gray-500 hover:text-gray-800 rounded-xl" onClick={() => setInvoiceToEdit(null)}>Discard</Button>
              <Button className="h-10 px-8 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm" onClick={executeEditPurchase} disabled={isEditing}>
                {isEditing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                {isEditing ? 'Saving...' : 'Save Adjustments'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  )
}