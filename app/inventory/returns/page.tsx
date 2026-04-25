"use client"

import React, { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useStoreLocation } from "@/hooks/useStoreLocation"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"
import { format } from "date-fns"

import { 
  Undo2, Package, Search, CheckCircle2, Wrench, Clock, ShieldAlert,
  Loader2, RefreshCw, ChevronLeft
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  const { selectedLocation } = useStoreLocation()
  
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal States
  const [actionItem, setActionItem] = useState<any>(null)
  const [actionType, setActionType] = useState<'restock' | 'repair' | null>(null)
  const [actionNotes, setActionNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const fetchReturns = async () => {
    if (!appUser?.company_id || !selectedLocation) return
    setLoading(true)
    try {
      let q = supabase
        .from('inventory_items')
        .select('id, barcode, item_category, purity_karat, net_weight_g, total_stone_weight_cts, status, audit_history, updated_at')
        .eq('company_id', appUser.company_id)
        .eq('is_exchanged', true)
        // We only want items sitting in the "exchanged" status awaiting decision
        .in('status', ['exchanged', 'returned'])
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

  // Helper to grab the reason from the latest audit log
  const getReturnReason = (history: any[]) => {
    if (!history || history.length === 0) return "No reason provided."
    // Assuming the first item in the array is the latest
    return history[0]?.reason || "No reason provided."
  }

  const executeAction = async () => {
    if (!actionItem || !actionType || !appUser) return
    if (actionType === 'repair' && !actionNotes.trim()) {
      return toast.error("Please provide repair instructions.")
    }

    setIsProcessing(true)
    try {
      const newStatus = actionType === 'restock' ? 'in_stock' : 'repairs'
      const logMessage = actionType === 'restock' 
        ? `QC Passed: Restocked to Vault. Notes: ${actionNotes || 'None'}`
        : `Sent to Repair. Defect: ${actionNotes}`

      const newLogEntry = {
        timestamp: new Date().toISOString(),
        user_name: appUser.full_name || 'Manager',
        reason: logMessage,
        changes: `Status: ${actionItem.status} ➝ ${newStatus}`
      }

      const currentHistory = Array.isArray(actionItem.audit_history) ? actionItem.audit_history : []
      const updatedHistory = [newLogEntry, ...currentHistory]

      // ✨ CRITICAL: We update status, but leave is_exchanged = true alone!
      const { error } = await supabase.from('inventory_items').update({
        status: newStatus,
        audit_history: updatedHistory,
        updated_by: appUser.id || appUser.user_id
      }).eq('id', actionItem.id)

      if (error) throw error

      toast.success(`Item successfully moved to ${newStatus.replace('_', ' ')}`)
      setActionItem(null)
      setActionType(null)
      setActionNotes('')
      fetchReturns() // Refresh inbox
    } catch (err: any) {
      toast.error("Failed to process item.")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa] p-4 md:p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
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
              Inspect returned items and route them to live inventory or repairs.
            </p>
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
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={fetchReturns}>
            <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Inbox Table */}
        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden rounded-2xl">
          <Table>
            <TableHeader className="bg-rose-50/50">
              <TableRow>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-11">Item Details</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-11">Intake Reason</TableHead>
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
                          BUYBACK
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        {item.item_category} ({item.purity_karat}) • {item.net_weight_g}g
                      </div>
                    </TableCell>
                    
                    <TableCell className="py-3 max-w-[250px]">
                      <div className="bg-slate-100/50 border border-slate-200 p-2 rounded-lg text-xs text-slate-700 italic truncate" title={getReturnReason(item.audit_history)}>
                        "{getReturnReason(item.audit_history)}"
                      </div>
                    </TableCell>

                    <TableCell className="py-3">
                      <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        {format(new Date(item.updated_at), 'dd MMM, HH:mm')}
                      </div>
                    </TableCell>

                    <TableCell className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          size="sm" 
                          className="h-8 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-200 text-xs font-bold"
                          onClick={() => { setActionItem(item); setActionType('restock'); }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Restock
                        </Button>
                        <Button 
                          size="sm" 
                          className="h-8 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 border border-amber-200 text-xs font-bold"
                          onClick={() => { setActionItem(item); setActionType('repair'); }}
                        >
                          <Wrench className="w-3.5 h-3.5 mr-1.5" /> Repair
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
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className={`flex items-center gap-2 ${actionType === 'restock' ? 'text-emerald-600' : 'text-amber-600'}`}>
                {actionType === 'restock' ? <CheckCircle2 className="w-5 h-5"/> : <Wrench className="w-5 h-5"/>}
                {actionType === 'restock' ? 'Approve & Restock' : 'Send to Repair'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Routing <strong className="text-slate-800">{actionItem?.barcode}</strong>. 
                The 'Buyback' history flag will be preserved permanently for audits.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <Label className="text-xs font-semibold text-slate-700 mb-2 block">
                {actionType === 'restock' ? 'QC Notes (Optional)' : 'Defect / Repair Instructions (Required)'}
              </Label>
              <Textarea 
                className="resize-none text-xs" 
                placeholder={actionType === 'restock' ? "e.g. Cleaned and polished." : "e.g. Broken clasp, needs soldering."}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setActionItem(null)} className="h-9 text-xs font-bold">Cancel</Button>
              <Button 
                onClick={executeAction} 
                disabled={isProcessing || (actionType === 'repair' && !actionNotes.trim())}
                className={`h-9 text-xs font-bold text-white ${actionType === 'restock' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}
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