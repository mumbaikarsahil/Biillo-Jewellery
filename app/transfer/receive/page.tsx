'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Search, ArrowLeft, RefreshCw, Loader2, Warehouse, 
  Boxes, Info, Camera, X, QrCode, ShieldAlert, CheckSquare, Square, Wrench, Gift, Box
} from 'lucide-react'
import { toast } from 'sonner'
import { Scanner } from '@yudiel/react-qr-scanner'

import { useAuth } from '@/hooks/useAuth'
import { useStoreLocation } from '@/hooks/useStoreLocation' 
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

// --- THE QR SANITIZER ---
const sanitizeScannedQR = (scannedText: string): string => {
  if (!scannedText) return '';
  let cleanText = scannedText.trim();

  if (cleanText.startsWith('http')) {
    try {
      const url = new URL(cleanText);
      const hashParam = url.searchParams.get('hash') || url.searchParams.get('seal');
      if (hashParam) return hashParam;
      const pathHash = url.pathname.split('/').pop();
      if (pathHash) return pathHash;
    } catch (e) {
      // Ignore URL parse errors
    }
  }

  if (cleanText.startsWith('{')) {
    try {
      const parsed = JSON.parse(cleanText);
      return parsed.hash || parsed.seal_number || parsed.outer_qr_hash || parsed.inner_qr_hash || cleanText; 
    } catch (e) {
      // Ignore JSON errors
    }
  }

  return cleanText;
}

export default function ReceiveStockPage() {
  const router = useRouter()
  const { appUser } = useAuth()
  
  const { isHQ, selectedLocation } = useStoreLocation() 

  const [searchInput, setSearchInput] = useState('')
  const [transferData, setTransferData] = useState<any>(null)
  
  // State Machine: 'search' -> 'verify_seal' -> 'manifest'
  const [activeStep, setActiveStep] = useState<'search' | 'verify_seal' | 'manifest'>('search')
  const [sealInput, setSealInput] = useState('')
  const [tickedItems, setTickedItems] = useState<Set<string>>(new Set())
  
  const [loading, setLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  const handleScanInput = async (inputStr: string) => {
    const sanitizedInput = sanitizeScannedQR(inputStr);
    const cleanInput = sanitizedInput.toUpperCase();
    
    if (!cleanInput) return toast.error("Enter Hash or Scan QR");

    // --- ANTI-LOOP FAST PATH ---
    if (transferData) {
      if (cleanInput === transferData.inner_qr_hash) {
        if (transferData.status === 'in_transit') {
          return toast.error("SECURITY HALT: You must break the seal first.")
        }
        if (transferData.status === 'seal_verified') {
          setActiveStep('manifest')
          setSearchInput('')
          return toast.success("Inner Manifest Authenticated")
        }
      }
      if (cleanInput === transferData.outer_qr_hash) {
        if (transferData.status === 'completed' || transferData.status === 'disputed' || transferData.status === 'partially_received') {
          return toast.error("This transfer is already closed.")
        }
        setActiveStep('verify_seal')
        setSearchInput('')
        return toast.success("Outer Label Authenticated")
      }
    }

    setLoading(true)
    
    const { data, error } = await supabase
      .from('stock_transfers')
      .select(`
        *, 
        from:from_warehouse_id(name), 
        to:to_warehouse_id(name), 
        item_lines:stock_transfer_item_lines(item_id, inventory_items(*)),
        repair_lines:stock_transfer_repair_lines(repair_ticket_id, repair_tickets(*))
      `)
      .or(`outer_qr_hash.eq.${cleanInput},inner_qr_hash.eq.${cleanInput},transfer_number.eq.${cleanInput}`)
      .maybeSingle()

    setLoading(false)

    if (error || !data) {
      return toast.error(`Invalid QR Code or Hash: ${cleanInput}`)
    }

    // STRICT LOCATION SECURITY CHECK
    if (!isHQ && selectedLocation !== 'ALL' && data.to_warehouse_id !== selectedLocation) {
      return toast.error(`Unauthorized: This parcel is routed to ${data.to.name}, not your current location.`);
    }

    const isRepair = data.transfer_category === 'repair'
    let normalizedItems: any[] = []
    
    if (isRepair && data.repair_lines) {
      normalizedItems = data.repair_lines.map((line: any) => ({
        id: line.repair_ticket_id,
        _type: 'repair',
        barcode: line.repair_tickets.ticket_number,
        category: line.repair_tickets.item_description,
        weight: line.repair_tickets.gross_weight_g,
        weightLabel: 'g Gross',
        originalData: line.repair_tickets
      }))
    } else if (data.item_lines) {
      normalizedItems = data.item_lines.map((line: any) => ({
        id: line.item_id,
        _type: 'inventory',
        barcode: line.inventory_items.barcode,
        category: line.inventory_items.item_category,
        weight: line.inventory_items.net_weight_g,
        weightLabel: 'g Net',
        originalData: line.inventory_items
      }))
    }

    // ✨ NEW: Map bulk items (gifting and packaging) from the JSON field
    if (data.bulk_items && Array.isArray(data.bulk_items)) {
      data.bulk_items.forEach((bulkItem: any) => {
        normalizedItems.push({
          id: bulkItem.id, // Using the same ID string from source to represent this line item
          _type: bulkItem._type, // 'gifting' or 'packaging'
          item_name: bulkItem.item_name,
          barcode: bulkItem.item_name,
          category: bulkItem._type === 'gifting' ? 'Promotional Gift' : 'Store Packaging',
          weight: bulkItem.quantity,
          weightLabel: 'Units',
          originalData: bulkItem
        });
      });
    }

    data.normalizedItems = normalizedItems
    setTransferData(data)

    if (cleanInput === data.outer_qr_hash) {
      if (data.status === 'completed' || data.status === 'disputed' || data.status === 'partially_received') {
        return toast.error("This transfer is already closed.")
      }
      setActiveStep('verify_seal')
      setSearchInput('')
      toast.success("Outer Label Authenticated")
    } 
    else if (cleanInput === data.inner_qr_hash) {
      if (data.status === 'in_transit') {
        setTransferData(null)
        return toast.error("SECURITY HALT: You must scan the Outer Label and break the seal first.")
      }
      if (data.status === 'seal_verified') {
        setActiveStep('manifest')
        setSearchInput('')
        toast.success("Inner Manifest Authenticated")
      }
    } 
    else {
      toast.info(`Transfer ${data.transfer_number} Found. Scan physical labels to proceed.`)
      setActiveStep('search') 
      setSearchInput('')
    }
  }

  const verifyPhysicalSeal = async () => {
    if (sealInput.trim() !== transferData.seal_number) {
      return toast.error("SEAL MISMATCH. Contact Head Office immediately.")
    }

    setIsProcessing(true)
    try {
      const { error } = await supabase
        .from('stock_transfers')
        .update({ status: 'seal_verified' })
        .eq('id', transferData.id)
        
      if (error) throw error
      
      setTransferData({...transferData, status: 'seal_verified'})
      toast.success("Seal Broken Digitally. Open box and scan Inner QR.")
      setActiveStep('search') 
      setSearchInput('')
    } catch (err: any) {
      toast.error("Database Error: " + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const toggleItem = (itemId: string) => {
    const newSet = new Set(tickedItems)
    if (newSet.has(itemId)) newSet.delete(itemId)
    else newSet.add(itemId)
    setTickedItems(newSet)
  }

  const toggleAllItems = () => {
    if (tickedItems.size === transferData.normalizedItems.length) {
      setTickedItems(new Set()) 
    } else {
      setTickedItems(new Set(transferData.normalizedItems.map((i: any) => i.id))) 
    }
  }

  // --- DISPUTE RESOLUTION ENGINE ---
  const handleFinalIngest = async () => {
    setIsProcessing(true)
    try {
      const isDisputed = tickedItems.size < transferData.normalizedItems.length
      const isRepair = transferData.transfer_category === 'repair'

      // Separate the items into happy path vs disputed, categorized by type
      const successIds: string[] = []
      const disputedIds: string[] = []
      const successBulkItems: any[] = []

      transferData.normalizedItems.forEach((item: any) => {
        if (tickedItems.has(item.id)) {
          if (item._type === 'gifting' || item._type === 'packaging') {
            successBulkItems.push(item)
          } else {
            successIds.push(item.id)
          }
        } else {
          if (item._type === 'inventory' || item._type === 'repair') {
            disputedIds.push(item.id)
          }
        }
      })

      // 1. Process Successfully Received Main Inventory/Repairs
      if (successIds.length > 0) {
        if (isRepair) {
           const sampleItem = transferData.normalizedItems.find((i: any) => i.id === successIds[0]);
           const isReturningToOrigin = sampleItem?.originalData?.origin_warehouse_id === transferData.to_warehouse_id;
           const newRepairStatus = isReturningToOrigin ? 'received_at_store' : 'received_at_ho';

           const { error: repErr } = await supabase
             .from('repair_tickets')
             .update({ 
                status: newRepairStatus, 
                current_warehouse_id: transferData.to_warehouse_id,
                updated_at: new Date().toISOString()
             })
             .in('id', successIds)
             
           if (repErr) throw new Error("Repair Update Failed: " + repErr.message)

        } else {
           const { error: invErr } = await supabase
             .from('inventory_items')
             .update({ warehouse_id: transferData.to_warehouse_id, status: 'in_stock' })
             .in('id', successIds)
             
           if (invErr) throw new Error("Inventory Update Failed: " + invErr.message)
        }
      }

      // ✨ NEW: 1.5 Process Successfully Received Bulk Items (Gifts & Packaging)
      if (successBulkItems.length > 0) {
        for (const bulk of successBulkItems) {
          const tableName = bulk._type === 'gifting' ? 'gifting_inventory' : 'packaging_inventory';
          
          // Check if the destination warehouse already has this item
          const { data: existing } = await supabase.from(tableName)
            .select('id, stock_count')
            .eq('company_id', appUser?.company_id)
            .eq('warehouse_id', transferData.to_warehouse_id)
            .eq('item_name', bulk.item_name)
            .maybeSingle();

          if (existing) {
            // Update existing stock
            const { error: updErr } = await supabase.from(tableName)
              .update({ stock_count: existing.stock_count + bulk.weight, last_updated: new Date().toISOString() })
              .eq('id', existing.id);
            if (updErr) throw new Error(`Failed to ingest ${bulk.item_name}`);
          } else {
            // Insert new stock record for this warehouse
            const insertPayload: any = {
              company_id: appUser?.company_id,
              warehouse_id: transferData.to_warehouse_id,
              item_name: bulk.item_name,
              stock_count: bulk.weight
            };
            if (bulk._type === 'packaging') insertPayload.item_category = 'Received Packaging';

            const { error: insErr } = await supabase.from(tableName).insert(insertPayload);
            if (insErr) throw new Error(`Failed to create inventory record for ${bulk.item_name}`);
          }
        }
      }

      // 2. Process the Disputed Items (Lock them down)
      if (disputedIds.length > 0) {
        if (isRepair) {
           const { error: repErr } = await supabase
             .from('repair_tickets')
             .update({ 
                status: 'disputed', 
                updated_at: new Date().toISOString()
             })
             .in('id', disputedIds)
             
           if (repErr) throw new Error("Dispute Update Failed: " + repErr.message)

        } else {
           const { error: invErr } = await supabase
             .from('inventory_items')
             .update({ status: 'disputed' }) // We leave them in transit warehouse, but freeze the status
             .in('id', disputedIds)
             
           if (invErr) throw new Error("Inventory Dispute Update Failed: " + invErr.message)
        }
      }

      // 3. Update Transfer Status
      const newTransferStatus = isDisputed ? 'partially_received' : 'completed';

      const { error: trfErr } = await supabase
        .from('stock_transfers')
        .update({ 
          status: newTransferStatus,
          received_at: new Date().toISOString() 
        })
        .eq('id', transferData.id)

      if (trfErr) throw new Error("Transfer Update Failed: " + trfErr.message)

      if (isDisputed) {
        toast.error(`DISPUTE LOGGED: ${transferData.normalizedItems.length - tickedItems.size} items missing. Anomalies have been quarantined.`, { duration: 8000 })
      } else {
        toast.success(isRepair ? "Repairs successfully checked in!" : "Stock ingested perfectly into vault!")
      }

      router.push('/transfer')
    } catch (err: any) {
      toast.error(err.message) 
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa]">
      
      {/* CAMERA OVERLAY */}
      {showScanner && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="flex justify-between items-center p-4 bg-slate-900 text-white">
            <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <QrCode className="w-4 h-4 text-indigo-400" /> Vault Scanner
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setShowScanner(false)} className="text-white hover:bg-white/20">
              <X className="w-6 h-6" />
            </Button>
          </div>
          <div className="flex-1 relative flex items-center justify-center">
            <Scanner onScan={(codes) => {
              if (codes.length > 0) {
                setShowScanner(false);
                handleScanInput(codes[0].rawValue);
              }
            }} components={{ finder: true }} />
          </div>
          <div className="p-6 bg-slate-900 text-center text-xs text-slate-400 uppercase tracking-widest">
            Point camera at the jewelry QR tag
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center sticky top-0 z-40 shadow-sm">
        <div className="w-full max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <Link href="/transfer">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-sm font-semibold text-slate-900 tracking-tight">Receive Parcel</h1>
            
            {/* Display active location logic contextually in the header */}
            {!isHQ && selectedLocation !== 'ALL' && (
               <Badge variant="secondary" className="ml-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-50 text-[10px] hidden sm:inline-flex">
                 Receiving to Active Vault
               </Badge>
            )}

          </div>
          <Button 
            variant="ghost" size="sm" className="text-xs font-semibold text-slate-500"
            onClick={() => { setTransferData(null); setActiveStep('search'); setSearchInput(''); }}
          >
            <RefreshCw className="h-3.5 w-3.5 sm:mr-1.5" /> Reset
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-xl w-full mx-auto space-y-6">
        
        {/* SCANNER INPUT */}
        {activeStep === 'search' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-50/50 py-3 px-5 border-b">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">QR Verification</h3>
            </div>
            <div className="p-5 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Scan QR or Enter Hash..." 
                  className="pl-9 h-10 font-mono text-sm uppercase"
                  value={searchInput} 
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScanInput(searchInput)}
                />
              </div>
              <Button onClick={() => setShowScanner(true)} variant="outline" className="h-10 w-10 p-0 shadow-sm">
                <Camera className="h-4 w-4 text-slate-600" />
              </Button>
              <Button onClick={() => handleScanInput(searchInput)} disabled={loading} className="h-10 px-5 font-bold text-xs uppercase bg-slate-900 text-white">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 1: SEAL VERIFICATION */}
        {activeStep === 'verify_seal' && transferData && (
          <div className="bg-white border-2 border-orange-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in">
             <div className="bg-orange-50 py-3 px-5 border-b border-orange-100 flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-orange-600" />
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-700">Outer Seal Verification</h3>
               </div>
               <Badge className="bg-orange-600">Action Required</Badge>
             </div>
             <div className="p-6 text-center space-y-4">
                <p className="text-sm text-slate-600">Enter the physical seal number printed on the box to break the digital lock.</p>
                <Input 
                  placeholder="e.g. SL-123456" 
                  className="h-14 text-center text-xl font-mono uppercase font-bold tracking-widest"
                  value={sealInput}
                  onChange={(e) => setSealInput(e.target.value.toUpperCase())}
                />
                <Button 
                  onClick={verifyPhysicalSeal} 
                  disabled={isProcessing || !sealInput} 
                  className="w-full h-12 bg-orange-600 hover:bg-orange-700 font-bold uppercase tracking-widest text-xs"
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Break Seal"}
                </Button>
             </div>
          </div>
        )}

        {/* STEP 2: MANIFEST TICKING */}
        {activeStep === 'manifest' && transferData && (
          <div className={`bg-white border-2 rounded-xl shadow-sm overflow-hidden animate-in fade-in ${transferData.transfer_category === 'repair' ? 'border-purple-200' : 'border-indigo-200'}`}>
            <div className={`py-3 px-5 border-b flex items-center justify-between ${transferData.transfer_category === 'repair' ? 'bg-purple-50 border-purple-100' : 'bg-indigo-50 border-indigo-100'}`}>
              <div className="flex items-center gap-2">
                {transferData.transfer_category === 'repair' ? <Wrench className="h-4 w-4 text-purple-600" /> : <Boxes className="h-4 w-4 text-indigo-600" />}
                <h3 className={`text-[10px] font-black uppercase tracking-widest ${transferData.transfer_category === 'repair' ? 'text-purple-700' : 'text-indigo-700'}`}>
                  {transferData.transfer_category === 'repair' ? 'Repair Verification' : 'Inventory Verification'}
                </h3>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className={`h-7 text-[10px] font-bold ${transferData.transfer_category === 'repair' ? 'border-purple-300 text-purple-700' : 'border-indigo-300 text-indigo-700'}`}
                onClick={toggleAllItems}
              >
                {tickedItems.size === transferData.normalizedItems.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            
            <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
              {transferData.normalizedItems.map((item: any) => {
                const isTicked = tickedItems.has(item.id)
                return (
                  <div 
                    key={item.id} 
                    onClick={() => toggleItem(item.id)}
                    className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${isTicked ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:border-indigo-300'}`}
                  >
                    {isTicked ? <CheckSquare className="h-6 w-6 text-emerald-600 shrink-0" /> : <Square className="h-6 w-6 text-slate-300 shrink-0" />}
                    <div className="flex-1">
                      <p className="text-sm font-mono font-bold text-slate-900 flex items-center gap-2">
                        {item.barcode}
                        {item._type === 'gifting' && <Badge variant="outline" className="text-[8px] h-4 bg-rose-50 text-rose-600 border-rose-200 shadow-none"><Gift className="w-2.5 h-2.5 mr-1"/> GIFTING</Badge>}
                        {item._type === 'packaging' && <Badge variant="outline" className="text-[8px] h-4 bg-cyan-50 text-cyan-600 border-cyan-200 shadow-none"><Box className="w-2.5 h-2.5 mr-1"/> PACKAGING</Badge>}
                      </p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{item.weight}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{item.weightLabel}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-200">
              <Button 
                onClick={handleFinalIngest} 
                className={`w-full h-12 font-bold text-xs uppercase tracking-widest shadow-md rounded-xl transition-all ${
                  tickedItems.size === transferData.normalizedItems.length 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                  : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
                disabled={isProcessing || tickedItems.size === 0}
              >
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {tickedItems.size === transferData.normalizedItems.length ? "Confirm Full Receipt" : "Submit WITH MISSING ITEMS"}
              </Button>
              {tickedItems.size > 0 && tickedItems.size < transferData.normalizedItems.length && (
                 <p className="text-[10px] text-red-600 text-center font-bold mt-3 uppercase tracking-widest">
                   Warning: Submitting now will flag a discrepancy to the Head Office.
                 </p>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}