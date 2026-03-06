'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  Send, 
  Package, 
  ArrowRight, 
  ArrowLeft, 
  ChevronRight, 
  RefreshCw, 
  Database,
  LayoutDashboard,
  Loader2,
  Warehouse,
  Boxes,
  Info,
  Badge
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function NewTransferPage() {
  const { appUser } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams();
  const itemIds = searchParams.get('ids')?.split(',') || [];
  const sourceWhId = searchParams.get('from'); 

  const [items, setItems] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [toWarehouseId, setToWarehouseId] = useState('')
  const [isDispatching, setIsDispatching] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!appUser) return;
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const { data: wh } = await supabase.from('warehouses').select('*').eq('company_id', appUser.company_id);
        const { data: itm } = await supabase.from('inventory_items').select('*').in('id', itemIds);
        
        setWarehouses(wh || []);
        setItems(itm || []);
      } finally {
        setIsLoading(false)
      }
    };
    fetchData();
  }, [appUser]);

  const handleDispatch = async () => {
    if (!appUser) {
      toast.error("User session not found.");
      return;
    }
    
    if (!toWarehouseId) {
      toast.error("Please select a destination branch");
      return;
    }

    setIsDispatching(true);

    try {
      const transferNo = `TRF-${Date.now().toString().slice(-6)}`
      
      const { data: transfer, error: tErr } = await supabase
        .from('stock_transfers')
        .insert({
          company_id: appUser.company_id,
          transfer_number: transferNo,
          from_warehouse_id: items[0].warehouse_id,
          to_warehouse_id: toWarehouseId,
          status: 'in_transit',
          dispatched_by: appUser.user_id,
          dispatched_at: new Date()
        })
        .select()
        .single();

      if (tErr) throw tErr

      const lines = items.map(itm => ({
        transfer_id: transfer.id,
        item_id: itm.id
      }))

      await supabase.from('stock_transfer_item_lines').insert(lines)
      
      await supabase
        .from('inventory_items')
        .update({ status: 'transit' })
        .in('id', itemIds)

      toast.success("Items Dispatched Successfully")
      router.push(`/transfer/voucher/${transfer.id}`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsDispatching(false)
    }
  }

  const sourceWarehouse = warehouses.find(w => w.id === items[0]?.warehouse_id);

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa]">
      {/* --- COMPACT IDE-STYLE TOOLBAR HEADER --- */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 h-12 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/transfer">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-gray-100 transition-colors">
              <ArrowLeft className="h-4 w-4 text-gray-500" />
            </Button>
          </Link>
          
          <Separator orientation="vertical" className="h-4" />
          
          <nav className="flex items-center gap-1.5 text-[13px] whitespace-nowrap overflow-hidden">
            <Link href="/transfer" className="text-gray-500 hover:text-gray-900 transition-colors font-medium">Transfers</Link>
            <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            <span className="font-bold text-gray-900 select-none">New Dispatch</span>
            
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">Drafting</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium text-gray-500 hover:text-gray-900" onClick={() => router.back()}>
            Cancel
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold px-3 shadow-sm border-gray-200 hidden sm:flex">
            <Database className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
            Transfer Ledger
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-[1000px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
        
        {/* TRANSFER ROUTE SECTION */}
        <div className="flex flex-col md:flex-row gap-6">
          <Card className="flex-1 shadow-sm border-gray-200/60 overflow-hidden bg-white">
            <CardHeader className="bg-gray-50/50 py-3 px-4 border-b">
               <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Routing Configuration</h3>
            </CardHeader>
            <CardContent className="p-6">
               <div className="flex flex-col md:flex-row items-center gap-6">
                  {/* Source */}
                  <div className="w-full md:w-auto flex-1 space-y-1.5">
                    <Label className="text-[10px] font-bold text-gray-400 uppercase">Source Vault</Label>
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-200 bg-gray-50/50">
                       <Warehouse className="h-4 w-4 text-gray-400" />
                       <span className="text-sm font-bold text-gray-700">{sourceWarehouse?.name || '---'}</span>
                    </div>
                  </div>

                  <div className="rotate-90 md:rotate-0">
                    <ArrowRight className="h-5 w-5 text-gray-300" />
                  </div>

                  {/* Destination */}
                  <div className="w-full md:w-auto flex-1 space-y-1.5">
                    <Label className="text-[10px] font-bold text-gray-400 uppercase">Destination Branch</Label>
                    <Select onValueChange={setToWarehouseId}>
                      <SelectTrigger className="h-10 border-gray-200 bg-white focus:ring-gray-300">
                        <SelectValue placeholder="Select target..." />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.filter(w => w.id !== items[0]?.warehouse_id).map(w => (
                          <SelectItem key={w.id} value={w.id} className="text-sm font-medium">{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>

        {/* ITEMS LIST SECTION */}
        <Card className="shadow-sm border-gray-200/60 overflow-hidden bg-white">
          <CardHeader className="bg-gray-50/50 py-3 px-4 border-b flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-gray-400" />
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-tight">Consignment Content</h3>
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
                      <TableHead className="text-[10px] font-bold uppercase text-gray-400 h-9 px-6">Barcode / SKU</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-gray-400 h-9 px-4">Category</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-gray-400 h-9 px-4 text-right">Gross Wt.</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-gray-400 h-9 px-4 text-right">Net Wt.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((itm) => (
                      <TableRow key={itm.id} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                        <TableCell className="px-6 py-3 font-mono text-xs font-bold text-gray-900">{itm.barcode}</TableCell>
                        <TableCell className="px-4 text-[13px] font-medium text-gray-600">{itm.item_category}</TableCell>
                        <TableCell className="px-4 text-right text-[13px] font-bold text-gray-900">{itm.gross_weight_g}g</TableCell>
                        <TableCell className="px-4 text-right text-[13px] font-medium text-gray-500">{itm.net_weight_g}g</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* FOOTER ACTIONS */}
        <div className="flex flex-col md:flex-row items-center gap-6 pt-4">
           <div className="flex-1 flex items-start gap-3 p-4 rounded-xl border border-blue-100 bg-blue-50/50">
             <Info className="h-4 w-4 text-blue-500 mt-0.5" />
             <p className="text-[11px] text-blue-700 font-medium leading-relaxed uppercase tracking-tight">
               By confirming, you authorize the transfer of ownership to the destination vault. Items will be marked as <span className="font-bold">IN TRANSIT</span> and require physical verification at the target branch.
             </p>
           </div>
           
           <Button 
            onClick={handleDispatch} 
            className="w-full md:w-[280px] h-12 text-sm font-bold uppercase tracking-widest shadow-lg" 
            disabled={isDispatching || isLoading || !toWarehouseId}
           >
            {isDispatching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Dispatching...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Confirm Dispatch
              </>
            )}
          </Button>
        </div>

      </main>
    </div>
  )
}