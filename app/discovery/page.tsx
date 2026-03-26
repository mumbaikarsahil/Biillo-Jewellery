"use client"

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useStoreLocation } from '@/hooks/useStoreLocation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { 
  Search, Info, ShoppingCart, ArrowRight, Loader2, QrCode, Store, Camera, X, Hammer, Gem
} from 'lucide-react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { cn } from '@/lib/utils'

interface ProductDiscovery {
  id: string
  barcode: string
  metal_type: string
  purity_karat: string
  gross_weight_g: number
  net_weight_g: number
  total_stone_weight_cts: number
  item_category: string
  cost_making: number 
  mrp: number
  status: string
  is_exchanged: boolean
  warehouse_id?: string
}

export default function DiscoveryPage() {
  const { appUser, loading: authLoading } = useAuth()
  const router = useRouter()
  
  const { isHQ, isLocked, selectedLocation, setSelectedLocation } = useStoreLocation()
  
  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [product, setProduct] = useState<ProductDiscovery | null>(null)
  const [fetching, setFetching] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  const [todayBoardRate24K, setTodayBoardRate24K] = useState<number>(7250)

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

        // Fetch the live gold rate from the company profile
        const { data: companyData } = await supabase
          .from('companies')
          .select('current_rate_24k')
          .eq('id', appUser.company_id)
          .maybeSingle()
          
        if (companyData) {
          setTodayBoardRate24K(companyData.current_rate_24k)
        }

      } catch (err) {
        toast.error('Failed to load initial data')
      }
    }
    init()
  }, [appUser])

  const handleDiscovery = async (qrCodeData: string) => {
    if (!qrCodeData.trim()) return
    if (!selectedLocation) return toast.error("Select your current location first.")

    setFetching(true)
    try {
      let query = supabase
        .from('inventory_items')
        .select('*') 
        .ilike('barcode', qrCodeData.trim())
        .eq('company_id', appUser?.company_id)

      if (selectedLocation !== 'ALL') {
        query = query.eq('warehouse_id', selectedLocation)
      }

      const { data, error } = await query.maybeSingle()

      if (error) throw error
      if (!data) {
        toast.error(selectedLocation !== 'ALL' ? "Item not found in this specific branch." : "Item does not exist in the system.")
        setProduct(null)
      } else {
        setProduct(data)
        setSearchInput(qrCodeData) 
      }
    } catch (err) {
      toast.error("Discovery Failed. Please try again.")
    } finally {
      setFetching(false)
    }
  }

  const handleCheckout = () => {
    const isShadowUser = appUser?.role === 'shadow_manager' || appUser?.role === 'shadow_sales'
    const targetRoute = isShadowUser ? '/shadow-pos' : '/pos'

    if (product) {
      router.push(`${targetRoute}?barcode=${product.barcode}`)
    } else {
      router.push(targetRoute)
    }
  }

  const onScanSuccess = (detectedCodes: any[]) => {
    if (detectedCodes && detectedCodes.length > 0) {
      setShowScanner(false)
      handleDiscovery(detectedCodes[0].rawValue)
    }
  }

  if (authLoading || !appUser) return null

  // --- Advanced Exact Quotation Math ---
  let calculatedGoldValue = 0
  let calculatedStoneValue = 0
  let exactMakingCharge = 0
  let gstAmount = 0
  let finalPrice = 0
  let karatNumber = 24

  if (product) {
    karatNumber = parseInt(product.purity_karat.replace(/\D/g, '')) || 24
    const ratePerGramForThisKarat = todayBoardRate24K * (karatNumber / 24)
    calculatedGoldValue = product.net_weight_g * ratePerGramForThisKarat
    exactMakingCharge = Number(product.cost_making) || 0

    if (product.total_stone_weight_cts > 0) {
      calculatedStoneValue = Math.max(0, product.mrp - (calculatedGoldValue + exactMakingCharge))
    } else {
      calculatedStoneValue = 0 
    }

    gstAmount = product.mrp * 0.03
    finalPrice = product.mrp + gstAmount
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col font-sans selection:bg-indigo-100">
      
      {/* CAMERA OVERLAY */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex justify-between items-center p-4 bg-slate-900 text-white">
            <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <QrCode className="w-4 h-4 text-indigo-400" /> Scan Asset Tag
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setShowScanner(false)} className="text-white hover:bg-white/20 rounded-full">
              <X className="w-6 h-6" />
            </Button>
          </div>
          <div className="flex-1 relative bg-black flex items-center justify-center">
            <Scanner onScan={onScanSuccess} onError={(error) => console.log(error)} components={{ finder: true }} />
          </div>
          <div className="p-6 bg-slate-900 text-center text-xs text-slate-400 uppercase tracking-widest">
            Point camera at the jewelry QR tag
          </div>
        </div>
      )}

      {/* HEADER - Exact h-14 height to match the Sidebar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center sticky top-0 z-10 shadow-sm box-border">
        <div className="w-full max-w-5xl mx-auto flex justify-between items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center rounded text-xs shadow-sm">
              <Gem className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">Product Discovery</h1>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Store className="w-4 h-4 text-slate-400 hidden sm:block" />
            <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={isLocked}>
              <SelectTrigger className="h-8 text-xs font-semibold bg-white border-slate-200 focus:ring-1 focus:ring-indigo-500 w-full sm:w-48 md:w-56 rounded-md shadow-sm">
                <SelectValue placeholder="Select Context Node..." />
              </SelectTrigger>
              <SelectContent className="rounded-md border-slate-200 shadow-lg">
                {isHQ && <SelectItem value="ALL" className="text-xs font-bold text-indigo-600">Global Search (HQ)</SelectItem>}
                {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs font-medium">{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <main className="p-4 sm:p-6 flex-1 w-full max-w-5xl mx-auto space-y-6">
        
        {/* Search Command Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-sm flex flex-col sm:flex-row gap-2 items-center">
          <div className="relative flex-1 w-full flex gap-2">
            <div className="relative flex-1">
              <Input 
                placeholder="Search SKU or scan tag..."
                className="h-10 pl-9 pr-4 text-sm font-medium bg-slate-50 border-slate-200 focus-visible:bg-white focus-visible:border-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400 rounded-lg w-full transition-all"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDiscovery(searchInput)}
                disabled={fetching}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            </div>
            {/* Mobile Camera Button */}
            <Button onClick={() => setShowScanner(true)} className="h-10 w-12 shrink-0 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg sm:hidden shadow-sm flex items-center justify-center p-0">
              <Camera className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto shrink-0">
            <Button onClick={() => setShowScanner(true)} variant="outline" className="h-10 px-4 font-semibold text-xs border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-lg hidden sm:flex shadow-sm">
              <Camera className="w-4 h-4 mr-2" /> Scan
            </Button>
            <Button onClick={() => handleDiscovery(searchInput)} disabled={fetching || !searchInput.trim()} className="h-10 px-6 font-semibold text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-lg w-full sm:w-auto shadow-sm">
              {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lookup"}
            </Button>
          </div>
        </div>

        {product ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300 zoom-in-95">
            
            {/* ========================================= */}
            {/* THERMAL RECEIPT 1: SPECIFICATIONS         */}
            {/* ========================================= */}
            <div className="bg-[#FAFAF9] border-t-4 border-b-4 border-dashed border-slate-300 shadow-md p-6 font-mono text-slate-900 relative">
              
              {/* Receipt Header */}
              <div className="text-center border-b-2 border-dashed border-slate-300 pb-4 mb-4">
                <h2 className="text-lg font-black uppercase tracking-widest text-slate-900">*** Asset Specs ***</h2>
                <div className="mt-2 inline-block px-3 py-1 border border-slate-900 uppercase text-[10px] font-bold tracking-widest">
                  STATUS: {product.status.replace('_', ' ')}
                </div>
              </div>
              
              {/* Data Rows */}
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between py-1.5 border-b border-dotted border-slate-300">
                  <span className="text-slate-500 uppercase tracking-wider">Asset ID</span>
                  <span className="font-bold">{product.barcode}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-dotted border-slate-300">
                  <span className="text-slate-500 uppercase tracking-wider">Category</span>
                  <span className="font-bold">{product.item_category}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-dotted border-slate-300">
                  <span className="text-slate-500 uppercase tracking-wider">Profile</span>
                  <span className="font-bold">{product.metal_type} ({product.purity_karat})</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-dotted border-slate-300">
                  <span className="text-slate-500 uppercase tracking-wider">Gross Wt.</span>
                  <span className="font-bold">{product.gross_weight_g.toFixed(3)} g</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-dotted border-slate-300">
                  <span className="text-slate-500 uppercase tracking-wider">Net Wt.</span>
                  <span className="font-bold">{product.net_weight_g.toFixed(3)} g</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-dotted border-slate-300">
                  <span className="text-slate-500 uppercase tracking-wider">Stone Wt.</span>
                  <span className="font-bold">{product.total_stone_weight_cts.toFixed(2)} ct</span>
                </div>
              </div>
              
              {/* Receipt Footer */}
              <div className="mt-6 text-center text-[10px] text-slate-500 uppercase tracking-widest border-t-2 border-dashed border-slate-300 pt-4">
                --- END OF SPECIFICATIONS ---
              </div>
            </div>

            {/* ========================================= */}
            {/* THERMAL RECEIPT 2: FINANCIALS             */}
            {/* ========================================= */}
            <div className="flex flex-col gap-6">
              <div className="bg-[#FAFAF9] border-t-4 border-b-4 border-dashed border-slate-300 shadow-md p-6 font-mono text-slate-900 relative">
                
                {/* Receipt Header */}
                <div className="text-center border-b-2 border-dashed border-slate-300 pb-4 mb-4">
                  <h2 className="text-lg font-black uppercase tracking-widest text-slate-900">*** Quotation ***</h2>
                  <p className="text-[10px] uppercase mt-2 tracking-widest text-slate-500">Board Rate: ₹{todayBoardRate24K.toLocaleString()}/g (24K)</p>
                </div>
                
                {/* Data Rows */}
                <div className="flex flex-col gap-2 text-sm">
                  
                  <div className="flex justify-between items-start py-1.5 border-b border-dotted border-slate-300">
                    <div>
                      <span className="block uppercase tracking-wider text-slate-500">Gold Value</span>
                      <span className="block text-[9px] text-slate-400 mt-0.5 tracking-tight">({product.net_weight_g.toFixed(2)}g @ {karatNumber}K)</span>
                    </div>
                    <span className="font-bold">
                      Rs. {calculatedGoldValue.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </span>
                  </div>

                  {product.total_stone_weight_cts > 0 && (
                    <div className="flex justify-between py-1.5 border-b border-dotted border-slate-300">
                      <span className="uppercase tracking-wider text-slate-500">Stone Value</span>
                      <span className="font-bold">
                        Rs. {calculatedStoneValue.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between py-1.5 border-b border-dashed border-slate-300 mb-2">
                    <span className="uppercase tracking-wider text-slate-500">Making (Lbr)</span>
                    <span className="font-bold">
                      Rs. {exactMakingCharge.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </span>
                  </div>

                  <div className="flex justify-between py-2 text-base">
                    <span className="font-bold uppercase tracking-wider">Base Price</span>
                    <span className="font-black">
                      Rs. {product.mrp.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b-2 border-slate-900 pb-3">
                    <span className="uppercase tracking-wider text-slate-500">GST (3%)</span>
                    <span className="font-bold">
                      + Rs. {gstAmount.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </span>
                  </div>

                  {/* Final Total */}
                  <div className="flex justify-between items-end pt-3 pb-1">
                    <span className="text-sm font-black uppercase tracking-widest">Net Qty</span>
                    <span className="text-3xl font-black tracking-tighter">
                      ₹{finalPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                </div>
              </div>

              {/* Action Buttons (Kept as standard UI buttons, not part of the receipt) */}
              <div className="flex gap-3 w-full">
                <Button 
                  onClick={() => setProduct(null)} 
                  variant="outline" 
                  className="flex-1 h-12 text-sm font-semibold border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm"
                >
                  Clear Terminal
                </Button>
                <Button 
                  onClick={handleCheckout} 
                  className="flex-[2] h-12 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm uppercase tracking-widest"
                >
                  Send to POS <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-4 bg-white border border-slate-200 rounded-xl shadow-sm max-w-2xl mx-auto">
            <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
              <QrCode className="w-8 h-8 text-slate-300" />
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">Awaiting Input</p>
              <p className="text-xs font-medium">Scan a tag or search an SKU to reveal details.</p>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}