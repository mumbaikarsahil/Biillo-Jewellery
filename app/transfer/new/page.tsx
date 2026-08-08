'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  Send, Package, ArrowRight, ArrowLeft, ChevronRight, 
  Database, Loader2, Warehouse, Boxes, Info, Printer, ShieldCheck, Wrench,
  AlertCircle, Gift, Box
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'

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

        // FORK IN THE ROAD: Fetch Repairs OR (Inventory + Gifting + Packaging)
        if (transferType === 'repair') {
           const { data: rep } = await supabase.from('repair_tickets').select('*').in('id', activeIds);
           setItems((rep || []).map(r => ({ ...r, _type: 'repair' })));
        } else {
           // Query all 3 tables (UUIDs are globally unique, so they will only match their correct table)
           const { data: itm } = await supabase.from('inventory_items').select('*').in('id', activeIds);
           const { data: gift } = await supabase.from('gifting_inventory').select('*').in('id', activeIds);
           const { data: pack } = await supabase.from('packaging_inventory').select('*').in('id', activeIds);
           
           const mappedItm = (itm || []).map(i => ({ ...i, _type: 'inventory' }));
           const mappedGift = (gift || []).map(g => ({ ...g, _type: 'gifting', transfer_qty: 1 }));
           const mappedPack = (pack || []).map(p => ({ ...p, _type: 'packaging', transfer_qty: 1 }));

           setItems([...mappedItm, ...mappedGift, ...mappedPack]);
        }
      } finally {
        setIsLoading(false)
      }
    };
    fetchData();
  }, [appUser]);

  // Determine source warehouse dynamically based on item type
  const sourceWarehouseId = items[0]?.warehouse_id || items[0]?.current_warehouse_id || items[0]?.origin_warehouse_id;
  const sourceWarehouse = warehouses.find(w => w.id === sourceWarehouseId);

  const updateBulkQty = (id: string, qty: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        let finalQty = isNaN(qty) ? 1 : qty;
        if (finalQty > item.stock_count) finalQty = item.stock_count; // Cap at max available
        if (finalQty < 1) finalQty = 1; // Min 1
        return { ...item, transfer_qty: finalQty };
      }
      return item;
    }));
  }

  const handleDispatch = async () => {
    if (!toWarehouseId) return toast.error("Please select a destination branch");
    
    // ✨ FIX: Pre-Flight Check to block double transfers for strictly tracked items
    const alreadyInTransit = items.some(itm => itm._type === 'inventory' && itm.status && itm.status.includes('transit'));
    if (alreadyInTransit) {
        return toast.error("Action Denied", {
            description: "One or more selected jewelry items are already in transit. You cannot transfer them again."
        });
    }

    setIsDispatching(true);

    try {
      const transferNo = `TRF-${Date.now().toString().slice(-6)}`
      const sealNumber = `SL-${Math.floor(100000 + Math.random() * 900000)}`
      const outerQrHash = `OUT-${crypto.randomUUID().slice(0,8).toUpperCase()}`
      const innerQrHash = `INN-${crypto.randomUUID().slice(0,8).toUpperCase()}`
      
      // Separate Bulk items for JSON storage
      const bulkItems = items.filter(i => i._type === 'gifting' || i._type === 'packaging').map(i => ({
         id: i.id,
         _type: i._type,
         item_name: i.item_name,
         quantity: i.transfer_qty
      }));

      // 1. Create the Main Transfer Record
      const transferPayload: any = {
        company_id: appUser?.company_id,
        transfer_number: transferNo,
        from_warehouse_id: sourceWarehouseId,
        to_warehouse_id: toWarehouseId,
        status: 'in_transit',
        transfer_category: transferType, 
        dispatched_by: appUser?.user_id,
        dispatched_at: new Date(),
        seal_number: sealNumber,
        outer_qr_hash: outerQrHash,
        inner_qr_hash: innerQrHash,
      };

      if (bulkItems.length > 0) {
        transferPayload.bulk_items = bulkItems;
      }

      const { data: transfer, error: tErr } = await supabase
        .from('stock_transfers')
        .insert(transferPayload)
        .select()
        .single();

      if (tErr) throw tErr

      // 2. FORK IN THE ROAD: Update Line Items & Statuses
      if (transferType === 'repair') {
         const lines = items.map(itm => ({ transfer_id: transfer.id, repair_ticket_id: itm.id }))
         
         const { error: lineErr } = await supabase.from('stock_transfer_repair_lines').insert(lines)
         if (lineErr) throw new Error(`Repair Line Insert Failed: ${lineErr.message}`)
         
         const isGoingToHO = items[0]?.origin_warehouse_id === sourceWarehouseId;
         const repairStatus = isGoingToHO ? 'in_transit_to_ho' : 'in_transit_to_store';

         const { error: statusErr } = await supabase.from('repair_tickets')
            .update({ status: repairStatus })
            .in('id', activeIds)
         if (statusErr) throw new Error(`Repair Status Update Failed: ${statusErr.message}`)
            
      } else {
         // Normal Inventory Line Creation
         const invItems = items.filter(i => i._type === 'inventory');
         if (invItems.length > 0) {
           const lines = invItems.map(itm => ({ transfer_id: transfer.id, item_id: itm.id }))
           
           const { error: lineErr } = await supabase.from('stock_transfer_item_lines').insert(lines)
           if (lineErr) throw new Error(`Inventory Line Insert Failed: ${lineErr.message}`)
           
           const { error: statusErr } = await supabase.from('inventory_items')
              .update({ status: 'transit' }) 
              .in('id', invItems.map(i => i.id))
           if (statusErr) throw new Error(`Inventory Status Update Failed: ${statusErr.message}`)
         }

         // ✨ NEW: Deduct Stock for Gifting and Packaging
         for (const bulk of bulkItems) {
            const tableName = bulk._type === 'gifting' ? 'gifting_inventory' : 'packaging_inventory';
            
            // Read current count safely
            const { data: curr } = await supabase.from(tableName).select('stock_count').eq('id', bulk.id).single();
            
            if (curr && curr.stock_count >= bulk.quantity) {
               const { error: updErr } = await supabase.from(tableName).update({ stock_count: curr.stock_count - bulk.quantity }).eq('id', bulk.id);
               if (updErr) throw new Error(`Failed to deduct stock for ${bulk.item_name}`);
            } else {
               throw new Error(`Insufficient stock available for ${bulk.item_name} at time of dispatch.`);
            }
         }
      }

      toast.success("Consignment Dispatched & Secured")
      setDispatchSuccess(transfer) // Triggers the print screen
    } catch (err: any) {
      toast.error(err.message, { duration: 8000 })
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
            <Badge className="text-[10px] font-bold bg-white">{items.length} Tracking Lines</Badge>
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
                        Identifier
                      </TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-gray-400 h-9 px-4">
                        Category
                      </TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-gray-400 h-9 px-6 text-right">
                        Quantity / Weight
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((itm) => {
                      const isBulk = itm._type === 'gifting' || itm._type === 'packaging';
                      const inTransit = itm._type === 'inventory' && itm.status && itm.status.includes('transit');
                      
                      return (
                      <TableRow key={itm.id} className="border-b last:border-0 hover:bg-gray-50/50">
                        <TableCell className="px-6 py-3 font-mono text-xs font-bold text-gray-900 flex items-center gap-2">
                          {isBulk ? itm.item_name : (transferType === 'repair' ? itm.ticket_number : itm.barcode)}
                          
                          {itm._type === 'gifting' && <Badge variant="outline" className="ml-2 text-[9px] h-4 bg-rose-50 text-rose-600 border-rose-200 shadow-none"><Gift className="w-2.5 h-2.5 mr-1"/> GIFTING</Badge>}
                          {itm._type === 'packaging' && <Badge variant="outline" className="ml-2 text-[9px] h-4 bg-cyan-50 text-cyan-600 border-cyan-200 shadow-none"><Box className="w-2.5 h-2.5 mr-1"/> PACKAGING</Badge>}

                          {/* Warning for standard inventory already in transit */}
                          {inTransit && (
                            <Badge variant="destructive" className="h-4 text-[9px] px-1 ml-2 flex items-center gap-1 shadow-none">
                              <AlertCircle className="w-3 h-3" /> Already In Transit
                            </Badge>
                          )}
                        </TableCell>
                        
                        <TableCell className="px-4 text-[13px] font-medium text-gray-600 uppercase tracking-wider text-[10px]">
                          {isBulk ? itm._type : (transferType === 'repair' ? itm.item_description : itm.item_category)}
                        </TableCell>
                        
                        <TableCell className="px-6 text-right text-[13px] font-medium text-gray-500">
                          {isBulk ? (
                            <div className="flex items-center justify-end gap-2">
                              <Input 
                                type="number" 
                                min={1} 
                                max={itm.stock_count} 
                                value={itm.transfer_qty} 
                                onChange={(e) => updateBulkQty(itm.id, parseInt(e.target.value))}
                                className="w-16 h-7 text-right font-mono text-xs bg-white focus-visible:ring-indigo-500"
                              />
                              <span className="text-[10px] text-gray-400">/ {itm.stock_count}</span>
                            </div>
                          ) : (
                            transferType === 'repair' ? `${itm.gross_weight_g}g` : `${itm.net_weight_g}g`
                          )}
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col md:flex-row items-center gap-6 pt-4">
           <div className="flex-1 flex items-start gap-3 p-4 rounded-xl border border-blue-100 bg-blue-50/50">
             <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
             <p className="text-[11px] text-blue-700 font-medium leading-relaxed uppercase tracking-tight">
               Dispatching will log this {transferType} transit and generate <span className="font-bold">Outer & Inner QR Security Keys</span>. Bulk items (gifts/packaging) will be deducted from source inventory immediately.
             </p>
           </div>
           
           <Button 
            onClick={handleDispatch} 
            className="w-full md:w-[280px] h-12 text-sm font-bold uppercase tracking-widest shadow-lg bg-slate-900 hover:bg-slate-800" 
            disabled={isDispatching || isLoading || !toWarehouseId || items.some(itm => itm._type === 'inventory' && itm.status?.includes('transit'))}
           >
            {isDispatching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {isDispatching ? "Securing Vault..." : "Seal & Dispatch"}
          </Button>
        </div>
      </main>
    </div>
  )
}