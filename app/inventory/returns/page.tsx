"use client"

import React, { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useStoreLocation } from "@/hooks/useStoreLocation"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"
import { format } from "date-fns"

import { 
  Undo2, Package, Search, CheckCircle2, Wrench, Clock, ShieldAlert,
  Loader2, RefreshCw, ChevronLeft, Flame, Store
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
import Link from "next/link"

export default function ReturnsInboxPage() {
  const { appUser } = useAuth()
  const { isHQ, selectedLocation, setSelectedLocation } = useStoreLocation()
  
  const [items, setItems] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // RBAC State
  const [userRole, setUserRole] = useState<string>('sales_person')
  const canFullManage = ['owner', 'manager', 'operations_manager'].includes(userRole)

  // Modal States
  const [actionItem, setActionItem] = useState<any>(null)
  const [actionType, setActionType] = useState<'restock' | 'repair' | 'melt' | null>(null)
  const [actionNotes, setActionNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Melt Form State
  const [meltForm, setMeltForm] = useState({ goldWt: '', diaWt: '' })

  useEffect(() => {
    const initData = async () => {
      if (!appUser) return;
      
      // 1. Get User Role
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', appUser.user_id || appUser.id).maybeSingle();
      if (profile) setUserRole(profile.role);

      // 2. Get Warehouses for HQ selector
      const { data: whData } = await supabase.from('warehouses').select('id, name').eq('company_id', appUser.company_id).eq('is_active', true).order('name');
      if (whData) setWarehouses(whData);
    }
    initData();
  }, [appUser])

  const fetchReturns = async () => {
    if (!appUser?.company_id || !selectedLocation) return
    setLoading(true)
    try {
      let q = supabase
        .from('inventory_items')
        .select(`
          id, barcode, item_category, purity_karat, purity_percent, net_weight_g, total_stone_weight_cts, status, audit_history, updated_at, is_exchanged, warehouse_id,
          warehouses ( name ),
          buybacks!source_buyback_id ( reference_invoice_number, notes )
        `)
        .eq('company_id', appUser.company_id)
        .eq('status', 'in_vault') 
        // Ensure we fetch both official buybacks AND manually tagged exchange items
        .or('source_buyback_id.not.is.null,is_exchanged.eq.true')
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

  const getReturnReason = (item: any) => {
    if (item.buybacks?.notes) return item.buybacks.notes;
    if (item.buybacks?.reference_invoice_number) return `Returned from Invoice: ${item.buybacks.reference_invoice_number}`;
    if (item.audit_history && item.audit_history.length > 0) return item.audit_history[0]?.reason;
    return "Manual Exchange Intake";
  }

  const executeAction = async () => {
    if (!actionItem || !actionType || !appUser) return
    if ((actionType === 'repair' || actionType === 'melt') && !actionNotes.trim()) {
      return toast.error("Please provide instructions or reasoning.")
    }

    if (actionType === 'melt' && !meltForm.goldWt) {
       return toast.error("Please enter the recovered gold weight.");
    }

    setIsProcessing(true)
    try {
      let newStatus = 'in_stock';
      let logMessage = '';

      if (actionType === 'restock') {
        newStatus = 'in_stock';
        logMessage = `QC Passed: Routed to Live Floor. Notes: ${actionNotes || 'None'}`;
      } else if (actionType === 'repair') {
        newStatus = 'repairs';
        logMessage = `Routed to Repair. Defect: ${actionNotes}`;
      } else if (actionType === 'melt') {
        newStatus = 'melted'; 
        logMessage = `Melted/Refined. Recovered ${meltForm.goldWt}g Gold & ${meltForm.diaWt || 0}ct Diamonds. Reason: ${actionNotes}`;

        // 1. INJECT RECOVERED GOLD TO BATCHES
        if (Number(meltForm.goldWt) > 0) {
           await supabase.from('inventory_gold_batches').insert({
              company_id: appUser.company_id,
              warehouse_id: actionItem.warehouse_id,
              batch_number: `REC-${actionItem.barcode}`,
              purity_karat: actionItem.purity_karat || '22K',
              purity_percent: actionItem.purity_percent || 91.6,
              issued_weight_g: Number(meltForm.goldWt),
              current_weight_g: Number(meltForm.goldWt),
              supplier_name: 'INTERNAL MELT'
           });
        }

        // 2. INJECT RECOVERED DIAMONDS TO LOTS
        if (Number(meltForm.diaWt) > 0) {
           await supabase.from('inventory_diamond_lots').insert({
              company_id: appUser.company_id,
              warehouse_id: actionItem.warehouse_id,
              lot_number: `RCV-${actionItem.barcode}`,
              total_weight_cts: Number(meltForm.diaWt),
              available_weight_cts: Number(meltForm.diaWt),
              shape: 'Mixed',
              supplier_name: 'INTERNAL MELT'
           });
        }
      }

      const newLogEntry = {
        timestamp: new Date().toISOString(),
        user_name: appUser.full_name || 'Manager',
        reason: logMessage,
        changes: `Status: ${actionItem.status} ➝ ${newStatus}`
      }

      const currentHistory = Array.isArray(actionItem.audit_history) ? actionItem.audit_history : []
      const updatedHistory = [newLogEntry, ...currentHistory]

      // Update item status out of the vault
      const { error } = await supabase.from('inventory_items').update({
        status: newStatus,
        audit_history: updatedHistory,
        updated_by: appUser.id || appUser.user_id
      }).eq('id', actionItem.id)

      if (error) throw error;

      toast.success(`Item successfully moved to ${newStatus.replace('_', ' ')}`)
      setActionItem(null)
      setActionType(null)
      setActionNotes('')
      setMeltForm({ goldWt: '', diaWt: '' })
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
        
        {/* Header & Global Selector */}
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
                Returns & Buybacks Inbox
              </h1>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                Inspect returned items and route them to live floor, repairs, or melting.
              </p>
            </div>
          </div>

          {/* ✨ HQ Location Selector for Admins */}
          {canFullManage && isHQ && (
             <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm shrink-0">
               <Store className="w-4 h-4 text-slate-400 ml-2" />
               <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                 <SelectTrigger className="h-8 text-xs font-bold bg-slate-50 border-none focus:ring-0 w-[200px] shadow-none">
                   <SelectValue placeholder="Select Location..." />
                 </SelectTrigger>
                 <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                   <SelectItem value="ALL" className="text-xs font-bold text-indigo-600">All Branches (Global)</SelectItem>
                   {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs font-medium">{w.name}</SelectItem>)}
                 </SelectContent>
               </Select>
             </div>
          )}
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
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={fetchReturns}>
            <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Inbox Table */}
        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden rounded-2xl">
          <Table>
            <TableHeader className="bg-rose-50/50">
              <TableRow>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-11 px-4">Item Details</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-11">Intake Context</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-11">Time in Inbox</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-11 text-right px-4">Routing Decision</TableHead>
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
                items.map(item => {
                  const isMainOffice = item.warehouses?.name?.toLowerCase().includes('main office') || item.warehouses?.name?.toLowerCase().includes('hq');

                  return (
                    <TableRow key={item.id} className="hover:bg-slate-50">
                      <TableCell className="py-3 px-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="w-3.5 h-3.5 text-indigo-500" />
                          <span className="font-mono font-bold text-sm text-slate-900">{item.barcode}</span>
                          <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-widest bg-rose-50 text-rose-600 border-rose-200 px-1.5 py-0 h-4 rounded-sm">
                            {item.is_exchanged ? 'BUYBACK' : 'RETURN'}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-600 font-medium">
                          {item.item_category} ({item.purity_karat}) • {item.net_weight_g}g
                        </div>
                        <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest mt-1 flex items-center gap-1">
                           <Store className="w-3 h-3" /> {item.warehouses?.name || 'Unknown Vault'}
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

                      <TableCell className="py-3 text-right px-4">
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="sm" 
                            className="h-8 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-200 text-xs font-bold"
                            onClick={() => { setActionItem(item); setActionType('restock'); }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Live Floor</span>
                          </Button>
                          
                          {/* Only Admins get these options */}
                          {canFullManage && (
                            <Button 
                              size="sm" 
                              className="h-8 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 border border-amber-200 text-xs font-bold"
                              onClick={() => { setActionItem(item); setActionType('repair'); }}
                            >
                              <Wrench className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Repair</span>
                            </Button>
                          )}

                          {/* Only Admins at Main Office can Melt */}
                          {canFullManage && isMainOffice && (
                            <Button 
                              size="sm" 
                              className="h-8 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 border border-red-200 text-xs font-bold"
                              onClick={() => { 
                                setActionItem(item); 
                                setActionType('melt'); 
                                setMeltForm({ goldWt: item.net_weight_g?.toString() || '', diaWt: item.total_stone_weight_cts?.toString() || '' });
                              }}
                            >
                              <Flame className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Melt</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>

        {/* DECISION MODAL */}
        <Dialog open={!!actionItem} onOpenChange={(val) => {
          if (!val) { setActionItem(null); setMeltForm({ goldWt: '', diaWt: '' }); }
        }}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className={`flex items-center gap-2 ${actionType === 'restock' ? 'text-emerald-600' : actionType === 'repair' ? 'text-amber-600' : 'text-red-600'}`}>
                {actionType === 'restock' && <CheckCircle2 className="w-5 h-5"/>}
                {actionType === 'repair' && <Wrench className="w-5 h-5"/>}
                {actionType === 'melt' && <Flame className="w-5 h-5"/>}
                {actionType === 'restock' ? 'Push to Live Floor' : actionType === 'repair' ? 'Send to Repair' : 'Send to Melting'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Routing <strong className="text-slate-800">{actionItem?.barcode}</strong>. 
                {actionType === 'melt' && " This will move materials directly to your active Gold & Diamond lots."}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {actionType === 'melt' && (
                 <div className="grid grid-cols-2 gap-4 bg-red-50/50 p-4 border border-red-100 rounded-xl mb-2">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-red-700 uppercase">Recovered Gold (g) *</Label>
                      <Input type="number" step="0.001" className="h-9 font-mono font-bold text-red-900 border-red-200" value={meltForm.goldWt} onChange={e => setMeltForm({...meltForm, goldWt: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-blue-700 uppercase">Recovered Dia (ct)</Label>
                      <Input type="number" step="0.01" className="h-9 font-mono font-bold text-blue-900 border-blue-200" value={meltForm.diaWt} onChange={e => setMeltForm({...meltForm, diaWt: e.target.value})} />
                    </div>
                 </div>
              )}

              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-2 block">
                  {actionType === 'restock' ? 'QC Notes (Optional)' : 'Reason / Instructions (Required)'}
                </Label>
                <Textarea 
                  className="resize-none text-xs" 
                  placeholder={actionType === 'restock' ? "e.g. Cleaned and polished." : actionType === 'repair' ? "e.g. Broken clasp, needs soldering." : "e.g. Scrap gold to be refined."}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setActionItem(null); setMeltForm({ goldWt: '', diaWt: '' }); }} className="h-9 text-xs font-bold">Cancel</Button>
              <Button 
                onClick={executeAction} 
                disabled={isProcessing || ((actionType === 'repair' || actionType === 'melt') && !actionNotes.trim())}
                className={`h-9 text-xs font-bold text-white ${actionType === 'restock' ? 'bg-emerald-600 hover:bg-emerald-700' : actionType === 'repair' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirm Routing
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  )
}