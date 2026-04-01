'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  Send, Package, ArrowRight, ArrowLeft, ChevronRight, 
  Database, Loader2, Warehouse, Boxes, Info, Printer, ShieldCheck, Wrench,
  Badge
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function NewTransferPage() {
  const { appUser } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams();
  
  // DETERMINE TRANSFER TYPE FROM URL
  const transferType = searchParams.get('type') || 'inventory'; 
  const rawItemIds = searchParams.get('ids');
  const rawRepairIds = searchParams.get('repair_ids');
  
  const itemIds = rawItemIds ? rawItemIds.split(',') : [];
  const repairIds = rawRepairIds ? rawRepairIds.split(',') : [];
  const activeIds = transferType === 'repair' ? repairIds : itemIds;
  
  const [items, setItems] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [toWarehouseId, setToWarehouseId] = useState('')
  const [isDispatching, setIsDispatching] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  // New State for the Success/Print Screen
  const [dispatchSuccess, setDispatchSuccess] = useState<any>(null)

  useEffect(() => {
    if (!appUser || activeIds.length === 0) return;
    
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const { data: wh } = await supabase.from('warehouses').select('*').eq('company_id', appUser.company_id);
        setWarehouses(wh || []);

        // FORK IN THE ROAD: Fetch Repairs OR Inventory based on URL
        if (transferType === 'repair') {
           const { data: rep } = await supabase.from('repair_tickets').select('*').in('id', activeIds);
           setItems(rep || []);
        } else {
           const { data: itm } = await supabase.from('inventory_items').select('*').in('id', activeIds);
           setItems(itm || []);
        }
      } finally {
        setIsLoading(false)
      }
    };
    fetchData();
  }, [appUser]);

  // Determine source warehouse dynamically based on item type
  const sourceWarehouseId = transferType === 'repair' 
    ? (items[0]?.current_warehouse_id || items[0]?.origin_warehouse_id) 
    : items[0]?.warehouse_id;
    
  const sourceWarehouse = warehouses.find(w => w.id === sourceWarehouseId);

  const handleDispatch = async () => {
    if (!toWarehouseId) return toast.error("Please select a destination branch");
    setIsDispatching(true);

    try {
      const transferNo = `TRF-${Date.now().toString().slice(-6)}`
      // Generate Secure Hashes and Seal
      const sealNumber = `SL-${Math.floor(100000 + Math.random() * 900000)}`
      const outerQrHash = `OUT-${crypto.randomUUID().slice(0,8).toUpperCase()}`
      const innerQrHash = `INN-${crypto.randomUUID().slice(0,8).toUpperCase()}`
      
      // 1. Create the Main Transfer Record
      const { data: transfer, error: tErr } = await supabase
        .from('stock_transfers')
        .insert({
          company_id: appUser?.company_id,
          transfer_number: transferNo,
          from_warehouse_id: sourceWarehouseId,
          to_warehouse_id: toWarehouseId,
          status: 'in_transit',
          transfer_category: transferType, // Marks it as 'repair' or 'inventory'
          dispatched_by: appUser?.user_id,
          dispatched_at: new Date(),
          seal_number: sealNumber,
          outer_qr_hash: outerQrHash,
          inner_qr_hash: innerQrHash
        })
        .select()
        .single();

      if (tErr) throw tErr

      // 2. FORK IN THE ROAD: Update Line Items & Statuses
      if (transferType === 'repair') {
         const lines = items.map(itm => ({ transfer_id: transfer.id, repair_ticket_id: itm.id }))
         await supabase.from('stock_transfer_repair_lines').insert(lines)
         
         // Smart routing: If sending from branch, it's going to HO. If sending from HO, it's returning to branch.
         const isGoingToHO = items[0]?.origin_warehouse_id === sourceWarehouseId;
         const repairStatus = isGoingToHO ? 'in_transit_to_ho' : 'in_transit_to_store';

         await supabase.from('repair_tickets')
            .update({ status: repairStatus })
            .in('id', activeIds)
            
      } else {
         // Normal Inventory Flow
         const lines = items.map(itm => ({ transfer_id: transfer.id, item_id: itm.id }))
         await supabase.from('stock_transfer_item_lines').insert(lines)
         
         await supabase.from('inventory_items')
            .update({ status: 'transit' })
            .in('id', activeIds)
      }

      toast.success("Consignment Dispatched & Secured")
      setDispatchSuccess(transfer) // Triggers the print screen
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsDispatching(false)
    }
  }

  // --- SUCCESS & PRINT SCREEN ---
  if (dispatchSuccess) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg border-indigo-100 animate-in zoom-in-95 duration-300">
          <div className="bg-indigo-600 p-6 flex flex-col items-center text-center rounded-t-xl">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-widest">Vault Sealed</h2>
            <p className="text-indigo-100 text-sm mt-1">Consignment is ready for transit.</p>
          </div>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Physical Seal Number</p>
                <p className="text-2xl font-mono font-black text-slate-900">{dispatchSuccess.seal_number}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-orange-50 border border-orange-100 text-center flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-2">Outer Box Label</p>
                  <p className="text-xs font-mono font-bold text-slate-700 break-all">{dispatchSuccess.outer_qr_hash}</p>
                  <Button variant="outline" size="sm" className="mt-3 w-full text-[10px] h-7 border-orange-200 hover:bg-orange-100">
                    <Printer className="w-3 h-3 mr-1" /> Print Outer
                  </Button>
                </div>
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100 text-center flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">Inner Manifest</p>
                  <p className="text-xs font-mono font-bold text-slate-700 break-all">{dispatchSuccess.inner_qr_hash}</p>
                  <Button variant="outline" size="sm" className="mt-3 w-full text-[10px] h-7 border-emerald-200 hover:bg-emerald-100">
                    <Printer className="w-3 h-3 mr-1" /> Print Inner
                  </Button>
                </div>
              </div>
            </div>
            <Button 
              className="w-full h-12 bg-slate-900 text-white font-bold uppercase tracking-widest"
              onClick={() => router.push(`/transfer/voucher/${dispatchSuccess.id}`)}
            >
              Go to Ledger View
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // --- STANDARD DISPATCH SCREEN ---
  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 h-12 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/transfer">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-gray-100 transition-colors">
              <ArrowLeft className="h-4 w-4 text-gray-500" />
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <nav className="flex items-center gap-1.5 text-[13px]">
            <span className="font-bold text-gray-900 select-none flex items-center gap-2">
              Secure Dispatch
              {transferType === 'repair' && <Badge className="bg-purple-50 text-purple-700 border-purple-200">Customer Property</Badge>}
            </span>
          </nav>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-[1000px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row gap-6">
          <Card className="flex-1 shadow-sm border-gray-200/60 overflow-hidden bg-white">
            <CardHeader className="bg-gray-50/50 py-3 px-4 border-b">
               <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Routing Configuration</h3>
            </CardHeader>
            <CardContent className="p-6">
               <div className="flex flex-col md:flex-row items-center gap-6">
                 <div className="w-full md:w-auto flex-1 space-y-1.5">
                   <Label className="text-[10px] font-bold text-gray-400 uppercase">Source Location</Label>
                   <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-200 bg-gray-50/50">
                      <Warehouse className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-bold text-gray-700">{sourceWarehouse?.name || '---'}</span>
                   </div>
                 </div>
                 <ArrowRight className="h-5 w-5 text-gray-300 hidden md:block" />
                 <div className="w-full md:w-auto flex-1 space-y-1.5">
                   <Label className="text-[10px] font-bold text-gray-400 uppercase">Destination Branch</Label>
                   <Select onValueChange={setToWarehouseId}>
                     <SelectTrigger className="h-10 border-gray-200 bg-white">
                       <SelectValue placeholder="Select target..." />
                     </SelectTrigger>
                     <SelectContent>
                       {warehouses.filter(w => w.id !== sourceWarehouseId).map(w => (
                         <SelectItem key={w.id} value={w.id} className="text-sm font-medium">{w.name}</SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>
               </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm border-gray-200/60 overflow-hidden bg-white">
          <CardHeader className={`py-3 px-4 border-b flex flex-row items-center justify-between ${transferType === 'repair' ? 'bg-purple-50/50' : 'bg-gray-50/50'}`}>
            <div className="flex items-center gap-2">
              {transferType === 'repair' ? <Wrench className="h-4 w-4 text-purple-500" /> : <Boxes className="h-4 w-4 text-gray-400" />}
              <h3 className={`text-[11px] font-bold uppercase tracking-tight ${transferType === 'repair' ? 'text-purple-700' : 'text-gray-400'}`}>
                Consignment Content
              </h3>
            </div>
            <Badge className="text-[10px] font-bold bg-white">{items.length} Units</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
               <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-200" /></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50/30">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold uppercase text-gray-400 h-9 px-6">
                        {transferType === 'repair' ? 'Ticket #' : 'Barcode / SKU'}
                      </TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-gray-400 h-9 px-4">
                        {transferType === 'repair' ? 'Description' : 'Category'}
                      </TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-gray-400 h-9 px-4 text-right">
                        {transferType === 'repair' ? 'Gross Wt.' : 'Net Wt.'}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((itm) => (
                      <TableRow key={itm.id} className="border-b last:border-0 hover:bg-gray-50/50">
                        <TableCell className="px-6 py-3 font-mono text-xs font-bold text-gray-900">
                          {transferType === 'repair' ? itm.ticket_number : itm.barcode}
                        </TableCell>
                        <TableCell className="px-4 text-[13px] font-medium text-gray-600">
                          {transferType === 'repair' ? itm.item_description : itm.item_category}
                        </TableCell>
                        <TableCell className="px-4 text-right text-[13px] font-medium text-gray-500">
                          {transferType === 'repair' ? `${itm.gross_weight_g}g` : `${itm.net_weight_g}g`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col md:flex-row items-center gap-6 pt-4">
           <div className="flex-1 flex items-start gap-3 p-4 rounded-xl border border-blue-100 bg-blue-50/50">
             <Info className="h-4 w-4 text-blue-500 mt-0.5" />
             <p className="text-[11px] text-blue-700 font-medium leading-relaxed uppercase tracking-tight">
               Dispatching will log this {transferType} transit and generate <span className="font-bold">Outer & Inner QR Security Keys</span>.
             </p>
           </div>
           
           <Button 
            onClick={handleDispatch} 
            className="w-full md:w-[280px] h-12 text-sm font-bold uppercase tracking-widest shadow-lg bg-slate-900 hover:bg-slate-800" 
            disabled={isDispatching || isLoading || !toWarehouseId}
           >
            {isDispatching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {isDispatching ? "Securing Vault..." : "Seal & Dispatch"}
          </Button>
        </div>
      </main>
    </div>
  )
}