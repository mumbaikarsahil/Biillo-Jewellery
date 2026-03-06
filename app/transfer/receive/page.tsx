'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  PackageCheck, 
  Search, 
  ArrowLeft, 
  CheckCircle2, 
  ArrowRight, 
  ChevronRight, 
  RefreshCw, 
  Database,
  Loader2,
  Lock,
  Warehouse,
  Boxes,
  Info
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

// Helper to prevent Postgres UUID crashes
const isUUID = (str: string) => {
  const regexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
  return regexExp.test(str);
}

export default function ReceiveStockPage() {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState('')
  const [transferData, setTransferData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)

  const fetchTransferDetails = async (inputStr: string) => {
    const cleanInput = inputStr.trim()
    if (!cleanInput) return toast.error("Enter Transfer # or scan QR")
    
    setLoading(true)
    
    let query = supabase
      .from('stock_transfers')
      .select('*, from:from_warehouse_id(name), to:to_warehouse_id(name), items:stock_transfer_item_lines(item_id, inventory_items(*))')
      .eq('status', 'in_transit')

    if (isUUID(cleanInput)) {
      query = query.eq('id', cleanInput)
    } else {
      query = query.eq('transfer_number', cleanInput.toUpperCase())
    }

    const { data, error } = await query.single()

    if (error || !data) {
      toast.error("Invalid Voucher, or stock is not in transit.")
      setTransferData(null)
    } else {
      setTransferData(data)
      toast.success("Voucher Authenticated!")
    }
    setLoading(false)
  }

  const handleConfirmReceive = async () => {
    setIsCommitting(true)
    try {
      const itemIds = transferData.items.map((i: any) => i.item_id)
      
      const { error: itemErr } = await supabase
        .from('inventory_items')
        .update({ 
          warehouse_id: transferData.to_warehouse_id,
          status: 'in_stock'
        })
        .in('id', itemIds)

      if (itemErr) throw itemErr

      const { error: trfErr } = await supabase
        .from('stock_transfers')
        .update({ 
          status: 'completed',
          received_at: new Date().toISOString() 
        })
        .eq('id', transferData.id)
        .select()
        .single() 
        
      if (trfErr) throw trfErr

      toast.success("Stock added to vault!")
      setTransferData(null)
      setSearchInput('')
      
      setTimeout(() => {
        window.location.href = '/transfer'
      }, 1500)

    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to update database") 
    } finally {
      setIsCommitting(false)
    }
  }

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
            <span className="font-bold text-gray-900 select-none">Secure Receive</span>
            
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-100">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">Auth Mode</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-2 text-xs font-medium text-gray-500 hover:text-gray-900"
            onClick={() => { setTransferData(null); setSearchInput(''); }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold px-3 shadow-sm border-gray-200 hidden sm:flex">
            <Database className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
            Vault Sync
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-[600px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
        
        {/* SCAN / SEARCH INPUT SECTION */}
        <Card className="shadow-sm border-gray-200/60 overflow-hidden bg-white">
          <CardHeader className="bg-gray-50/50 py-3 px-4 border-b">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Package Authentication</h3>
          </CardHeader>
          <CardContent className="pt-6 pb-6 px-4">
            <div className="flex gap-2">
              <div className="relative flex-1 group">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                <Input 
                  autoFocus
                  placeholder="Scan QR or enter TRF #..." 
                  className="pl-9 h-9 text-sm font-mono bg-white border-gray-200 focus-visible:ring-gray-300 uppercase"
                  value={searchInput} 
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchTransferDetails(searchInput)}
                />
              </div>
              <Button onClick={() => fetchTransferDetails(searchInput)} disabled={loading} className="h-9 px-6 font-bold text-xs uppercase tracking-tight shadow-md">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Verify"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* AUTHENTICATED RESULTS SECTION */}
        {transferData && (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
            <Card className="shadow-sm border-emerald-200/60 overflow-hidden bg-white">
              <CardHeader className="bg-emerald-50/30 py-3 px-4 border-b border-emerald-100 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                   <Lock className="h-3.5 w-3.5 text-emerald-600" />
                   <h3 className="text-[11px] font-black uppercase tracking-widest text-emerald-700">Parcel Verified</h3>
                </div>
                <Badge variant="outline" className="text-[9px] font-black uppercase bg-white border-emerald-200 text-emerald-600 h-5 px-1.5">Authenticated</Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-6 border-b flex flex-col items-center justify-center text-center">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-1">Stock Transfer Number</p>
                   <p className="text-3xl font-mono font-black text-gray-900 tracking-tighter">{transferData.transfer_number}</p>
                </div>

                <div className="grid grid-cols-2 bg-gray-50/50">
                  <div className="p-4 border-r border-b border-gray-100">
                    <label className="text-[10px] font-bold text-gray-400 uppercase leading-none block mb-2">From Origin</label>
                    <div className="flex items-center gap-2">
                       <Warehouse className="h-3.5 w-3.5 text-gray-400" />
                       <span className="text-sm font-bold text-gray-700">{transferData.from.name}</span>
                    </div>
                  </div>
                  <div className="p-4 border-b border-gray-100 bg-blue-50/20">
                    <label className="text-[10px] font-bold text-blue-400 uppercase leading-none block mb-2">Into Destination</label>
                    <div className="flex items-center gap-2">
                       <Warehouse className="h-3.5 w-3.5 text-blue-500" />
                       <span className="text-sm font-bold text-blue-700">{transferData.to.name}</span>
                    </div>
                  </div>
                </div>

                {/* Items List - High Density */}
                <div className="p-4 space-y-3">
                   <div className="flex items-center gap-2">
                      <Boxes className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Inventory Manifest ({transferData.items.length})</span>
                   </div>
                   <div className="max-h-[180px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                      {transferData.items.map((line: any) => (
                        <div key={line.item_id} className="flex items-center justify-between p-2.5 rounded border border-gray-100 bg-[#fafafa]">
                          <div className="flex flex-col">
                            <span className="text-xs font-mono font-bold text-gray-800">{line.inventory_items.barcode}</span>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">{line.inventory_items.item_category}</span>
                          </div>
                          <span className="text-sm font-black text-gray-900">{line.inventory_items.net_weight_g}g</span>
                        </div>
                      ))}
                   </div>
                </div>

                {/* Action Footer */}
                <div className="p-6 bg-gray-50/50 border-t">
                  <Button 
                    onClick={handleConfirmReceive} 
                    className="w-full h-12 bg-gray-900 hover:bg-black text-white font-bold text-xs uppercase tracking-widest shadow-lg transition-all"
                    disabled={isCommitting}
                  >
                    {isCommitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Committing to Ledger...
                      </>
                    ) : (
                      "Ingest Stock into Vault"
                    )}
                  </Button>
                  
                  <div className="mt-4 flex items-start gap-2.5 text-blue-600 px-1">
                    <Info className="h-3.5 w-3.5 mt-0.5" />
                    <p className="text-[10px] font-bold uppercase leading-tight tracking-tight">
                      By committing, items will be moved to <span className="underline italic">in_stock</span> and ownership is updated in the database.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </main>
    </div>
  )
}