'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { 
  PackageCheck, 
  Search, 
  ArrowLeft, 
  CheckCircle2, 
  ChevronRight, 
  RefreshCw, 
  Database,
  Loader2,
  Lock,
  Warehouse,
  Boxes,
  Info,
  Camera,
  X,
  QrCode
} from 'lucide-react'
import { toast } from 'sonner'
import { Scanner } from '@yudiel/react-qr-scanner'

import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

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
  const [showScanner, setShowScanner] = useState(false)

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

    const { data, error } = await query.maybeSingle()

    if (error || !data) {
      toast.error("Invalid Voucher, or stock is not in transit.")
      setTransferData(null)
    } else {
      setTransferData(data)
      setSearchInput(data.transfer_number) // Sync input with the actual number
      toast.success("Voucher Authenticated!")
    }
    setLoading(false)
  }

  const onScanSuccess = (detectedCodes: any[]) => {
    if (detectedCodes && detectedCodes.length > 0) {
      setShowScanner(false)
      fetchTransferDetails(detectedCodes[0].rawValue)
    }
  }

  const handleConfirmReceive = async () => {
    if (!transferData) return
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
        
      if (trfErr) throw trfErr

      toast.success("Stock ingested into vault successfully!")
      setTransferData(null)
      setSearchInput('')
      
      router.push('/transfer')
    } catch (err: any) {
      toast.error(err.message || "Failed to update ledger") 
    } finally {
      setIsCommitting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] font-sans selection:bg-indigo-100">
      
      {/* CAMERA OVERLAY */}
      {showScanner && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="flex justify-between items-center p-4 bg-slate-900 text-white">
            <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <QrCode className="w-4 h-4 text-indigo-400" /> Transfer Key Scanner
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setShowScanner(false)} className="text-white hover:bg-white/20 rounded-full">
              <X className="w-6 h-6" />
            </Button>
          </div>
          <div className="flex-1 relative bg-black flex items-center justify-center">
            <Scanner onScan={onScanSuccess} components={{ finder: true }} />
          </div>
          <div className="p-6 bg-slate-900 text-center text-xs text-slate-400 uppercase tracking-widest">
            Center the Transfer Voucher QR code in the frame
          </div>
        </div>
      )}

      {/* --- MODERN h-14 HEADER --- */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center sticky top-0 z-40 shadow-sm box-border">
        <div className="w-full max-w-5xl mx-auto flex justify-between items-center gap-4">
          <div className="flex items-center gap-2.5">
            <Link href="/transfer">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-slate-100 text-slate-500">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-4 bg-slate-200" />
            <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">Receive Parcel</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-2 text-xs font-semibold text-slate-500 hover:text-slate-900"
              onClick={() => { setTransferData(null); setSearchInput(''); }}
            >
              <RefreshCw className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <Button variant="outline" size="sm" className="h-8 text-xs font-bold px-3 border-slate-200 bg-white text-slate-700 shadow-sm rounded-md pointer-events-none hidden sm:flex">
              <Database className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
              Vault Sync
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-xl w-full mx-auto space-y-6 animate-in fade-in duration-500">
        
        {/* PACKAGE SEARCH & SCAN */}
        <div className={cn(
          "bg-white border rounded-xl overflow-hidden shadow-sm transition-all duration-300",
          transferData ? "border-emerald-200" : "border-slate-200"
        )}>
          <div className="bg-slate-50/50 py-3 px-5 border-b border-inherit">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Package Authentication</h3>
          </div>
          <div className="p-5">
            <div className="flex gap-2">
              <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <Input 
                  placeholder="Transfer ID or Scan..." 
                  className="pl-9 h-10 text-sm font-mono bg-white border-slate-200 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 uppercase rounded-lg"
                  value={searchInput} 
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchTransferDetails(searchInput)}
                />
              </div>
              <Button onClick={() => setShowScanner(true)} variant="outline" className="h-10 w-10 p-0 border-slate-200 hover:bg-slate-50 shadow-sm rounded-lg shrink-0">
                <Camera className="h-4 w-4 text-slate-600" />
              </Button>
              <Button onClick={() => fetchTransferDetails(searchInput)} disabled={loading} className="h-10 px-5 font-bold text-xs uppercase bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
              </Button>
            </div>
          </div>
        </div>

        {/* VERIFIED PARCEL CARD */}
        {transferData && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-emerald-50/50 py-3 px-5 border-b border-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <Lock className="h-3.5 w-3.5 text-emerald-600" />
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Parcel Authenticated</h3>
                </div>
                <Badge variant="outline" className="text-[9px] font-bold uppercase bg-white border-emerald-200 text-emerald-600 rounded-md">Verified</Badge>
              </div>
              
              <div className="p-0">
                <div className="p-8 border-b border-slate-100 text-center">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Stock Transfer Number</p>
                   <p className="text-4xl font-mono font-black text-slate-900 tracking-tighter">{transferData.transfer_number}</p>
                </div>

                <div className="grid grid-cols-2">
                  <div className="p-5 border-r border-b border-slate-100">
                    <label className="text-[10px] font-bold text-slate-400 uppercase leading-none block mb-2">Origin</label>
                    <div className="flex items-center gap-2">
                       <Warehouse className="h-4 w-4 text-slate-300" />
                       <span className="text-sm font-semibold text-slate-700">{transferData.from.name}</span>
                    </div>
                  </div>
                  <div className="p-5 border-b border-slate-100 bg-indigo-50/20">
                    <label className="text-[10px] font-bold text-indigo-400 uppercase leading-none block mb-2">Destination</label>
                    <div className="flex items-center gap-2">
                       <Warehouse className="h-4 w-4 text-indigo-500" />
                       <span className="text-sm font-semibold text-indigo-900">{transferData.to.name}</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                   <div className="flex items-center gap-2">
                      <Boxes className="h-4 w-4 text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inventory Manifest ({transferData.items.length})</span>
                   </div>
                   
                   <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                      {transferData.items.map((line: any) => (
                        <div key={line.item_id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                          <div className="flex flex-col">
                            <span className="text-xs font-mono font-bold text-slate-800">{line.inventory_items.barcode}</span>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">{line.inventory_items.item_category}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-900">{line.inventory_items.net_weight_g}g</span>
                            <span className="block text-[9px] text-slate-400 font-medium">Net Weight</span>
                          </div>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-200">
                  <Button 
                    onClick={handleConfirmReceive} 
                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest shadow-md rounded-xl transition-all"
                    disabled={isCommitting}
                  >
                    {isCommitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating Vault...
                      </>
                    ) : (
                      "Ingest Stock into Vault"
                    )}
                  </Button>
                  
                  <div className="mt-4 flex items-start gap-2.5 text-indigo-600 px-1 bg-white p-3 rounded-lg border border-indigo-100">
                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                    <p className="text-[10px] font-bold uppercase leading-tight tracking-tight">
                      System Action: By confirming, items will be moved to <span className="underline italic">in_stock</span> and the branch ID will be updated.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}