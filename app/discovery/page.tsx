"use client"

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'
import { 
  Search, Info, ShoppingCart, ArrowRight, Loader2, QrCode, Store, Camera, X
} from 'lucide-react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { Label } from 'recharts'

interface ProductDiscovery {
  id: string
  barcode: string // Note: DB column is still 'barcode', but we treat it as QR in UI
  metal_type: string
  purity_karat: string
  gross_weight_g: number
  net_weight_g: number
  total_stone_weight_cts: number
  item_category: string
  mrp: number
  status: string
  is_exchanged: boolean
}

export default function DiscoveryPage() {
  const { appUser, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  
  // Core State
  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')
  const [searchInput, setSearchInput] = useState('')
  
  // Found Product State
  const [product, setProduct] = useState<ProductDiscovery | null>(null)
  const [fetching, setFetching] = useState(false)

  // Scanner State
  const [showScanner, setShowScanner] = useState(false)

  // 1. Initial Load: Fetch Warehouses
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

        if (whData && whData.length > 0) {
          setWarehouses(whData)
          setSelectedWarehouseId(whData[0].id)
        }
      } catch (err) {
        toast({ title: 'Connection Error', variant: 'destructive' })
      }
    }
    init()
  }, [appUser, toast])

  // 2. Search/Scan Logic
  const handleDiscovery = async (qrCodeData: string) => {
    if (!qrCodeData.trim()) return
    if (!selectedWarehouseId) {
        return toast({ title: "Select Branch First", description: "Select your current location.", variant: "destructive" })
    }

    setFetching(true)
    try {
      // We still query the 'barcode' column in DB, since that's where the QR string is stored
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .ilike('barcode', qrCodeData.trim())
        .eq('company_id', appUser?.company_id)
        .maybeSingle()

      if (error) throw error
      if (!data) {
        toast({ title: "Item Not Found", description: "This QR Code does not exist in the system.", variant: "destructive" })
        setProduct(null)
      } else {
        setProduct(data)
        setSearchInput(qrCodeData) // Update input to show what was scanned
      }
    } catch (err) {
      toast({ title: "Discovery Failed", variant: "destructive" })
    } finally {
      setFetching(false)
    }
  }

  const handleCheckout = () => {
    if (product) {
      router.push(`/pos?barcode=${product.barcode}`)
    } else {
      router.push('/pos')
    }
  }

  // Scanner Callback
  const onScanSuccess = (detectedCodes: any[]) => {
    if (detectedCodes && detectedCodes.length > 0) {
      const code = detectedCodes[0].rawValue
      setShowScanner(false)
      handleDiscovery(code)
    }
  }

  if (authLoading || !appUser) return null

  // 3. Price Math
  const gstAmount = product ? (product.mrp * 0.03) : 0
  const finalPrice = product ? (product.mrp + gstAmount) : 0

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      
      {/* FULL SCREEN CAMERA OVERLAY */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex justify-between items-center p-4 bg-slate-900 text-white">
            <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <QrCode className="w-4 h-4" /> Scan Asset Tag
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setShowScanner(false)} className="text-white hover:bg-white/20">
              <X className="w-6 h-6" />
            </Button>
          </div>
          <div className="flex-1 relative bg-black flex items-center justify-center">
            <Scanner 
              onScan={onScanSuccess}
              onError={(error) => console.log(error)}
              components={{ finder: true }}
            />
          </div>
          <div className="p-6 bg-slate-900 text-center text-xs text-slate-400 uppercase tracking-widest">
            Point camera at the jewelry QR tag
          </div>
        </div>
      )}

      {/* 1. TOP SYSTEM ACTION BAR */}
      <header className="bg-white border-b border-slate-300 px-3 py-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-600" />
          <h1 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Product Discovery</h1>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Store className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
          <Label className="text-xs font-bold text-slate-600 uppercase whitespace-nowrap">Location:</Label>
          <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
            <SelectTrigger className="h-8 text-xs font-bold bg-slate-50 border-slate-300 focus:ring-1 focus:ring-slate-400 w-full sm:w-48 rounded-sm">
              <SelectValue placeholder="Select Branch..." />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs">{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <main className="p-3 sm:p-4 flex-1 w-full max-w-5xl mx-auto space-y-4">
        
        {/* Search Input Bar */}
        <div className="bg-white border border-slate-300 rounded-sm p-3 shadow-sm flex flex-col sm:flex-row gap-2 items-center">
          <div className="relative flex-1 w-full flex gap-2">
            <div className="relative flex-1">
              <Input 
                placeholder="SCAN OR ENTER QR CODE..."
                className="h-10 pl-10 text-sm font-mono uppercase bg-slate-50 border-slate-300 focus-visible:ring-slate-400 rounded-sm w-full"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDiscovery(searchInput)}
                disabled={fetching}
              />
              <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            </div>
            
            {/* MOBILE CAMERA BUTTON */}
            <Button 
              onClick={() => setShowScanner(true)}
              className="h-10 w-12 shrink-0 bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300 rounded-sm sm:hidden transition-none flex items-center justify-center p-0"
            >
              <Camera className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            {/* DESKTOP CAMERA BUTTON */}
            <Button 
              onClick={() => setShowScanner(true)}
              className="h-10 px-4 font-bold text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300 rounded-sm hidden sm:flex transition-none"
            >
              <Camera className="w-4 h-4 mr-2" /> Camera
            </Button>

            <Button 
              onClick={() => handleDiscovery(searchInput)}
              disabled={fetching || !searchInput.trim()}
              className="h-10 px-6 font-bold text-xs bg-slate-800 hover:bg-slate-900 text-white rounded-sm w-full sm:w-auto transition-none"
            >
              {fetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Lookup"}
            </Button>
            
            <Button 
              onClick={handleCheckout} 
              variant="outline" 
              className="h-10 px-4 font-bold text-xs border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-sm w-full sm:w-auto whitespace-nowrap transition-none"
            >
              <ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> POS
            </Button>
          </div>
        </div>

        {/* 3. RESULT DATA GRID */}
        {product ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
            
            {/* Left Panel: Specifications */}
            <div className="bg-white border border-slate-300 rounded-sm shadow-sm overflow-hidden">
              <div className="bg-slate-100 border-b border-slate-300 px-3 py-2 flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> Technical Specifications
                </h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-200 text-slate-600 border border-slate-300 rounded-sm uppercase tracking-widest">
                  {product.status.replace('_', ' ')}
                </span>
              </div>
              
              {/* Classic ERP Table Layout */}
              <div className="p-0">
                <table className="w-full text-xs text-left">
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-3 font-semibold text-slate-500 w-1/3 uppercase bg-slate-50/50">QR Code ID</td>
                      <td className="p-3 font-mono font-bold text-slate-900">{product.barcode}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-500 w-1/3 uppercase bg-slate-50/50">Category</td>
                      <td className="p-3 font-bold text-slate-900">{product.item_category}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-500 w-1/3 uppercase bg-slate-50/50">Metal Profile</td>
                      <td className="p-3 font-bold text-amber-700">{product.metal_type} ({product.purity_karat})</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-500 w-1/3 uppercase bg-slate-50/50">Gross Weight</td>
                      <td className="p-3 font-bold text-slate-900">{product.gross_weight_g.toFixed(3)} g</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-500 w-1/3 uppercase bg-slate-50/50">Net Weight</td>
                      <td className="p-3 font-bold text-slate-900">{product.net_weight_g.toFixed(3)} g</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-500 w-1/3 uppercase bg-slate-50/50">Stone Weight</td>
                      <td className="p-3 font-bold text-blue-700">{product.total_stone_weight_cts.toFixed(2)} ct</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Panel: Financials */}
            <div className="flex flex-col gap-4">
              <div className="bg-white border border-slate-300 rounded-sm shadow-sm overflow-hidden">
                <div className="bg-slate-100 border-b border-slate-300 px-3 py-2">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <ShoppingCart className="w-3.5 h-3.5" /> Financial Quotation
                  </h3>
                </div>
                <div className="p-0">
                  <table className="w-full text-xs text-left">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="p-4 font-semibold text-slate-500 uppercase bg-slate-50/50">Billed Price (Excl. Tax)</td>
                        <td className="p-4 font-mono font-bold text-slate-900 text-right text-sm">₹{product.mrp.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      </tr>
                      <tr>
                        <td className="p-4 font-semibold text-slate-500 uppercase bg-slate-50/50 border-b-2 border-slate-200">Standard GST (3%)</td>
                        <td className="p-4 font-mono font-bold text-green-700 text-right text-sm border-b-2 border-slate-200">+ ₹{gstAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      </tr>
                      <tr className="bg-emerald-50/30">
                        <td className="p-5 font-black text-slate-800 uppercase tracking-widest align-bottom">Final Quote</td>
                        <td className="p-5 font-mono font-black text-3xl text-slate-900 text-right tracking-tighter">₹{finalPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 w-full mt-auto">
                <Button 
                  onClick={() => setProduct(null)} 
                  variant="outline" 
                  className="flex-1 h-12 text-xs font-bold border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-sm transition-none"
                >
                  Clear Screen
                </Button>
                <Button 
                  onClick={handleCheckout} 
                  className="flex-[2] h-12 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-sm transition-none shadow-sm uppercase tracking-widest"
                >
                  Proceed to Billing <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-3 bg-white border border-slate-300 rounded-sm shadow-sm">
            <QrCode className="w-12 h-12 text-slate-300" />
            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">Awaiting Scan</p>
              <p className="text-xs">Use the camera or enter the QR code above.</p>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}