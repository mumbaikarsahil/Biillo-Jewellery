"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import { useStoreLocation } from "@/hooks/useStoreLocation"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"
import { format } from "date-fns"

import { 
  Undo2, Package, Search, CheckCircle2, Wrench, Clock, ShieldAlert,
  Loader2, RefreshCw, ChevronLeft, Flame, Store, Activity
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog"

// ✨ FIXED: Updated to match your exact database enums
const INVENTORY_STATUSES = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'in_vault', label: 'In Vault' },
  { value: 'transit', label: 'In Transit' },
  { value: 'received_at_ho', label: 'Received at HO' },
  { value: 'job_work_out', label: 'Job Work Out' },
  { value: 'pending_repair', label: 'Pending Repair' },
  { value: 'pending_melting', label: 'Pending Melting' },
  { value: 'melting', label: 'Melting' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'written_off_lost', label: 'Written Off / Lost' }
]

export default function ReturnsInboxPage() {
  const { appUser } = useAuth()
  const { isHQ, isLocked, selectedLocation, setSelectedLocation } = useStoreLocation()
  
  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([])
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal States
  const [actionItem, setActionItem] = useState<any>(null)
  const [actionType, setActionType] = useState<'restock' | 'repair' | 'melt' | 'status' | null>(null)
  const [actionNotes, setActionNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Action-specific states
  const [newBarcode, setNewBarcode] = useState('') 
  const [targetWarehouse, setTargetWarehouse] = useState('') 
  const [targetStatus, setTargetStatus] = useState('in_vault') 
  
  // Melt specific states
  const [activeGoldBatches, setActiveGoldBatches] = useState<any[]>([])
  const [activeDiamondLots, setActiveDiamondLots] = useState<any[]>([])
  const [selectedGoldBatch, setSelectedGoldBatch] = useState('new')
  const [selectedDiamondLot, setSelectedDiamondLot] = useState('new')

  useEffect(() => {
    const init = async () => {
      if (!appUser) return
      try {
        const { data: whData } = await supabase
          .from('warehouses')
          .select('id, name')
          .eq('company_id', appUser.company_id)
          .eq('is_active', true)
          .order('name')

        if (whData) setWarehouses(whData)
      } catch (err) {
        console.error(err)
      }
    }
    init()
  }, [appUser])

  const fetchReturns = async () => {
    if (!appUser?.company_id || !selectedLocation) return
    setLoading(true)
    try {
      let q = supabase
        .from('inventory_items')
        .select(`
          id, barcode, item_category, purity_karat, purity_percent, gross_weight_g, net_weight_g, 
          total_stone_weight_cts, total_stone_pieces, warehouse_id, status, audit_history, updated_at, is_exchanged,
          buybacks!source_buyback_id ( reference_invoice_number, notes )
        `)
        .eq('company_id', appUser.company_id)
        .eq('status', 'in_vault') 
        .not('source_buyback_id', 'is', null) 
        .order('updated_at', { ascending: false })

      if (selectedLocation !== 'ALL') q = q.eq('warehouse_id', selectedLocation)
      if (search) q = q.ilike('barcode', `%${search}%`)

      const { data, error } = await q
      if (error) throw error
      setItems(data || [])
    } catch (err: any) {
      toast.error("Failed to load returns inbox.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const delay = setTimeout(() => fetchReturns(), 300)
    return () => clearTimeout(delay)
  }, [appUser, selectedLocation, search])

  // Reset modal state when opening
  useEffect(() => {
    if (actionItem) {
      setTargetWarehouse(actionItem.warehouse_id)
      setTargetStatus(actionItem.status)
      setSelectedGoldBatch('new')
      setSelectedDiamondLot('new')
      
      if (actionType === 'melt') {
        fetchActiveBatches(actionItem.warehouse_id)
      }
    }
  }, [actionItem, actionType])

  const fetchActiveBatches = async (warehouseId: string) => {
    if (!appUser?.company_id) return;
    
    // Fetch active gold batches for this warehouse
    const { data: goldData } = await supabase
      .from('inventory_gold_batches')
      .select('id, batch_number, remaining_weight_g, purity_karat')
      .eq('company_id', appUser.company_id)
      .eq('warehouse_id', warehouseId)
      .eq('status', 'in_stock');
      
    if (goldData) setActiveGoldBatches(goldData);

    // Fetch active diamond lots for this warehouse
    const { data: diaData } = await supabase
      .from('inventory_diamond_lots')
      .select('id, lot_number, remaining_weight_cts, remaining_pieces')
      .eq('company_id', appUser.company_id)
      .eq('warehouse_id', warehouseId)
      .eq('status', 'in_stock');
      
    if (diaData) setActiveDiamondLots(diaData);
  }

  const getReturnReason = (item: any) => {
    if (item.buybacks?.notes) return item.buybacks.notes;
    if (item.buybacks?.reference_invoice_number) return `Returned from Invoice: ${item.buybacks.reference_invoice_number}`;
    if (item.audit_history && item.audit_history.length > 0) return item.audit_history[0]?.reason;
    return "No context provided.";
  }

  const executeAction = async () => {
    if (!actionItem || !actionType || !appUser) return
    
    if (actionType === 'restock' && !newBarcode.trim()) {
      return toast.error("A new barcode is compulsory for restocking.")
    }
    if ((actionType === 'repair' || actionType === 'melt' || actionType === 'status') && !actionNotes.trim()) {
      return toast.error("Please provide instructions or reasoning.")
    }

    setIsProcessing(true)
    try {
      let newStatus = 'in_stock';
      let logMessage = '';
      const uniqueSuffix = Date.now().toString().slice(-5);
      let updatedWarehouseId = actionItem.warehouse_id;

      if (actionType === 'restock') {
        newStatus = 'in_stock';
        logMessage = `QC Passed: Routed to Live Floor. Old Barcode was: ${actionItem.barcode}. Notes: ${actionNotes || 'None'}`;
        
        const { data: existing } = await supabase.from('inventory_items').select('id').eq('company_id', appUser.company_id).eq('barcode', newBarcode.trim()).maybeSingle();
        if (existing) throw new Error(`Barcode ${newBarcode.trim()} is already assigned to another item.`);

      } else if (actionType === 'repair') {
        newStatus = 'pending_repair'; // ✨ FIXED ENUM
        updatedWarehouseId = targetWarehouse;
        logMessage = `Routed to Repair at Warehouse: ${warehouses.find(w => w.id === targetWarehouse)?.name}. Defect: ${actionNotes}`;
        
        const { error: repError } = await supabase.from('repair_tickets').insert([{
            company_id: appUser.company_id,
            ticket_number: `REP-${actionItem.barcode}-${uniqueSuffix}`,
            origin_warehouse_id: actionItem.warehouse_id,
            current_warehouse_id: targetWarehouse,
            item_description: actionItem.item_category || 'Returned Item',
            gross_weight_g: actionItem.gross_weight_g || 0,
            purity: actionItem.purity_karat || '22K',
            defect_notes: actionNotes,
            status: 'received_at_store'
        }]);
        if (repError) throw new Error("Failed to create repair ticket: " + repError.message);

      } else if (actionType === 'status') {
        newStatus = targetStatus;
        logMessage = `Status manually updated. Reason: ${actionNotes}`;
        
      } else if (actionType === 'melt') {
        newStatus = 'melting'; // ✨ FIXED ENUM
        logMessage = `Routed to Melting/Refining. Reason: ${actionNotes}`;

        const goldWeight = Number(actionItem.net_weight_g || actionItem.gross_weight_g || 0);
        const diamondCts = Number(actionItem.total_stone_weight_cts || 0);
        const diamondPcs = Number(actionItem.total_stone_pieces || 1);

        if (goldWeight > 0) {
          if (selectedGoldBatch === 'new') {
            const { error: goldError } = await supabase.from('inventory_gold_batches').insert([{
                company_id: appUser.company_id,
                batch_number: `MLT-G-${actionItem.barcode}-${uniqueSuffix}`,
                purity_karat: actionItem.purity_karat || '22K',
                purity_percent: actionItem.purity_percent || 91.6,
                total_weight_g: goldWeight,
                remaining_weight_g: goldWeight,
                purchase_rate_per_g: 0,
                total_purchase_value: 0,
                warehouse_id: actionItem.warehouse_id,
                status: 'in_stock'
            }]);
            if (goldError) throw new Error("Failed to generate scrap gold batch: " + goldError.message);
          } else {
            const { data: existingBatch } = await supabase.from('inventory_gold_batches').select('remaining_weight_g, total_weight_g').eq('id', selectedGoldBatch).single();
            if (existingBatch) {
              await supabase.from('inventory_gold_batches').update({
                remaining_weight_g: Number(existingBatch.remaining_weight_g) + goldWeight,
                total_weight_g: Number(existingBatch.total_weight_g) + goldWeight
              }).eq('id', selectedGoldBatch);
            }
          }
        }

        if (diamondCts > 0) {
          if (selectedDiamondLot === 'new') {
            const { error: diaError } = await supabase.from('inventory_diamond_lots').insert([{
                company_id: appUser.company_id,
                lot_number: `MLT-D-${actionItem.barcode}-${uniqueSuffix}`,
                lot_type: 'packet',
                stone_type: 'DIAMOND',
                total_pieces: diamondPcs,
                remaining_pieces: diamondPcs,
                total_weight_cts: diamondCts,
                remaining_weight_cts: diamondCts,
                purchase_currency: 'INR',
                purchase_rate_per_ct: 0,
                total_purchase_value: 0,
                valuation_method: 'manual',
                warehouse_id: actionItem.warehouse_id,
                status: 'in_stock'
            }]);
            if (diaError) throw new Error("Failed to generate reclaimed diamond lot: " + diaError.message);
          } else {
             const { data: existingLot } = await supabase.from('inventory_diamond_lots').select('remaining_weight_cts, total_weight_cts, remaining_pieces, total_pieces').eq('id', selectedDiamondLot).single();
             if (existingLot) {
               await supabase.from('inventory_diamond_lots').update({
                 remaining_weight_cts: Number(existingLot.remaining_weight_cts) + diamondCts,
                 total_weight_cts: Number(existingLot.total_weight_cts) + diamondCts,
                 remaining_pieces: Number(existingLot.remaining_pieces) + diamondPcs,
                 total_pieces: Number(existingLot.total_pieces) + diamondPcs
               }).eq('id', selectedDiamondLot);
             }
          }
        }
      }

      const newLogEntry = {
        timestamp: new Date().toISOString(),
        user_name: appUser.full_name || 'System Auto',
        reason: logMessage,
        changes: `Status: ${actionItem.status} ➝ ${newStatus}`
      }

      const currentHistory = Array.isArray(actionItem.audit_history) ? actionItem.audit_history : []
      const updatedHistory = [newLogEntry, ...currentHistory]

      const { error: updateError } = await supabase.from('inventory_items').update({
        status: newStatus,
        warehouse_id: updatedWarehouseId, 
        barcode: actionType === 'restock' ? newBarcode.trim() : actionItem.barcode,
        audit_history: updatedHistory,
        updated_by: appUser.id || appUser.user_id
      }).eq('id', actionItem.id)

      if (updateError) throw updateError;

      // Make the toast notification match the correct status format
      toast.success(`Routing complete. Item moved to ${INVENTORY_STATUSES.find(s => s.value === newStatus)?.label || newStatus}`)
      setActionItem(null)
      setActionType(null)
      setActionNotes('')
      setNewBarcode('')
      fetchReturns() 
    } catch (err: any) {
      toast.error(err.message || "Failed to process item.")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa] p-4 md:p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/inventory">
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl bg-white">
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Undo2 className="w-5 h-5 text-rose-600" /> 
                Returns & Buybacks Triage
              </h1>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                Inspect returned items and route them to live floor, repairs, or melting.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm shrink-0">
            <Store className="w-4 h-4 text-slate-400 ml-2" />
            <Select value={selectedLocation || ''} onValueChange={setSelectedLocation} disabled={isLocked}>
              <SelectTrigger className="h-8 border-none bg-transparent shadow-none text-xs font-bold text-slate-700 w-[200px] focus:ring-0">
                <SelectValue placeholder="Select Warehouse..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 shadow-lg">
                {isHQ && <SelectItem value="ALL" className="text-xs font-bold text-indigo-600">All Vaults (Global View)</SelectItem>}
                {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs font-medium">{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Scan or search barcode..." 
              className="pl-9 h-10 bg-slate-50 border-slate-200"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={fetchReturns}>
            <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Inbox Table */}
        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden rounded-2xl">
          <Table>
            <TableHeader className="bg-rose-50/50">
              <TableRow>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-11">Item Details</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-11">Intake Context</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-11">Time in Inbox</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-11 text-right">Routing Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-400">Loading inbox...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-48 text-center text-slate-400">
                    <ShieldAlert className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    <span className="text-sm font-semibold tracking-tight">Inbox Clear</span>
                    <p className="text-xs mt-1">No pending returns or buybacks await inspection.</p>
                  </TableCell>
                </TableRow>
              ) : (
                items.map(item => (
                  <TableRow key={item.id} className="hover:bg-slate-50">
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Package className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="font-mono font-bold text-sm text-slate-900">{item.barcode}</span>
                        <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-widest bg-rose-50 text-rose-600 border-rose-200 px-1 py-0 h-4">
                          {item.is_exchanged ? 'BUYBACK' : 'RETURN'}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        {item.item_category} ({item.purity_karat}) • {item.net_weight_g}g
                      </div>
                    </TableCell>
                    
                    <TableCell className="py-3 max-w-[250px]">
                      <div className="bg-slate-100/50 border border-slate-200 p-2 rounded-lg text-xs text-slate-700 italic truncate" title={getReturnReason(item)}>
                        "{getReturnReason(item)}"
                      </div>
                    </TableCell>

                    <TableCell className="py-3">
                      <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        {format(new Date(item.updated_at), 'dd MMM, HH:mm')}
                      </div>
                    </TableCell>

                    <TableCell className="py-3 text-right">
                      <div className="flex justify-end gap-2 flex-wrap max-w-[300px] ml-auto">
                        <Button 
                          size="sm" 
                          className="h-8 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-200 text-xs font-bold"
                          onClick={() => { setActionItem(item); setActionType('restock'); }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Live Floor
                        </Button>
                        <Button 
                          size="sm" 
                          className="h-8 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 border border-amber-200 text-xs font-bold"
                          onClick={() => { setActionItem(item); setActionType('repair'); }}
                        >
                          <Wrench className="w-3.5 h-3.5 mr-1" /> Repair
                        </Button>
                        <Button 
                          size="sm" 
                          className="h-8 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 border border-red-200 text-xs font-bold"
                          onClick={() => { setActionItem(item); setActionType('melt'); }}
                        >
                          <Flame className="w-3.5 h-3.5 mr-1" /> Melt
                        </Button>
                        <Button 
                          size="sm" 
                          className="h-8 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-300 text-xs font-bold"
                          onClick={() => { setActionItem(item); setActionType('status'); }}
                        >
                          <Activity className="w-3.5 h-3.5 mr-1" /> Change Status
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* DECISION MODAL */}
        <Dialog open={!!actionItem} onOpenChange={(val) => !val && setActionItem(null)}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className={`flex items-center gap-2 ${actionType === 'restock' ? 'text-emerald-600' : actionType === 'repair' ? 'text-amber-600' : actionType === 'melt' ? 'text-red-600' : 'text-slate-800'}`}>
                {actionType === 'restock' && <CheckCircle2 className="w-5 h-5"/>}
                {actionType === 'repair' && <Wrench className="w-5 h-5"/>}
                {actionType === 'melt' && <Flame className="w-5 h-5"/>}
                {actionType === 'status' && <Activity className="w-5 h-5"/>}
                
                {actionType === 'restock' ? 'Push to Live Floor' : 
                 actionType === 'repair' ? 'Send to Repair' : 
                 actionType === 'melt' ? 'Send to Melting' : 
                 'Update Item Status'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Routing <strong className="text-slate-800">{actionItem?.barcode}</strong>. 
                {actionType === 'melt' && ' This will break the item down into raw Gold Batches & Diamond Lots.'}
                {actionType === 'repair' && ' This will generate a new internal Repair Ticket.'}
                {actionType === 'status' && ' Manually override the current status of this item.'}
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 space-y-4">
              
              {/* RESTOCK FIELDS */}
              {actionType === 'restock' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    New Assigned Barcode <span className="text-rose-500 text-[10px] uppercase">Required</span>
                  </Label>
                  <Input 
                    placeholder="Enter completely new barcode string"
                    className="font-mono text-sm uppercase bg-slate-50"
                    value={newBarcode}
                    onChange={(e) => setNewBarcode(e.target.value.toUpperCase())}
                  />
                  <p className="text-[10px] text-slate-500 font-medium">To prevent scanning conflicts, restocked items must receive a fresh barcode label.</p>
                </div>
              )}

              {/* REPAIR FIELDS */}
              {actionType === 'repair' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Destination Workshop / Warehouse</Label>
                  <Select value={targetWarehouse} onValueChange={setTargetWarehouse}>
                    <SelectTrigger className="h-10 text-xs bg-slate-50 border-slate-300">
                      <SelectValue placeholder="Select location..." />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map(w => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-slate-500 font-medium">Where will this item physically go for repairs?</p>
                </div>
              )}

              {/* STATUS OVERRIDE FIELDS */}
              {actionType === 'status' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">New Status</Label>
                  <Select value={targetStatus} onValueChange={setTargetStatus}>
                    <SelectTrigger className="h-10 text-xs bg-slate-50 border-slate-300">
                      <SelectValue placeholder="Select status..." />
                    </SelectTrigger>
                    <SelectContent>
                      {INVENTORY_STATUSES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* MELT FIELDS */}
              {actionType === 'melt' && (
                <div className="grid grid-cols-1 gap-4 p-3 bg-red-50/50 border border-red-100 rounded-lg">
                  {Number(actionItem?.gross_weight_g) > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">Target Gold Batch</Label>
                      <Select value={selectedGoldBatch} onValueChange={setSelectedGoldBatch}>
                        <SelectTrigger className="h-10 text-xs bg-white border-slate-300">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new" className="text-emerald-600 font-bold">Create New Scrap Batch</SelectItem>
                          {activeGoldBatches.length > 0 && <SelectItem value="disabled" disabled className="bg-slate-50 font-bold text-[10px] uppercase tracking-wider text-slate-400">--- Existing Batches ---</SelectItem>}
                          {activeGoldBatches.map(b => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.batch_number} ({b.remaining_weight_g}g - {b.purity_karat})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {Number(actionItem?.total_stone_weight_cts) > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">Target Diamond Lot</Label>
                      <Select value={selectedDiamondLot} onValueChange={setSelectedDiamondLot}>
                        <SelectTrigger className="h-10 text-xs bg-white border-slate-300">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new" className="text-emerald-600 font-bold">Create New Diamond Lot</SelectItem>
                          {activeDiamondLots.length > 0 && <SelectItem value="disabled" disabled className="bg-slate-50 font-bold text-[10px] uppercase tracking-wider text-slate-400">--- Existing Lots ---</SelectItem>}
                          {activeDiamondLots.map(l => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.lot_number} ({l.remaining_weight_cts}ct)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* UNIVERSAL NOTES FIELD */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  {actionType === 'restock' ? 'QC Notes' : 'Routing Instructions / Reason'}
                  {actionType !== 'restock' && <span className="text-rose-500 text-[10px] uppercase">Required</span>}
                </Label>
                <Textarea 
                  className="resize-none text-xs bg-slate-50" 
                  rows={3}
                  placeholder={actionType === 'restock' ? "e.g. Cleaned and polished." : actionType === 'repair' ? "e.g. Broken clasp, needs soldering." : actionType === 'status' ? "e.g. Moving to transit to send to HO." : "e.g. Scrap gold to be refined."}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                />
              </div>

            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setActionItem(null)} className="h-9 text-xs font-bold">Cancel</Button>
              <Button 
                onClick={executeAction} 
                disabled={isProcessing || (actionType === 'restock' && !newBarcode.trim()) || ((actionType === 'repair' || actionType === 'melt' || actionType === 'status') && !actionNotes.trim())}
                className={`h-9 text-xs font-bold text-white ${actionType === 'restock' ? 'bg-emerald-600 hover:bg-emerald-700' : actionType === 'repair' ? 'bg-amber-600 hover:bg-amber-700' : actionType === 'melt' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-800 hover:bg-slate-900'}`}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirm Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  )
}