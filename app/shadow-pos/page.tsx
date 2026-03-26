'use client'

import React, { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns' 
import { useAuth } from '@/hooks/useAuth'
import { useStoreLocation } from '@/hooks/useStoreLocation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { 
  Trash2, ScanLine, Camera, X, Search, CheckCircle2,
  Building, Store, Ghost, Loader2, QrCode,
  ShieldAlert
} from 'lucide-react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface CartItem {
  id: string
  barcode: string
  sku_reference?: string
  metal_type: string
  mrp: number
  purity_karat?: string
  gross_weight_g?: number
  net_weight_g?: number
  status?: string
  warehouse_id?: string
}

export default function ShadowPOSPage() {
  const { appUser, loading } = useAuth()
  const { isHQ, isLocked, selectedLocation, setSelectedLocation } = useStoreLocation()
  const hasAutoScanned = useRef(false)

  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  
  const [barcodeInput, setBarcodeInput] = useState('')
  const [itemSearchTerm, setItemSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<CartItem[]>([])

  useEffect(() => {
    const init = async () => {
      if (!appUser) return
      try {
        const { data: whData } = await supabase.from('warehouses').select('id, name').eq('company_id', appUser.company_id).eq('is_active', true).order('name')
        if (whData && whData.length > 0) {
          setWarehouses(whData)
          if (!selectedLocation && isHQ) setSelectedLocation(whData[0].id)
        }
      } catch (err) {
        toast.error('Failed to load locations.')
      }
    }
    init()
  }, [appUser])

  useEffect(() => {
    const searchItems = async () => {
      if (!itemSearchTerm.trim() || !appUser || !selectedLocation) return setSearchResults([])
      
      let query = supabase.from('inventory_items')
        .select('id, barcode, sku_reference, metal_type, mrp, status, warehouse_id, purity_karat, gross_weight_g, net_weight_g')
        .eq('company_id', appUser.company_id)
        .eq('status', 'in_stock') 
        .or(`barcode.ilike.%${itemSearchTerm.trim()}%,sku_reference.ilike.%${itemSearchTerm.trim()}%`)
        .limit(15)

      if (selectedLocation !== 'ALL') {
        query = query.eq('warehouse_id', selectedLocation)
      }

      const { data, error } = await query
      if (error) console.error("Search Error:", error)
      setSearchResults(data || [])
    }
    const timeoutId = setTimeout(() => searchItems(), 300)
    return () => clearTimeout(timeoutId)
  }, [itemSearchTerm, appUser, selectedLocation])

  const processScannedItem = (item: CartItem) => {
    if (cart.find(c => c.barcode === item.barcode)) return toast.error(`Item already scanned.`)
    if (selectedLocation !== 'ALL' && item.warehouse_id !== selectedLocation) {
       return toast.error(`Cross-Branch Error: Item resides elsewhere.`)
    }
    if (item.status !== 'in_stock') return toast.error(`Item status is: ${item.status?.toUpperCase()}`)

    setCart(prev => [item, ...prev])
    toast.success(`${item.barcode} logged.`)
    setItemSearchTerm('')
    setSearchResults([]) 
  }

  // --- URL PARAMETER AUTO-SCANNER ---
  useEffect(() => {
    // If we have already scanned, or if prerequisites aren't ready, exit immediately.
    if (hasAutoScanned.current || !appUser || !selectedLocation || warehouses.length === 0) return;

    const urlParams = new URLSearchParams(window.location.search);
    const barcodeFromUrl = urlParams.get('barcode');

    if (barcodeFromUrl) {
      hasAutoScanned.current = true; // <--- Mark as scanned IMMEDIATELY to prevent double-firing
      
      // Small delay to ensure state (like selectedLocation) has settled
      setTimeout(() => {
          handleScanResult(barcodeFromUrl)
        // Optional: Clean up the URL so it doesn't re-scan on refresh
        window.history.replaceState({}, '', window.location.pathname);
      }, 500); 
    }
  }, [appUser, selectedLocation, warehouses]);

  const handleScanResult = async (barcode: string) => {
    if (!barcode.trim()) return toast.error('No barcode detected.')
    if (!selectedLocation || selectedLocation === 'ALL') return toast.error('Select SIS Location first.')

    try {
      const { data: item, error } = await supabase.from('inventory_items')
        .select('id, barcode, sku_reference, metal_type, mrp, status, warehouse_id, purity_karat, gross_weight_g, net_weight_g')
        .ilike('barcode', barcode.trim())
        .eq('company_id', appUser?.company_id)
        .maybeSingle()

      if (error) throw error
      if (!item) return toast.error(`Barcode not found.`)

      processScannedItem(item)
    } catch (err) {
      toast.error('Query failed.')
    }
  }

  const totalMemoValue = cart.reduce((sum, item) => sum + (item.mrp || 0), 0)

  // --- THE CORE SHADOW LOGIC ---
  const handleRecordSIS = async () => {
    if (!appUser) return toast.error('Unauthorized')
    if (cart.length === 0) return toast.error('Cart is empty')
    if (!selectedLocation || selectedLocation === 'ALL') return toast.error('Select SIS Terminal.')

    setIsProcessing(true)
    try {
      const itemIds = cart.map(c => c.id)
      
      // Update items to sold_unbilled. We do NOT generate an invoice record here.
      const { error } = await supabase.from('inventory_items')
        .update({ status: 'sold_unbilled' })
        .in('id', itemIds)
        
      if (error) throw error
      
      toast.success(`${cart.length} items marked as Sold (Unbilled).`, {
        description: "Items are removed from live stock. B2B settlement pending."
      })
      setCart([])
    } catch (err: any) {
      toast.error(err.message || 'Operation failed.')
    } finally {
      setIsProcessing(false)
    }
  }

  if (loading || !appUser) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-600" /></div>

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-slate-100 text-slate-900 font-sans overflow-y-auto lg:overflow-hidden">
      
      {showScanner && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="flex justify-between items-center p-4 bg-slate-900 text-white shadow-md">
            <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <QrCode className="w-4 h-4 text-cyan-400" /> SIS Scanner
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setShowScanner(false)} className="text-white hover:bg-white/20 rounded-full">
              <X className="w-6 h-6" />
            </Button>
          </div>
          <div className="flex-1 relative bg-black flex items-center justify-center">
            <Scanner onScan={(codes) => { if(codes.length > 0) { setShowScanner(false); handleScanResult(codes[0].rawValue) } }} components={{ finder: true }} />
          </div>
        </div>
      )}

      {/* SHADOW APP HEADER - Distinct Cyan/Dark Theme */}
      <header className="z-40 w-full bg-[#1e293b] text-white px-3 sm:px-4 h-14 sm:h-12 flex items-center justify-between shrink-0 shadow-md sticky top-0 lg:static">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="h-7 w-7 bg-cyan-600 flex items-center justify-center rounded-sm shrink-0">
            <Ghost className="h-4 w-4 text-white" />
          </div>
          <div className="hidden sm:block">
             <h1 className="font-semibold text-sm tracking-wide leading-none text-cyan-50">SIS Shadow Terminal</h1>
          </div>
          <Separator orientation="vertical" className="h-5 bg-slate-600 hidden sm:block mx-1" />
          
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-cyan-400 hidden sm:block" />
            <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={isLocked}>
              <SelectTrigger className="h-8 border-none bg-transparent hover:bg-slate-800 focus:ring-0 text-xs uppercase px-1 sm:px-2 w-[160px] sm:w-[180px] rounded-none text-cyan-100">
                <SelectValue placeholder="Identify SIS Node..." />
              </SelectTrigger>
              <SelectContent className="rounded-none border-slate-700 bg-slate-800 text-white">
                {isHQ && <SelectItem value="ALL" className="text-xs font-bold text-cyan-400">All Branches (HQ)</SelectItem>}
                {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs uppercase">{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
           <span className="text-xs text-slate-400 hidden md:block">{format(new Date(), 'EEEE, dd MMM yyyy')}</span>
           <Button variant="ghost" size="sm" className="h-8 rounded-sm text-xs font-semibold text-red-400 hover:text-white hover:bg-red-600 px-2 sm:px-3" onClick={() => setCart([])}>
            <span className="hidden sm:inline">Wipe Session</span>
            <Trash2 className="h-4 w-4 sm:hidden" />
          </Button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2 gap-2 max-w-7xl mx-auto w-full">
        
        {/* LEFT PANEL: CART */}
        <div className="flex-1 flex flex-col bg-white border border-slate-300 shadow-sm overflow-hidden rounded-sm min-h-[400px] lg:min-h-0">
          
          {/* SEARCH/SCAN INPUT AREA */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2 shrink-0">
            <div className="flex flex-col sm:flex-row gap-2 relative">
              <div className="relative flex-1 group z-20">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                 <Input 
                   placeholder="Search SKU or Barcode..." 
                   className="h-9 pl-9 rounded-sm border-slate-300 focus-visible:ring-cyan-600 text-sm bg-white"
                   value={itemSearchTerm} onChange={(e) => setItemSearchTerm(e.target.value)}
                 />
                 {searchResults.length > 0 && itemSearchTerm && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-300 shadow-lg max-h-[300px] overflow-y-auto rounded-sm">
                    {searchResults.map(item => {
                       const isHere = item.warehouse_id === selectedLocation
                       return (
                        <div key={item.id} className="p-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex justify-between" onClick={() => processScannedItem(item)}>
                          <div className="flex flex-col">
                            <span className="font-mono text-sm font-bold text-slate-800">{item.barcode}</span>
                            <span className="text-[10px] text-slate-500 uppercase">{item.sku_reference}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="text-sm font-bold text-slate-800">₹{(item.mrp || 0).toLocaleString()}</div>
                            {!isHere && <span className="text-[9px] text-amber-600 font-bold uppercase">Other Branch</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="w-full sm:w-[160px] shrink-0">
                 <Button onClick={() => setShowScanner(true)} className="w-full h-9 bg-cyan-700 hover:bg-cyan-800 text-white rounded-sm flex items-center justify-center gap-2 transition-none shadow-sm">
                   <Camera className="h-4 w-4" />
                   <span className="text-[11px] font-bold uppercase tracking-widest">Scan Tag</span>
                 </Button>
              </div>
            </div>
          </div>

          {/* CART ITEMS LIST */}
          <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
            <div className="hidden md:grid grid-cols-12 gap-2 bg-slate-100 sticky top-0 border-b border-slate-300 z-10 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
              <div className="col-span-1 text-center"></div>
              <div className="col-span-7">Item Record</div>
              <div className="col-span-2 text-right">Net Wt</div>
              <div className="col-span-2 text-right pr-2">Memo Value</div>
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[250px] lg:h-[400px] text-center p-6">
                 <Ghost className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                 <p className="text-sm font-semibold text-slate-400">Queue Empty</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex flex-col md:grid md:grid-cols-12 gap-2 md:items-center p-3 md:p-2 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start md:contents">
                      
                      <div className="flex items-start md:items-center gap-3 md:col-span-8">
                        <Button variant="ghost" size="icon" className="h-8 w-8 md:h-7 md:w-7 text-slate-400 hover:text-red-600 rounded-sm shrink-0 bg-slate-100 md:bg-transparent" onClick={() => setCart(cart.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5" />
                        </Button>
                        <div className="flex flex-col">
                          <p className="font-mono text-sm font-bold text-slate-800 leading-tight">{item.barcode}</p>
                          <p className="text-[10px] text-slate-500 uppercase mt-0.5 tracking-tight line-clamp-1">{item.sku_reference} | {item.metal_type} | {item.purity_karat}</p>
                        </div>
                      </div>

                      <div className="md:hidden flex flex-col items-end justify-start">
                        <p className="font-bold text-sm text-slate-800 leading-tight">₹{(item.mrp || 0).toLocaleString()}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{item.net_weight_g}g</p>
                      </div>

                      <div className="hidden md:block col-span-2 text-right">
                         <p className="text-xs font-medium text-slate-700">{item.net_weight_g} g</p>
                      </div>
                      <div className="hidden md:block col-span-2 text-right font-bold text-sm text-slate-800 pr-2">
                         {(item.mrp || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: ACTIONS */}
        <div className="w-full lg:w-[350px] bg-slate-50 border border-slate-300 flex flex-col shrink-0 rounded-sm">
          
          <div className="flex-1 p-6 flex flex-col justify-center text-center space-y-4">
            <ShieldAlert className="h-12 w-12 text-slate-300 mx-auto" />
            <div>
              <h3 className="font-bold text-slate-700">SIS Status Protocol</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Recording items here will immediately mark them as <strong className="text-cyan-700">Sold (Unbilled)</strong>. 
                They will be removed from your active stock count to prevent double-selling. 
                <br/><br/>
                No Tax Invoice will be generated. B2B settlement must be processed by the HQ Admin at month-end.
              </p>
            </div>
          </div>

          {/* LEDGER & ACTIONS FOOTER */}
          <div className="p-4 border-t border-slate-300 bg-white space-y-3 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
             <div className="flex justify-between items-center text-sm font-semibold text-slate-700 pb-2 border-b border-slate-200">
               <span>Total Items</span>
               <span>{cart.length}</span>
             </div>
             <div className="flex justify-between items-end pt-1 mb-2">
                <div>
                   <p className="text-[10px] font-bold uppercase text-slate-500">Gross Memo Value</p>
                   <p className="text-3xl font-black tracking-tight text-slate-900">
                     ₹{totalMemoValue.toLocaleString()}
                   </p>
                </div>
             </div>

             <Button 
                onClick={handleRecordSIS} 
                disabled={isProcessing || cart.length === 0} 
                className="w-full font-bold text-sm h-12 rounded-sm flex items-center justify-center gap-2 transition-all text-white bg-cyan-700 hover:bg-cyan-800"
              >
                {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : 
                  <><CheckCircle2 className="h-5 w-5"/> Record SIS Sale</>
                }
              </Button>
          </div>
        </div>
      </div>
    </div>
  )
}